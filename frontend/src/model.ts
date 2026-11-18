import type { AutomationInfo, Category, HomeAssistant, LinkedHelper } from "./types";

export interface Automation {
  entityId: string;
  name: string;
  enabled: boolean;
  lastTriggered: unknown;
  configId: string | null;
  category: Category | null;
  helpers: LinkedHelper[];
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

/** Categories in name order, with uncategorized automations last under "Other". */
export function categoriesOf(automations: Automation[]): Category[] {
  const map = new Map<string, Category>();
  let other = false;
  for (const a of automations) {
    if (a.category) map.set(a.category.id, a.category);
    else other = true;
  }
  const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  return other ? [...list, OTHER] : list;
}

export const categoryId = (a: Automation) => a.category?.id ?? OTHER.id;

/** Navigate inside the Home Assistant frontend. */
export function navigate(path: string) {
  history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}
