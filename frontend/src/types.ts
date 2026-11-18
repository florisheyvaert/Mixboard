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
