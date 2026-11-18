import type { AutomationGroup, AutomationInfo, Category, Favorite, HomeAssistant, Layout, LinkedHelper } from "./types";

export interface Automation {
  entityId: string;
  name: string;
  enabled: boolean;
  lastTriggered: unknown;
  configId: string | null;
  category: Category | null;
  helpers: LinkedHelper[];
  /** Set when the automation has a Mixboard display name. */
  haName?: string;
}

/** Join what the backend found with the live entity state. */
export function toAutomations(hass: HomeAssistant, infos: AutomationInfo[]): Automation[] {
  return infos
    .map((info) => {
      const st = hass.states[info.entity_id];
      return {
        entityId: info.entity_id,
        name: String(st?.attributes.friendly_name ?? info.entity_id),
        enabled: st?.state === "on",
        lastTriggered: st?.attributes.last_triggered,
        configId: info.config_id ?? (st?.attributes.id as string | undefined) ?? null,
        category: info.category,
        helpers: info.helpers,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const OTHER: Category = { id: "__other__", name: "Other", icon: null };
export const EMPTY_LAYOUT: Layout = { groups: [], hidden: [], favorites: [], names: {} };

/** One tile on the home page: a single automation or a user-made group of automations. */
export type Item =
  | { kind: "automation"; key: string; name: string; automations: [Automation]; category: Category }
  | { kind: "group"; key: string; name: string; automations: Automation[]; category: Category; group: AutomationGroup };

export const groupKey = (id: string) => `group:${id}`;

/** Automations with their Mixboard display name applied (HA's own name stays in `haName`). */
export function applyNames(automations: Automation[], names: Record<string, string> = {}): Automation[] {
  return automations.map((a) => (names[a.entityId] ? { ...a, haName: a.name, name: names[a.entityId] } : a));
}

export function buildItems(all: Automation[], layout: Layout): Item[] {
  const automations = applyNames(all, layout.names);
  const byId = new Map(automations.map((a) => [a.entityId, a]));
  const grouped = new Set<string>();
  const items: Item[] = [];
  for (const g of layout.groups) {
    const members = g.automations.map((id) => byId.get(id)).filter((a): a is Automation => !!a);
    if (!members.length) continue;
    members.forEach((m) => grouped.add(m.entityId));
    items.push({ kind: "group", key: groupKey(g.id), name: g.name, automations: members, category: members[0].category ?? OTHER, group: g });
  }
  for (const a of automations) {
    if (!grouped.has(a.entityId)) items.push({ kind: "automation", key: a.entityId, name: a.name, automations: [a], category: a.category ?? OTHER });
  }
  return items.sort((x, y) => x.name.localeCompare(y.name));
}

export const favoriteKey = (f: Favorite) => (f.type === "group" ? groupKey(f.id) : f.id);

export function itemFavorite(item: Item): Favorite {
  return item.kind === "group" ? { type: "group", id: item.group.id } : { type: "automation", id: item.key };
}

/** Values of every helper in an item, deduplicated, as plain text. */
export function itemHelpers(item: Item): LinkedHelper[] {
  const seen = new Set<string>();
  return item.automations.flatMap((a) => a.helpers).filter((h) => !seen.has(h.entity_id) && !!seen.add(h.entity_id));
}

/** "Gang - Nachtmodus" inside group "Gang" reads as "Nachtmodus". */
export function shortName(name: string, groupName: string): string {
  const m = name.match(new RegExp(`^${groupName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[-–:|/]\\s*(.+)$`, "i"));
  return m ? m[1] : name;
}

/** The shared start of names like "Gang - Dagmodus" and "Gang - Nachtmodus" → "Gang". */
export function commonPrefix(names: string[]): string {
  if (!names.length) return "";
  const firstParts = names.map((n) => n.split(/\s*[-–:|/]\s*/)[0].trim());
  return firstParts.every((p) => p.toLowerCase() === firstParts[0].toLowerCase()) && firstParts[0] !== names[0] ? firstParts[0] : "";
}

export function categoriesOf(items: Item[]): Category[] {
  const map = new Map<string, Category>();
  for (const i of items) map.set(i.category.id, i.category);
  return [...map.values()].sort((a, b) => (a.id === OTHER.id ? 1 : b.id === OTHER.id ? -1 : a.name.localeCompare(b.name)));
}

/** Navigate inside the Home Assistant frontend. */
export function navigate(path: string) {
  history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}

/* ── Plain Home Assistant entities as favorites ─────────────── */
export function entityState(hass: HomeAssistant, entityId: string): string {
  const st = hass.states[entityId];
  if (!st) return "Not found";
  const a = st.attributes;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
  if (st.state === "unavailable") return "Unavailable";
  if (entityId.startsWith("light.") && st.state === "on" && typeof a.brightness === "number") {
    return `On · ${Math.round((a.brightness / 255) * 100)}%`;
  }
  if (entityId.startsWith("cover.") && typeof a.current_position === "number" && st.state === "open") {
    return `Open · ${a.current_position}%`;
  }
  if (entityId.startsWith("climate.") && typeof a.temperature === "number") return `${cap(st.state)} · ${a.temperature}°`;
  if (["script.", "scene.", "button.", "input_button."].some((p) => entityId.startsWith(p))) return "";
  const unit = a.unit_of_measurement ? ` ${a.unit_of_measurement}` : "";
  return /^-?\d/.test(st.state) ? `${st.state}${unit}` : cap(st.state);
}

export const entityName = (hass: HomeAssistant, entityId: string) =>
  String(hass.states[entityId]?.attributes.friendly_name ?? entityId);
