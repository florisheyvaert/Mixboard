import { formatValue, lastRun, readHelper, setHelperValue } from "../helpers";
import { Icon } from "../icons";
import { shortName, type Automation, type Item } from "../model";
import type { HomeAssistant } from "../types";
import { errorText, Switch } from "../ui";

interface Props {
  hass: HomeAssistant;
  item: Item;
  onBack: () => void;
  onEdit: (entityId: string, opener: HTMLElement) => void;
  onRun: (automation: Automation, opener: HTMLElement) => void;
  onMore: (automation: Automation, opener: HTMLElement) => void;
  toast: (text: string, undo?: () => void) => void;
}

/**
 * The settings of one automation, or of every automation in a group. A group shows one block per automation,
 * each with its own settings and its own Enabled / Run now. A helper shared by several automations appears once.
 */
export function Detail({ hass, item, onBack, onEdit, onRun, onMore, toast }: Props) {
  const call = (p: Promise<unknown>) => p.catch((e) => toast(errorText(e)));
  const isGroup = item.kind === "group";
  const seen = new Set<string>();

  const block = (a: Automation) => {
    const helpers = a.helpers.filter((l) => !seen.has(l.entity_id) && !!seen.add(l.entity_id)).map((l) => readHelper(hass, l.entity_id, l.via));
    const shared = a.helpers.length - helpers.length;
    return (
      <section key={a.entityId} className="block">
        <div className="section">
          {isGroup ? shortName(a.name, item.name) : "Settings"}
          {isGroup && <span className="section-note">{a.enabled ? lastRun(a.lastTriggered) : "Off"}</span>}
        </div>
        {helpers.map((h) => {
          const note = h.via ? <span className="note">Used through {h.via}</span> : null;
          if (h.kind === "boolean") {
            return (
              <div className="set static" key={h.entityId}>
                <span className="label">{h.name}{note}</span>
                <Switch checked={h.value} label={h.name} onChange={() => call(setHelperValue(hass, h.entityId, h.value ? "off" : "on"))} />
              </div>
            );
          }
          if (h.kind === "button") {
            return (
              <button className="set" key={h.entityId}
                onClick={() => call(hass.callService("input_button", "press", {}, { entity_id: h.entityId }).then(() => toast(`${h.name} pressed`)))}>
                <span className="label">{h.name}{note}</span>
                <span className="value">Press</span>
              </button>
            );
          }
          if (h.kind === "readonly" || h.kind === "missing") {
            return (
              <div className="set static" key={h.entityId}>
                <span className="label">{h.name}{h.kind === "missing" ? <span className="note">{h.entityId} doesn't exist</span> : note}</span>
                <span className="muted">{formatValue(h)}</span>
              </div>
            );
          }
          return (
            <button className="set" key={h.entityId} onClick={(e) => onEdit(h.entityId, e.currentTarget)}>
              <span className="label">{h.name}{note}</span>
              <span className="value">{formatValue(h)}</span>
            </button>
          );
        })}
        {helpers.length === 0 && (
          <p className="d-sub small">
            {shared ? "Uses the same settings as above." : "No input helpers. Add one in Home Assistant, for example a number helper for a delay, and it shows up here."}
          </p>
        )}
        {!isGroup && <div className="section">Automation</div>}
        <div className="set static">
          <span className="label">Enabled</span>
          <Switch checked={a.enabled} label={`${a.name} enabled`}
            onChange={() => call(hass.callService("automation", a.enabled ? "turn_off" : "turn_on", {}, { entity_id: a.entityId }))} />
        </div>
        <button className="set" onClick={(e) => onRun(a, e.currentTarget)}>
          <span className="label">Run now</span>
          <span className="go"><Icon name="chevron" /></span>
        </button>
        {a.configId && (
          <button className="set" onClick={(e) => onMore(a, e.currentTarget)}>
            <span className="label">Traces and editor</span>
            <span className="go"><Icon name="chevron" /></span>
          </button>
        )}
      </section>
    );
  };

  const single = item.automations[0];
  return (
    <div className="detail">
      <button className="plain back" onClick={onBack}>
        <Icon name="back" />
        {item.category.name}
      </button>
      <h1 className="d-title">{item.name}</h1>
      <p className="d-sub">
        {isGroup ? `${item.automations.length} automations` : single.enabled ? lastRun(single.lastTriggered) : "Off"}
      </p>
      {item.automations.map(block)}
    </div>
  );
}
