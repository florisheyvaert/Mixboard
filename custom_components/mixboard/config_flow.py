"""Config flow for Mixboard: one click, no options."""

from __future__ import annotations

from typing import Any

from homeassistant import config_entries

from .const import DOMAIN


class MixboardConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            return self.async_create_entry(title="Mixboard", data={})
        return self.async_show_form(step_id="user")
