/**
 * A fake Home Assistant for `npm run dev`: states, services and the mixboard/* websocket commands,
 * shaped like the real thing. Modeled on real setups: shutters on sunset/sunrise with a delay helper,
 * hall lights with a night brightness, plus edge cases (disabled, via a script, no helpers, missing helper).
 */
import type { AutomationInfo, HassEntity, HomeAssistant, Layout, Profile } from "../types";

const ago = (days: number, h: number, m: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

function entity(entity_id: string, state: string, attributes: Record<string, unknown>): HassEntity {
  return { entity_id, state, attributes, last_changed: new Date().toISOString() };
}

const initialStates: HassEntity[] = [
  entity("automation.sunset_shutters", "on", { friendly_name: "Sunset shutters", id: "1001", last_triggered: ago(0, 18, 42) }),
  entity("automation.sunrise_shutters", "on", { friendly_name: "Sunrise shutters", id: "1002", last_triggered: ago(0, 7, 55) }),
  entity("automation.bedroom_blackout", "off", { friendly_name: "Bedroom blackout", id: "1003", last_triggered: ago(3, 21, 30) }),
  entity("automation.hall_night_mode", "on", { friendly_name: "Gang - Nachtmodus", id: "1004", last_triggered: ago(1, 23, 0) }),
  entity("automation.hall_day_brightness", "on", { friendly_name: "Gang - Dagmodus", id: "1005", last_triggered: ago(0, 6, 30) }),
  entity("automation.garden_path", "on", { friendly_name: "Garden path", id: "1006", last_triggered: ago(1, 17, 21) }),
  entity("automation.bathroom_fan", "on", { friendly_name: "Bathroom fan", id: "1007", last_triggered: ago(0, 8, 12) }),
  entity("automation.washing_machine_done", "on", { friendly_name: "Washing machine done", id: "1008", last_triggered: ago(2, 14, 3) }),
  entity("automation.front_door_left_open", "on", { friendly_name: "Front door left open", last_triggered: null }),

  entity("input_number.shutters_sunset_delay", "30.0", { friendly_name: "Wait after sunset", min: 0, max: 120, step: 5, unit_of_measurement: "min", mode: "slider" }),
  entity("input_boolean.shutters_close_all", "on", { friendly_name: "Close every shutter" }),
  entity("input_select.shutters_mode", "Normal", { friendly_name: "Shutter mode", options: ["Normal", "Storm", "Holiday"] }),
  entity("input_number.shutters_sunrise_delay", "10.0", { friendly_name: "Wait after sunrise", min: 0, max: 120, step: 5, unit_of_measurement: "min" }),
  entity("input_datetime.shutters_earliest_open", "07:30:00", { friendly_name: "Never open before", has_date: false, has_time: true }),
  entity("input_datetime.bedroom_blackout_time", "21:30:00", { friendly_name: "Close at", has_date: false, has_time: true }),
  entity("input_number.hall_night_brightness", "20.0", { friendly_name: "Night brightness", min: 1, max: 100, step: 1, unit_of_measurement: "%" }),
  entity("input_datetime.hall_night_start", "23:00:00", { friendly_name: "Night starts at", has_date: false, has_time: true }),
  entity("input_datetime.hall_night_end", "06:30:00", { friendly_name: "Night ends at", has_date: false, has_time: true }),
  entity("input_number.hall_day_brightness", "80.0", { friendly_name: "Day brightness", min: 1, max: 100, step: 1, unit_of_measurement: "%" }),
  entity("input_number.garden_sunset_offset", "15.0", { friendly_name: "Turn on after sunset", min: 0, max: 60, step: 5, unit_of_measurement: "min" }),
  entity("input_datetime.garden_off_time", "22:00:00", { friendly_name: "Turn off at", has_date: false, has_time: true }),
  entity("input_number.bath_humidity_threshold", "65.0", { friendly_name: "Start above humidity", min: 40, max: 90, step: 1, unit_of_measurement: "%" }),
  entity("input_number.bath_fan_runon", "10.0", { friendly_name: "Keep running for", min: 0, max: 30, step: 1, unit_of_measurement: "min" }),
  entity("input_datetime.hall_day_start", "06:30:00", { friendly_name: "Day starts at", has_date: false, has_time: true }),
  entity("light.gang", "on", { friendly_name: "Gang", brightness: 51 }),
  entity("light.living_room", "off", { friendly_name: "Living room" }),
  entity("switch.coffee_machine", "off", { friendly_name: "Coffee machine" }),
  entity("cover.living_room", "open", { friendly_name: "Living room shutter", current_position: 100 }),
  entity("script.good_night", "off", { friendly_name: "Good night" }),
  entity("sensor.outdoor_temperature", "7.4", { friendly_name: "Outdoor temperature", unit_of_measurement: "°C" }),
  entity("input_text.washer_message", "The washing machine is done", { friendly_name: "Message", min: 0, max: 100 }),
  entity("input_button.washer_test", "unknown", { friendly_name: "Send a test message" }),
];

const covers = { id: "covers", name: "Covers", icon: "mdi:window-shutter" };
const lighting = { id: "lighting", name: "Lighting", icon: "mdi:lightbulb" };
const climate = { id: "climate", name: "Climate", icon: "mdi:fan" };
const link = (entity_id: string, via: string | null = null) => ({ entity_id, via });

const automations: AutomationInfo[] = [
  { entity_id: "automation.sunset_shutters", config_id: "1001", category: covers, helpers: [link("input_number.shutters_sunset_delay"), link("input_boolean.shutters_close_all"), link("input_select.shutters_mode")] },
  { entity_id: "automation.sunrise_shutters", config_id: "1002", category: covers, helpers: [link("input_number.shutters_sunrise_delay"), link("input_datetime.shutters_earliest_open"), link("input_select.shutters_mode", "script.shutters_open")] },
  { entity_id: "automation.bedroom_blackout", config_id: "1003", category: covers, helpers: [link("input_datetime.bedroom_blackout_time")] },
  { entity_id: "automation.hall_night_mode", config_id: "1004", category: lighting, helpers: [link("input_number.hall_night_brightness"), link("input_datetime.hall_night_start"), link("input_datetime.hall_night_end")] },
  { entity_id: "automation.hall_day_brightness", config_id: "1005", category: lighting, helpers: [link("input_number.hall_day_brightness"), link("input_datetime.hall_day_start")] },
  { entity_id: "automation.garden_path", config_id: "1006", category: lighting, helpers: [link("input_number.garden_sunset_offset"), link("input_datetime.garden_off_time"), link("input_number.garden_removed")] },
  { entity_id: "automation.bathroom_fan", config_id: "1007", category: climate, helpers: [link("input_number.bath_humidity_threshold"), link("input_number.bath_fan_runon")] },
  { entity_id: "automation.washing_machine_done", config_id: "1008", category: null, helpers: [link("input_text.washer_message"), link("input_button.washer_test")] },
  { entity_id: "automation.front_door_left_open", config_id: null, category: null, helpers: [] },
];

let layout: Layout = { groups: [], hidden: [], favorites: [] };

let profiles: Profile[] = [
  { id: "p1", name: "Summer", values: { "input_number.shutters_sunset_delay": "15.0", "input_number.shutters_sunrise_delay": "0.0", "input_number.garden_sunset_offset": "30.0", "input_datetime.hall_night_start": "23:30:00" } },
  { id: "p2", name: "Autumn", values: { "input_number.shutters_sunset_delay": "30.0", "input_number.shutters_sunrise_delay": "10.0", "input_number.garden_sunset_offset": "15.0", "input_datetime.hall_night_start": "23:00:00" } },
];

const wait = () => new Promise((r) => setTimeout(r, 120));

export function createMockHass(onChange: (hass: HomeAssistant) => void): HomeAssistant {
  let states: Record<string, HassEntity> = Object.fromEntries(initialStates.map((e) => [e.entity_id, e]));

  const setState = (entityId: string, state: string, attrs: Record<string, unknown> = {}) => {
    const old = states[entityId];
    if (!old) throw new Error(`Entity ${entityId} not found`);
    states = { ...states, [entityId]: { ...old, state, attributes: { ...old.attributes, ...attrs }, last_changed: new Date().toISOString() } };
    publish();
  };

  const callService: HomeAssistant["callService"] = async (domain, service, data = {}, target = {}) => {
    await wait();
    const id = String(target.entity_id ?? data.entity_id ?? "");
    console.info("[mock] service", `${domain}.${service}`, data, id);
    if (domain === "input_number" && service === "set_value") return setState(id, Number(data.value).toFixed(1));
    if (domain === "input_boolean") return setState(id, service === "turn_on" ? "on" : "off");
    if (domain === "input_select") return setState(id, String(data.option));
    if (domain === "input_text") return setState(id, String(data.value));
    if (domain === "input_datetime") return setState(id, String(data.time ?? data.datetime ?? data.date));
    if (domain === "input_button") return setState(id, new Date().toISOString());
    if (domain === "automation" && (service === "turn_on" || service === "turn_off")) return setState(id, service === "turn_on" ? "on" : "off");
    if (service === "toggle") {
      const on = ["on", "open"].includes(states[id].state);
      return setState(id, domain === "cover" ? (on ? "closed" : "open") : on ? "off" : "on");
    }
    if (["script", "scene"].includes(domain) && service === "turn_on") return;
    if (domain === "automation" && service === "trigger") return setState(id, states[id].state, { last_triggered: new Date().toISOString() });
    throw new Error(`Mock has no service ${domain}.${service}`);
  };

  const callWS = async <T,>(msg: { type: string } & Record<string, unknown>): Promise<T> => {
    await wait();
    switch (msg.type) {
      case "mixboard/automations": return { automations } as T;
      case "mixboard/profiles": return { profiles } as T;
      case "mixboard/profiles/save": {
        const p: Profile = { id: `p${Date.now()}`, name: String(msg.name), values: msg.values as Record<string, string> };
        profiles = [...profiles, p];
        return { profile: p } as T;
      }
      case "mixboard/layout": return { layout } as T;
      case "mixboard/layout/save": layout = msg.layout as Layout; return { layout } as T;
      case "mixboard/profiles/delete": profiles = profiles.filter((p) => p.id !== msg.profile_id); return null as T;
    }
    throw new Error(`Mock has no websocket command ${msg.type}`);
  };

  const make = (): HomeAssistant => ({
    states,
    callService,
    callWS,
    connection: { subscribeEvents: async () => () => {} },
  });
  const publish = () => onChange(make());
  return make();
}
