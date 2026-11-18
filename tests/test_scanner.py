"""Tests for the helper scanner, on configs shaped like real automations."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys

# Load scanner.py directly so the tests need no Home Assistant install.
_SPEC = importlib.util.spec_from_file_location(
    "mixboard_scanner",
    Path(__file__).parents[1] / "custom_components" / "mixboard" / "scanner.py",
)
scanner = importlib.util.module_from_spec(_SPEC)
sys.modules["mixboard_scanner"] = scanner
_SPEC.loader.exec_module(scanner)

LinkedHelper = scanner.LinkedHelper

SUNSET_SHUTTERS = {
    "id": "1700000000001",
    "alias": "Sunset shutters",
    "triggers": [{"trigger": "sun", "event": "sunset"}],
    "conditions": [{"condition": "state", "entity_id": "input_boolean.shutters_close_all", "state": "on"}],
    "actions": [
        {"delay": {"minutes": "{{ states('input_number.shutters_sunset_delay') | int }}"}},
        {"action": "cover.close_cover", "target": {"entity_id": "cover.living_room"}},
        {"action": "script.turn_on", "target": {"entity_id": "script.shutters_mode_check"}},
    ],
}

HALL_NIGHT = {
    "alias": "Hall night mode",
    "triggers": [
        {"trigger": "time", "at": "input_datetime.hall_night_start"},
        {"trigger": "time", "at": "input_datetime.hall_night_end"},
    ],
    "actions": [
        {
            "action": "light.turn_on",
            "target": {"entity_id": "light.hall"},
            "data": {"brightness_pct": "{{ states.input_number.hall_night_brightness.state }}"},
        }
    ],
}

SCRIPTS = {
    "script.shutters_mode_check": {
        "sequence": [
            {"condition": "state", "entity_id": "input_select.shutters_mode", "state": "Normal"},
            {"action": "script.shutters_close_all"},
        ]
    },
    "script.shutters_close_all": {
        "sequence": [{"delay": "{{ states('input_number.shutters_stagger') }}"}]
    },
}


def no_scripts(_entity_id):
    return None


def test_finds_entity_id_template_and_condition_helpers():
    found = scanner.scan(SUNSET_SHUTTERS, no_scripts)
    assert [h.entity_id for h in found] == [
        "input_boolean.shutters_close_all",
        "input_number.shutters_sunset_delay",
    ]
    assert all(h.via is None for h in found)


def test_finds_time_triggers_and_states_dot_templates():
    found = [h.entity_id for h in scanner.scan(HALL_NIGHT, no_scripts)]
    assert found == [
        "input_datetime.hall_night_start",
        "input_datetime.hall_night_end",
        "input_number.hall_night_brightness",
    ]


def test_follows_scripts_and_marks_where_the_helper_came_from():
    found = scanner.scan(SUNSET_SHUTTERS, SCRIPTS.get)
    assert LinkedHelper("input_select.shutters_mode", "script.shutters_mode_check") in found
    # Found two scripts deep; still credited to the script the automation calls.
    assert LinkedHelper("input_number.shutters_stagger", "script.shutters_mode_check") in found


def test_direct_reference_wins_over_script_reference():
    config = {
        "actions": [
            {"action": "script.shutters_mode_check"},
            {"condition": "state", "entity_id": "input_select.shutters_mode", "state": "Storm"},
        ]
    }
    found = scanner.scan(config, SCRIPTS.get)
    assert LinkedHelper("input_select.shutters_mode", None) in found


def test_script_service_names_are_not_scripts():
    config = {"actions": [{"service": "script.turn_on", "entity_id": "script.reload_me"}, {"action": "script.toggle"}]}
    assert scanner.find_scripts(config) == ["script.reload_me"]


def test_ignores_lookalikes_and_other_domains():
    config = {
        "actions": [
            {"entity_id": "sensor.input_number_backup"},
            {"entity_id": "light.input_boolean"},
            {"data": {"message": "my_input_number.x is not a helper"}},
        ]
    }
    assert scanner.find_helpers(config) == []


def test_blueprint_inputs_are_scanned():
    config = {
        "use_blueprint": {
            "path": "covers/sun.yaml",
            "input": {"delay_helper": "input_number.shutters_sunrise_delay", "cover": "cover.all"},
        }
    }
    assert scanner.find_helpers(config) == ["input_number.shutters_sunrise_delay"]


def test_script_cycles_terminate():
    scripts = {"script.a": {"sequence": [{"action": "script.b"}]}, "script.b": {"sequence": [{"action": "script.a"}, {"entity_id": "counter.loops"}]}}
    found = scanner.scan({"actions": [{"action": "script.a"}]}, scripts.get)
    assert found == [LinkedHelper("counter.loops", "script.a")]


def test_no_helpers_gives_empty_list():
    assert scanner.scan({"actions": [{"action": "notify.mobile_app", "data": {"message": "Done"}}]}, no_scripts) == []
