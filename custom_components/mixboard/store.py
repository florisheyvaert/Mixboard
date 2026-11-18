"""Persistent storage for Mixboard: profiles and the home page layout."""

from __future__ import annotations

import copy
from typing import Any
import uuid

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION

EMPTY_LAYOUT: dict[str, Any] = {"groups": [], "hidden": [], "favorites": [], "names": {}}


class MixboardStore:
    """Stored in .storage/mixboard.

    - profiles: named snapshots of helper values
    - layout: groups of automations, hidden items, favorites and display names for the home page
    """

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {"profiles": [], "layout": copy.deepcopy(EMPTY_LAYOUT)}

    async def async_load(self) -> None:
        data = await self._store.async_load()
        if isinstance(data, dict):
            self._data = {
                "profiles": list(data.get("profiles", [])),
                "layout": {**copy.deepcopy(EMPTY_LAYOUT), **data.get("layout", {})},
            }

    @property
    def profiles(self) -> list[dict[str, Any]]:
        return self._data["profiles"]

    @property
    def layout(self) -> dict[str, Any]:
        return self._data["layout"]

    async def async_save_profile(self, name: str, values: dict[str, str]) -> dict[str, Any]:
        profile = {"id": uuid.uuid4().hex, "name": name, "values": values}
        self._data["profiles"].append(profile)
        await self._store.async_save(self._data)
        return profile

    async def async_delete_profile(self, profile_id: str) -> bool:
        before = len(self.profiles)
        self._data["profiles"] = [p for p in self.profiles if p["id"] != profile_id]
        if len(self.profiles) == before:
            return False
        await self._store.async_save(self._data)
        return True

    async def async_save_layout(self, layout: dict[str, Any]) -> dict[str, Any]:
        self._data["layout"] = layout
        await self._store.async_save(self._data)
        return layout
