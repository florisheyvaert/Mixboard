import type { HomeAssistant } from "./types";

/** A helper entity, read from its state and attributes into what the UI needs. */
interface Base {
  entityId: string;
  name: string;
  via: string | null;
}
export type Helper = Base &
  (
    | { kind: "number"; value: number; min: number; max: number; step: number; unit: string }
    | { kind: "boolean"; value: boolean }
    | { kind: "select"; value: string; options: string[] }
    | { kind: "time" | "date" | "datetime"; value: string }
    | { kind: "text"; value: string; min: number; max: number }
    | { kind: "button" }
    | { kind: "readonly"; value: string }
    | { kind: "missing" }
  );

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function readHelper(hass: HomeAssistant, entityId: string, via: string | null = null): Helper {
  const st = hass.states[entityId];
  const domain = entityId.split(".")[0];
  const base: Base = { entityId, via, name: String(st?.attributes.friendly_name ?? entityId) };
  if (!st) return { ...base, kind: "missing" };
  const a = st.attributes;
  switch (domain) {
    case "input_number":
      return {
        ...base, kind: "number", value: Number(st.state),
        min: num(a.min, 0), max: num(a.max, 100), step: num(a.step, 1), unit: String(a.unit_of_measurement ?? ""),
      };
    case "input_boolean":
      return { ...base, kind: "boolean", value: st.state === "on" };
    case "input_select":
      return { ...base, kind: "select", value: st.state, options: (a.options as string[]) ?? [] };
    case "input_datetime": {
      const kind = a.has_date && a.has_time ? "datetime" : a.has_date ? "date" : "time";
      return { ...base, kind, value: st.state };
    }
    case "input_text":
      return { ...base, kind: "text", value: st.state, min: num(a.min, 0), max: num(a.max, 255) };
    case "input_button":
      return { ...base, kind: "button" };
    default:
      return { ...base, kind: "readonly", value: st.state };
  }
}

const MINUTES = new Set(["min", "mins", "minute", "minutes", "minuten", "m"]);
const SECONDS = new Set(["s", "sec", "secs", "seconds", "seconden"]);

function decimals(step: number) {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

export function formatNumber(h: Extract<Helper, { kind: "number" }>, v: number = h.value): string {
  if (!Number.isFinite(v)) return "Unknown";
  const unit = h.unit.trim();
  if (MINUTES.has(unit.toLowerCase()) && v >= 60 && Number.isInteger(v)) {
    const m = v % 60;
    return `${Math.floor(v / 60)} h${m ? ` ${m} min` : ""}`;
  }
  if (SECONDS.has(unit.toLowerCase()) && v >= 60 && Number.isInteger(v)) {
    const s = v % 60;
    return `${Math.floor(v / 60)} min${s ? ` ${s} s` : ""}`;
  }
  const n = v.toFixed(decimals(h.step));
  if (!unit) return n;
  return unit === "%" ? `${n}%` : `${n} ${unit}`;
}

const hhmm = (v: string) => v.slice(0, 5);

export function formatValue(h: Helper): string {
  switch (h.kind) {
    case "number": return formatNumber(h);
    case "boolean": return h.value ? "On" : "Off";
    case "time": return hhmm(h.value);
    case "datetime": return `${h.value.slice(0, 10)} ${hhmm(h.value.slice(11))}`;
    case "date": case "select": case "text": case "readonly": return h.value;
    case "button": return "Press";
    case "missing": return "Not found";
  }
}

/** Format a raw state string (for example a value from before an edit) the way the helper shows it. */
export function formatState(hass: HomeAssistant, entityId: string, state: string): string {
  const st = hass.states[entityId];
  if (!st) return state;
  return formatValue(readHelper({ ...hass, states: { [entityId]: { ...st, state } } }, entityId));
}

/** A few sensible one-tap values for a number helper, or none. */
export function quickValues(h: Extract<Helper, { kind: "number" }>): number[] {
  const unit = h.unit.toLowerCase();
  const candidates = MINUTES.has(unit) ? (h.max <= 30 ? [0, 5, 10, 15, 20, 30] : [0, 15, 30, 45, 60, 90, 120])
    : SECONDS.has(unit) ? [0, 10, 30, 60, 120, 300]
    : unit === "%" ? [5, 10, 20, 50, 80, 100]
    : [];
  return candidates
    .filter((c) => c >= h.min && c <= h.max && Math.abs(((c - h.min) / h.step) % 1) < 1e-9)
    .slice(0, 5);
}

export function clampNumber(h: Extract<Helper, { kind: "number" }>, v: number): number {
  const stepped = h.min + Math.round((v - h.min) / h.step) * h.step;
  return Number(Math.min(h.max, Math.max(h.min, stepped)).toFixed(decimals(h.step)));
}

export function shiftTime(value: string, minutes: number): string {
  const [hh, mm] = value.split(":").map(Number);
  const t = ((((hh || 0) * 60 + (mm || 0) + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}:00`;
}

/** Write a value to a helper through its own service. `value` is in the helper's state format. */
export function setHelperValue(hass: HomeAssistant, entityId: string, value: string): Promise<unknown> {
  const domain = entityId.split(".")[0];
  const target = { entity_id: entityId };
  switch (domain) {
    case "input_number": return hass.callService(domain, "set_value", { value: Number(value) }, target);
    case "input_boolean": return hass.callService(domain, value === "on" ? "turn_on" : "turn_off", {}, target);
    case "input_select": return hass.callService(domain, "select_option", { option: value }, target);
    case "input_text": return hass.callService(domain, "set_value", { value }, target);
    case "input_datetime": {
      const st = hass.states[entityId]?.attributes ?? {};
      const data = st.has_date && st.has_time ? { datetime: value } : st.has_date ? { date: value } : { time: value };
      return hass.callService(domain, "set_datetime", data, target);
    }
    default: return Promise.resolve();
  }
}

export function lastRun(iso: unknown, now = new Date()): string {
  if (typeof iso !== "string" || !iso) return "Never ran";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never ran";
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff <= 0) return `Last ran today at ${time}`;
  if (diff === 1) return `Last ran yesterday at ${time}`;
  if (diff < 7) return `Last ran ${diff} days ago`;
  return `Last ran on ${d.toLocaleDateString()}`;
}
