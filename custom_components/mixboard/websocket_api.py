"""Websocket commands used by the Mixboard panel."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import category_registry as cr, entity_registry as er

from .const import DOMAIN
from .scanner import scan


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_automations)
    websocket_api.async_register_command(hass, ws_profiles)
    websocket_api.async_register_command(hass, ws_profile_save)
    websocket_api.async_register_command(hass, ws_profile_delete)
    websocket_api.async_register_command(hass, ws_layout)
    websocket_api.async_register_command(hass, ws_layout_save)


LAYOUT_SCHEMA = vol.Schema(
    {
        vol.Required("groups"): [
            {
                vol.Required("id"): vol.All(str, vol.Length(min=1, max=64)),
                vol.Required("name"): vol.All(str, vol.Length(min=1, max=60)),
                vol.Required("automations"): [str],
            }
        ],
        # Item keys: an automation entity_id or "group:<id>".
        vol.Required("hidden"): [str],
        vol.Required("favorites"): [
            {
                vol.Required("type"): vol.In(["entity", "automation", "group"]),
                vol.Required("id"): str,
                # For entities: what a tap does, e.g. {"kind": "toggle"} or
                # {"kind": "service", "service": "turn_on", "data": {"brightness_pct": 20}}.
                vol.Optional("action"): dict,
            }
        ],
        # Display names in Mixboard for automations, by entity_id. HA's own name is untouched.
        vol.Optional("names", default={}): {str: vol.All(str, vol.Length(min=1, max=80))},
    }
)


def _raw_config(entity: Any) -> dict[str, Any] | None:
    config = getattr(entity, "raw_config", None)
    return config if isinstance(config, dict) else None


@callback
def collect_automations(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Every automation with its category and the helpers it uses."""
    automations = hass.data.get("automation")
    scripts = hass.data.get("script")
    if automations is None:
        return []

    ent_reg = er.async_get(hass)
    cat_reg = cr.async_get(hass)

    def get_script_config(entity_id: str) -> dict[str, Any] | None:
        entity = scripts.get_entity(entity_id) if scripts is not None else None
        return _raw_config(entity) if entity is not None else None

    result = []
    for entity in automations.entities:
        config = _raw_config(entity) or {}
        category = None
        entry = ent_reg.async_get(entity.entity_id)
        if entry is not None and (category_id := entry.categories.get("automation")):
            found = cat_reg.async_get_category(scope="automation", category_id=category_id)
            if found is not None:
                category = {"id": category_id, "name": found.name, "icon": found.icon}
        result.append(
            {
                "entity_id": entity.entity_id,
                "config_id": config.get("id"),
                "category": category,
                "helpers": [
                    {"entity_id": link.entity_id, "via": link.via}
                    for link in scan(config, get_script_config)
                ],
            }
        )
    return result


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/automations"})
@callback
def ws_automations(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    connection.send_result(msg["id"], {"automations": collect_automations(hass)})


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/profiles"})
@callback
def ws_profiles(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    connection.send_result(msg["id"], {"profiles": hass.data[DOMAIN]["store"].profiles})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/profiles/save",
        vol.Required("name"): vol.All(str, vol.Length(min=1, max=60)),
        vol.Required("values"): {str: str},
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_profile_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    profile = await hass.data[DOMAIN]["store"].async_save_profile(msg["name"], msg["values"])
    connection.send_result(msg["id"], {"profile": profile})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/profiles/delete", vol.Required("profile_id"): str}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_profile_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if await hass.data[DOMAIN]["store"].async_delete_profile(msg["profile_id"]):
        connection.send_result(msg["id"])
    else:
        connection.send_error(msg["id"], websocket_api.ERR_NOT_FOUND, "Profile not found")


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/layout"})
@callback
def ws_layout(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    connection.send_result(msg["id"], {"layout": hass.data[DOMAIN]["store"].layout})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/layout/save", vol.Required("layout"): LAYOUT_SCHEMA}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_layout_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    layout = await hass.data[DOMAIN]["store"].async_save_layout(msg["layout"])
    connection.send_result(msg["id"], {"layout": layout})
