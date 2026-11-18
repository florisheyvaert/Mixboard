import { formatValue, lastRun, readHelper, setHelperValue } from "../helpers";
import { Icon } from "../icons";
import { navigate, OTHER, type Automation } from "../model";
import type { HomeAssistant } from "../types";
import { errorText, Switch } from "../ui";

interface Props {
  hass: HomeAssistant;
  automation: Automation;
  onBack: () => void;
  onEdit: (entityId: string, opener: HTMLElement) => void;
  onRun: (opener: HTMLElement) => void;
  toast: (text: string, undo?: () => void) => void;
}

/** A list of settings; tapping one opens a sheet with its control. */
export function Detail({ hass, automation: a, onBack, onEdit, onRun, toast }: Props) {
  const helpers = a.helpers.map((l) => readHelper(hass, l.entity_id, l.via));
  const call = (p: Promise<unknown>) => p.catch((e) => toast(errorText(e)));

  return (
    <>
      <button className="plain back" onClick={onBack}>
        <Icon name="back" />
        {(a.category ?? OTHER).name}
      </button>
      <h1 className="d-title">{a.name}</h1>
      <p className="d-sub">{a.enabled ? lastRun(a.lastTriggered) : "Off"}</p>

      {helpers.length > 0 ? (
        <>
          <div className="section">Settings</div>
          {helpers.map((h) => {
            const note = h.via ? <span className="note">Used through {h.via}</span> : null;
            if (h.kind === "boolean") {
              return (
                <div className="set static" key={h.entityId}>
                  <span className="label">{h.name}{note}</span>
                  <Switch
                    checked={h.value}
                    label={h.name}
                    onChange={() => call(setHelperValue(hass, h.entityId, h.value ? "off" : "on"))}
                  />
                </div>
              );
            }
            if (h.kind === "button") {
              return (
                <button
                  className="set"
                  key={h.entityId}
                  onClick={() => call(hass.callService("input_button", "press", {}, { entity_id: h.entityId }).then(() => toast(`${h.name} pressed`)))}
                >
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
        </>
      ) : (
        <p className="d-sub spaced">
          This automation doesn't use any input helpers. Add one in Home Assistant, for example a number helper for a delay,
          and it shows up here.
        </p>
      )}

      <div className="section">Automation</div>
      <div className="set static">
        <span className="label">Enabled</span>
        <Switch
          checked={a.enabled}
          label="Enabled"
          onChange={() => call(hass.callService("automation", a.enabled ? "turn_off" : "turn_on", {}, { entity_id: a.entityId }))}
        />
      </div>
      <button className="set" onClick={(e) => onRun(e.currentTarget)}>
        <span className="label">Run now</span>
        <span className="go"><Icon name="chevron" /></span>
      </button>
      {a.configId && (
        <>
          <button className="set" onClick={() => navigate(`/config/automation/trace/${a.configId}`)}>
            <span className="label">Traces</span>
            <span className="go"><Icon name="external" size={18} /></span>
          </button>
          <button className="set" onClick={() => navigate(`/config/automation/edit/${a.configId}`)}>
            <span className="label">Edit in Home Assistant</span>
            <span className="go"><Icon name="external" size={18} /></span>
          </button>
        </>
      )}
    </>
  );
}
