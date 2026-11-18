/**
 * Actions for entity favorites. Built on the service descriptions Home Assistant itself publishes
 * (`hass.services`), so every entity class works: lights, switches, buttons, covers, climate, media players…
 */
import type { FavoriteAction, HomeAssistant, ServiceField, ServiceInfo } from "./types";

const TOGGLE_STATES = new Set(["on", "open", "opening", "playing", "heat", "cool", "heat_cool", "auto", "dry", "fan_only", "unlocked"]);
const SKIP_SERVICES = new Set(["reload"]);

export const domainOf = (entityId: string) => entityId.split(".")[0];

const humanize = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Services of the entity's domain, as Home Assistant describes them. */
export function servicesFor(hass: HomeAssistant, entityId: string): [string, ServiceInfo][] {
  const all = hass.services?.[domainOf(entityId)] ?? {};
  return Object.entries(all)
    .filter(([name]) => !SKIP_SERVICES.has(name))
    .sort(([a], [b]) => a.localeCompare(b));
}

export const canToggle = (hass: HomeAssistant, entityId: string) => !!hass.services?.[domainOf(entityId)]?.toggle;

/** Fields of a service, with collapsible sections flattened and the entity target left out. */
export function fieldsOf(info: ServiceInfo | undefined): [string, ServiceField][] {
  const out: [string, ServiceField][] = [];
  const walk = (fields: Record<string, ServiceField> = {}) => {
    for (const [key, f] of Object.entries(fields)) {
      if (f.fields) walk(f.fields);
      else if (key !== "entity_id") out.push([key, f]);
    }
  };
  walk(info?.fields);
  return out;
}

export function serviceName(hass: HomeAssistant, entityId: string, service: string): string {
  return hass.services?.[domainOf(entityId)]?.[service]?.name || humanize(service);
}

/** What a tap does when the user didn't choose: toggle what can toggle, press buttons, run scripts, else details. */
export function defaultAction(hass: HomeAssistant, entityId: string): FavoriteAction {
  const domain = domainOf(entityId);
  if (domain === "button" || domain === "input_button") return { kind: "service", service: "press" };
  if (domain === "script" || domain === "scene") return { kind: "service", service: "turn_on" };
  if (canToggle(hass, entityId)) return { kind: "toggle" };
  return { kind: "more-info" };
}

function formatData(hass: HomeAssistant, entityId: string, service: string, data: Record<string, unknown> = {}): string {
  const fields = Object.fromEntries(fieldsOf(hass.services?.[domainOf(entityId)]?.[service]));
  const entries = Object.entries(data);
  return entries
    .map(([k, v]) => {
      const sel = fields[k]?.selector as { number?: { unit_of_measurement?: string } } | undefined;
      const u = k.endsWith("_pct") ? "%" : sel?.number?.unit_of_measurement ?? "";
      const value = `${typeof v === "object" ? JSON.stringify(v) : String(v)}${u === "%" ? "%" : u ? ` ${u}` : ""}`;
      // One value reads best on its own ("Set position · 40%"); several need their names.
      return entries.length === 1 ? value : `${(fields[k]?.name || humanize(k)).toLowerCase()} ${value}`;
    })
    .join(", ");
}

export function actionLabel(hass: HomeAssistant, entityId: string, action: FavoriteAction): string {
  if (action.kind === "more-info") return "Open details";
  if (action.kind === "toggle") return "Toggle";
  const data = formatData(hass, entityId, action.service, action.data);
  return data ? `${serviceName(hass, entityId, action.service)} · ${data}` : serviceName(hass, entityId, action.service);
}

export function isOn(hass: HomeAssistant, entityId: string): boolean {
  const st = hass.states[entityId]?.state;
  if (!st) return false;
  return domainOf(entityId) === "climate" ? st !== "off" : TOGGLE_STATES.has(st);
}

export function runAction(hass: HomeAssistant, entityId: string, action: FavoriteAction): Promise<unknown> {
  const target = { entity_id: entityId };
  if (action.kind === "toggle") return hass.callService(domainOf(entityId), "toggle", {}, target);
  if (action.kind === "service") return hass.callService(domainOf(entityId), action.service, action.data ?? {}, target);
  return Promise.resolve();
}

/* ── Turning form input into service data ──────────────────── */
export type FieldKind = "number" | "boolean" | "select" | "text";

export function fieldKind(f: ServiceField): FieldKind {
  const sel = f.selector ?? {};
  if ("number" in sel) return "number";
  if ("boolean" in sel) return "boolean";
  if ("select" in sel) return "select";
  return "text";
}

export function selectOptions(f: ServiceField): { value: string; label: string }[] {
  const opts = ((f.selector?.select as { options?: unknown[] } | undefined)?.options ?? []) as (string | { value: string; label: string })[];
  return opts.map((o) => (typeof o === "string" ? { value: o, label: humanize(o) } : o));
}

/** Parse what was typed: numbers stay numbers, JSON lists/objects are parsed, the rest stays text. */
export function parseInput(kind: FieldKind, raw: string | boolean): unknown {
  if (kind === "boolean") return raw === true;
  const s = String(raw).trim();
  if (kind === "number") return Number(s);
  if (/^[[{]/.test(s)) {
    try { return JSON.parse(s); } catch { /* keep as text */ }
  }
  return s;
}
