"""Find the input helpers an automation uses.

Pure Python without Home Assistant imports, so it can be unit tested on plain
config dicts. The scanner walks every string in the automation config. That
covers entity_id fields, targets, `at:` triggers, blueprint inputs and
templates such as ``{{ states('input_number.delay') }}`` in one pass. Scripts
the automation calls are followed, and helpers found there are marked with the
script they came from.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from dataclasses import dataclass
import re
from typing import Any

HELPER_DOMAINS = (
    "input_number",
    "input_boolean",
    "input_datetime",
    "input_select",
    "input_text",
    "input_button",
    "timer",
    "counter",
)

# (?<!\w) keeps "my_input_number.x" out but still matches "states.input_number.x".
_HELPER_RE = re.compile(r"(?<!\w)((?:" + "|".join(HELPER_DOMAINS) + r")\.[a-z0-9_]+)")
_SCRIPT_RE = re.compile(r"(?<!\w)script\.([a-z0-9_]+)")
# Service names of the script domain, not script entities.
_SCRIPT_SERVICES = {"turn_on", "turn_off", "toggle", "reload"}

MAX_SCRIPT_DEPTH = 3


@dataclass(frozen=True)
class LinkedHelper:
    """A helper entity used by an automation."""

    entity_id: str
    via: str | None = None  # script entity_id when found through a script


def iter_strings(node: Any) -> Iterator[str]:
    """Yield every string value in a nested config, in document order."""
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for value in node.values():
            yield from iter_strings(value)
    elif isinstance(node, (list, tuple)):
        for value in node:
            yield from iter_strings(value)


def _unique(items: Iterator[str]) -> list[str]:
    return list(dict.fromkeys(items))


def find_helpers(config: Any) -> list[str]:
    """Helper entity_ids referenced directly in a config, first mention first."""
    return _unique(m for s in iter_strings(config) for m in _HELPER_RE.findall(s))


def find_scripts(config: Any) -> list[str]:
    """Script entity_ids called from a config, first mention first."""
    return _unique(
        f"script.{name}"
        for s in iter_strings(config)
        for name in _SCRIPT_RE.findall(s)
        if name not in _SCRIPT_SERVICES
    )


def scan(
    config: Any,
    get_script_config: Callable[[str], Any | None],
    *,
    _depth: int = 0,
    _seen: set[str] | None = None,
) -> list[LinkedHelper]:
    """Return the helpers an automation (or script) config uses.

    ``get_script_config`` maps a script entity_id to its raw config, or None
    when the script does not exist.
    """
    seen = _seen if _seen is not None else set()
    found: dict[str, LinkedHelper] = {
        eid: LinkedHelper(eid) for eid in find_helpers(config)
    }
    if _depth >= MAX_SCRIPT_DEPTH:
        return list(found.values())

    for script_id in find_scripts(config):
        if script_id in seen:
            continue
        seen.add(script_id)
        script_config = get_script_config(script_id)
        if script_config is None:
            continue
        for link in scan(script_config, get_script_config, _depth=_depth + 1, _seen=seen):
            # Credit the script this config calls, even when the helper sits deeper.
            found.setdefault(link.entity_id, LinkedHelper(link.entity_id, script_id))
    return list(found.values())
