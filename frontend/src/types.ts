/** The slice of Home Assistant's frontend `hass` object that Mixboard uses. */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: Record<string, unknown>,
  ): Promise<unknown>;
  callWS<T>(msg: { type: string } & Record<string, unknown>): Promise<T>;
  /** Service descriptions per domain, as Home Assistant's frontend provides them. */
  services?: Record<string, Record<string, ServiceInfo>>;
  connection: {
    subscribeEvents(callback: (event: unknown) => void, eventType: string): Promise<() => void>;
  };
}

/** Returned by the `mixboard/automations` websocket command. */
export interface LinkedHelper {
  entity_id: string;
  via: string | null;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
}

export interface AutomationInfo {
  entity_id: string;
  config_id: string | null;
  category: Category | null;
  helpers: LinkedHelper[];
}

export interface Profile {
  id: string;
  name: string;
  values: Record<string, string>;
}

/** Home page layout, stored by the backend (`mixboard/layout`). */
export interface AutomationGroup {
  id: string;
  name: string;
  automations: string[];
}

export interface ServiceField {
  name?: string;
  description?: string;
  required?: boolean;
  example?: unknown;
  default?: unknown;
  selector?: Record<string, unknown> | null;
  /** Newer HA groups advanced fields in collapsible sections. */
  fields?: Record<string, ServiceField>;
}

export interface ServiceInfo {
  name?: string;
  description?: string;
  fields: Record<string, ServiceField>;
}

/** What tapping an entity favorite does. */
export type FavoriteAction =
  | { kind: "more-info" }
  | { kind: "toggle" }
  | { kind: "service"; service: string; data?: Record<string, unknown> };

export interface Favorite {
  type: "entity" | "automation" | "group";
  id: string;
  action?: FavoriteAction;
  /** Display name for an entity favorite. */
  name?: string;
}

export interface Layout {
  groups: AutomationGroup[];
  /** Item keys: an automation entity_id or `group:<id>`. */
  hidden: string[];
  favorites: Favorite[];
  /** Display names in Mixboard for automations, by entity_id. */
  names?: Record<string, string>;
}
