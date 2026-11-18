"""Persistent storage for Mixboard (profiles)."""

from __future__ import annotations

from typing import Any
import uuid

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY, STORAGE_VERSION


class MixboardStore:
    """Profiles: named snapshots of helper values, stored in .storage/mixboard."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._data: dict[str, Any] = {"profiles": []}

    async def async_load(self) -> None:
        data = await self._store.async_load()
        if isinstance(data, dict):
            self._data = {"profiles": list(data.get("profiles", []))}

    @property
    def profiles(self) -> list[dict[str, Any]]:
        return self._data["profiles"]

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
