import { formatValue, lastRun, readHelper, setHelperValue, type Helper } from "../helpers";
import { Icon } from "../icons";
import { shortName, type Automation, type Item } from "../model";
import type { HomeAssistant } from "../types";
import { errorText, Switch } from "../ui";
import { AutomationIcon } from "./EntityIcon";

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
 * Full-width page for one automation or a group. Each automation gets a clear action row
 * (Enabled, Run, More) and its settings as tiles with big values; tap a tile to change it.
 * A helper shared by several automations in a group appears once.
 */
export function Detail({ hass, item, onBack, onEdit, onRun, onMore, toast }: Props) {
  const call = (p: Promise<unknown>) => p.catch((e) => toast(errorText(e)));
  const isGroup = item.kind === "group";
  const seen = new Set<string>();
  const single = item.automations[0];

  const settingTile = (h: Helper) => {
    const via = h.via ? <span className="s-note">via {h.via}</span> : null;
    const label = <span className="s-label">{h.name}{via}</span>;
    if (h.kind === "boolean") {
      return (
        <div className="tile setting" key={h.entityId}>
          {label}
          <span className="s-row">
            <span className="s-value">{h.value ? "On" : "Off"}</span>
            <Switch checked={h.value} label={h.name} onChange={() => call(setHelperValue(hass, h.entityId, h.value ? "off" : "on"))} />
          </span>
        </div>
      );
    }
    if (h.kind === "button") {
      return (
        <button className="tile setting" key={h.entityId}
          onClick={() => call(hass.callService("input_button", "press", {}, { entity_id: h.entityId }).then(() => toast(`${h.name} pressed`)))}>
          {label}
          <span className="s-value">Press</span>
        </button>
      );
    }
    if (h.kind === "readonly" || h.kind === "missing") {
      return (
        <div className="tile setting static" key={h.entityId}>
          {label}
          <span className="s-value muted">{h.kind === "missing" ? "Not found" : formatValue(h)}</span>
        </div>
      );
    }
    return (
      <button className="tile setting" key={h.entityId} onClick={(e) => onEdit(h.entityId, e.currentTarget)}>
        {label}
        <span className="s-value">{formatValue(h)}</span>
      </button>
    );
  };

  const block = (a: Automation) => {
    const helpers = a.helpers.filter((l) => !seen.has(l.entity_id) && !!seen.add(l.entity_id)).map((l) => readHelper(hass, l.entity_id, l.via));
    const shared = a.helpers.length - helpers.length;
    return (
      <section key={a.entityId} className={`auto${a.enabled ? "" : " off"}`}>
        <div className="auto-head">
          {isGroup && (
            <div className="auto-title">
              <h2>{shortName(a.name, item.name)}</h2>
              <span className="muted">{a.enabled ? lastRun(a.lastTriggered) : "Off"}</span>
            </div>
          )}
          <div className="auto-actions">
            <label className="btn switchbtn">
              <span>{a.enabled ? "On" : "Off"}</span>
              <Switch checked={a.enabled} label={`${a.name} enabled`}
                onChange={() => call(hass.callService("automation", a.enabled ? "turn_off" : "turn_on", {}, { entity_id: a.entityId }))} />
            </label>
            <button className="btn" onClick={(e) => onRun(a, e.currentTarget)}><Icon name="play" size={18} />Run</button>
            <button className="btn" onClick={(e) => onMore(a, e.currentTarget)} aria-label={`More for ${a.name}`}><Icon name="more" size={20} />More</button>
          </div>
        </div>
        {helpers.length > 0 ? (
          <div className="grid settings">{helpers.map(settingTile)}</div>
        ) : (
          <p className="d-sub small">
            {shared ? "Uses the same settings as above." : "No settings yet. Add an input helper to this automation in Home Assistant, for example a number helper for a delay, and it shows up here."}
          </p>
        )}
      </section>
    );
  };

  return (
    <div className="detail">
      <button className="plain back" onClick={onBack}>
        <Icon name="back" />
        All automations
      </button>
      <h1 className="d-title">
        <AutomationIcon hass={hass} entityId={single.entityId} categoryIcon={item.category.icon} size={30} />
        {item.name}
      </h1>
      <p className="d-sub">
        {item.category.name}
        {" · "}
        {isGroup ? `${item.automations.length} automations` : single.enabled ? lastRun(single.lastTriggered) : "Off"}
      </p>
      {item.automations.map(block)}
    </div>
  );
}
