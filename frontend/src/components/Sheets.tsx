import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  clampNumber, formatNumber, formatState, quickValues, readHelper, setHelperValue, shiftTime,
  type Helper,
} from "../helpers";
import { Icon } from "../icons";
import type { Automation } from "../model";
import {
  actionLabel, canToggle, fieldKind, fieldsOf, parseInput, selectOptions, serviceName, servicesFor, type FieldKind,
} from "../actions";
import type { FavoriteAction, HomeAssistant } from "../types";
import { errorText } from "../ui";
import { EntityIcon } from "./EntityIcon";

/** Bottom sheet on phones, centered dialog on wide screens. Holds one thing at a time. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus], input, .opt[aria-checked='true'], .opt, .done, .sheet-close");
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    el?.addEventListener("keydown", onKey);
    return () => el?.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <>
      <div className={`scrim${open ? " open" : ""}`} onClick={onClose} />
      <section ref={ref} className={`sheet${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="grip" />
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="sheet-close" aria-label="Close" onClick={onClose}><Icon name="close" size={20} /></button>
        </header>
        {children}
      </section>
    </>
  );
}

const Foot = ({ children }: { children: ReactNode }) => <div className="sheet-foot">{children}</div>;

/** One choice in a sheet: a quiet tile with a title and an optional line below. */
function Opt({ title, sub, checked, go, disabled, onClick }: {
  title: ReactNode; sub?: ReactNode; checked?: boolean; go?: boolean; disabled?: boolean; onClick: () => void;
}) {
  const radio = checked !== undefined;
  return (
    <button className="opt" role={radio ? "radio" : undefined} aria-checked={radio ? checked : undefined} disabled={disabled} onClick={onClick}>
      <span className="o-text">
        <span className="o-title">{title}</span>
        {sub && <span className="o-sub">{sub}</span>}
      </span>
      {checked && <span className="o-check"><Icon name="check" size={16} /></span>}
      {go && !checked && <span className="o-go"><Icon name="chevron" size={20} /></span>}
    </button>
  );
}

/* ── Edit one helper ─────────────────────────────────────── */
export function EditHelper({ hass, entityId, onDone, toast }: { hass: HomeAssistant; entityId: string; onDone: () => void; toast: (t: string) => void }) {
  const h = readHelper(hass, entityId);
  const [original] = useState(() => hass.states[entityId]?.state ?? "");
  const write = (value: string) => setHelperValue(hass, entityId, value).catch((e) => toast(errorText(e)));
  const current = hass.states[entityId]?.state ?? "";
  const back = original !== current && (
    <button className="plain reset" onClick={() => write(original)}>
      Back to {formatState(hass, entityId, original)}
    </button>
  );
  const done = <button className="done" onClick={onDone}>Done</button>;

  return (
    <>
      {h.kind === "number" && <EditNumber h={h} write={write} />}
      {(h.kind === "time" || h.kind === "date" || h.kind === "datetime") && <EditDateTime h={h} write={write} />}
      {h.kind === "select" && (
        <div className="options cols" role="radiogroup" aria-label={h.name}>
          {h.options.map((o) => <Opt key={o} title={o} checked={o === h.value} onClick={() => write(o)} />)}
        </div>
      )}
      {h.kind === "text" && <EditText h={h} write={write} />}
      <Foot>{back}{done}</Foot>
    </>
  );
}

function EditNumber({ h, write }: { h: Extract<Helper, { kind: "number" }>; write: (v: string) => void }) {
  const [v, setV] = useState(h.value);
  const dragging = useRef(false);
  const timer = useRef<number>();
  useEffect(() => {
    if (!dragging.current) setV(h.value);
  }, [h.value]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const commit = (n: number, delay = 0) => {
    const c = clampNumber(h, n);
    setV(c);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      dragging.current = false;
      if (c !== h.value) write(String(c));
    }, delay);
  };
  const quick = quickValues(h);
  const label = formatNumber(h, v);
  const pct = label.endsWith("%");
  return (
    <>
      <div className="bigval" aria-live="polite">
        {pct ? <>{label.slice(0, -1)}<small>%</small></> : label}
      </div>
      <div className="stepper">
        <button className="iconbtn filled" aria-label="Less" onClick={() => commit(v - h.step)}><Icon name="minus" /></button>
        <input
          type="range" min={h.min} max={h.max} step={h.step} value={v} aria-label={h.name} aria-valuetext={label}
          onChange={(e) => { dragging.current = true; commit(Number(e.target.value), 300); }}
        />
        <button className="iconbtn filled" aria-label="More" onClick={() => commit(v + h.step)}><Icon name="plus" /></button>
      </div>
      {quick.length > 0 && (
        <div className="quick">
          {quick.map((q) => (
            <button key={q} aria-pressed={q === v} onClick={() => commit(q)}>{formatNumber(h, q)}</button>
          ))}
        </div>
      )}
    </>
  );
}

function EditDateTime({ h, write }: { h: Extract<Helper, { kind: "time" | "date" | "datetime" }>; write: (v: string) => void }) {
  if (h.kind === "time") {
    return (
      <>
        <input
          className="biginput" type="time" value={h.value.slice(0, 5)} aria-label={h.name}
          onChange={(e) => e.target.value && write(`${e.target.value}:00`)}
        />
        <div className="quick">
          <button onClick={() => write(shiftTime(h.value, -15))}>15 min earlier</button>
          <button onClick={() => write(shiftTime(h.value, 15))}>15 min later</button>
        </div>
      </>
    );
  }
  if (h.kind === "date") {
    return <input className="biginput small" type="date" value={h.value} aria-label={h.name} onChange={(e) => e.target.value && write(e.target.value)} />;
  }
  return (
    <input
      className="biginput small" type="datetime-local" value={h.value.slice(0, 16).replace(" ", "T")} aria-label={h.name}
      onChange={(e) => e.target.value && write(`${e.target.value.replace("T", " ")}:00`)}
    />
  );
}

function EditText({ h, write }: { h: Extract<Helper, { kind: "text" }>; write: (v: string) => void }) {
  const [v, setV] = useState(h.value);
  return (
    <form className="textedit" onSubmit={(e) => { e.preventDefault(); write(v); }}>
      <input value={v} minLength={h.min} maxLength={h.max} aria-label={h.name} onChange={(e) => setV(e.target.value)} />
      {v !== h.value && <button className="btn">Save</button>}
    </form>
  );
}

/* ── Run now ─────────────────────────────────────────────── */
export function RunSheet({ hass, automation: a, onDone, toast }: { hass: HomeAssistant; automation: Automation; onDone: () => void; toast: (t: string) => void }) {
  const run = (skip: boolean) => {
    onDone();
    hass
      .callService("automation", "trigger", { skip_condition: skip }, { entity_id: a.entityId })
      .then(() => toast(skip ? "Actions ran" : "Triggered"))
      .catch((e) => toast(errorText(e)));
  };
  return (
    <>
      <div className="options cols">
        <Opt title="Trigger" sub={a.enabled ? "Runs only if the conditions pass" : "Turn the automation on to trigger it"}
          disabled={!a.enabled} onClick={() => run(false)} />
        <Opt title="Run actions" sub="Skips the conditions and runs right away" onClick={() => run(true)} />
      </div>
    </>
  );
}

/* ── More: traces, editor, rename ────────────────────────── */
export function MoreSheet({ automation: a, onDone, onRename, navigate }: {
  automation: Automation; onDone: () => void; onRename: () => void; navigate: (path: string) => void;
}) {
  return (
    <>
      <NameRow name={a.name} sub={a.haName ? `Called “${a.haName}” in Home Assistant` : undefined} onClick={onRename} />
      {a.configId && (
        <>
          <p className="sheet-label">In Home Assistant</p>
          <div className="options cols">
            <Opt title="Traces" sub="What happened the last times it ran" go
              onClick={() => { onDone(); navigate(`/config/automation/trace/${a.configId}`); }} />
            <Opt title="Edit" sub="Open the automation editor" go
              onClick={() => { onDone(); navigate(`/config/automation/edit/${a.configId}`); }} />
          </div>
        </>
      )}
    </>
  );
}

/** The current name as a value you can change, like a setting tile. */
function NameRow({ name, sub, onClick }: { name: string; sub?: string; onClick: () => void }) {
  return (
    <button className="namerow" onClick={onClick}>
      <span className="o-text">
        <span className="o-sub">Name</span>
        <span className="n-value">{name}</span>
        {sub && <span className="o-sub">{sub}</span>}
      </span>
      <span className="o-go"><Icon name="edit" size={20} /></span>
    </button>
  );
}

/* ── Name something (group, display name) ────────────────── */
export function NameSheet({ initial, placeholder, action, onSave, onReset, resetLabel, onDone }: {
  initial: string; placeholder: string; action: string; onSave: (name: string) => void; onDone: () => void;
  onReset?: () => void; resetLabel?: string;
}) {
  const [name, setName] = useState(initial);
  return (
    <>
      <form id="namesheet" className="textedit" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }}>
        <input data-autofocus placeholder={placeholder} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label={placeholder} />
      </form>
      <Foot>
        {onReset && <button className="plain reset" onClick={onReset}>{resetLabel}</button>}
        {name.trim() && name.trim() !== initial
          ? <button className="done" type="submit" form="namesheet">{action}</button>
          : <button className="done quiet" onClick={onDone}>Cancel</button>}
      </Foot>
    </>
  );
}

/* ── Pick any entity as a favorite ───────────────────────── */
export function EntityPicker({ hass, exclude, onPick }: { hass: HomeAssistant; exclude: Set<string>; onPick: (entityId: string) => void }) {
  const [q, setQ] = useState("");
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const order = ["light", "switch", "fan", "cover", "climate", "script", "scene", "media_player", "lock"];
  const rank = (id: string) => { const i = order.indexOf(id.split(".")[0]); return i < 0 ? order.length : i; };
  const results = Object.values(hass.states)
    .filter((s) => !exclude.has(s.entity_id))
    .map((s) => ({ id: s.entity_id, name: String(s.attributes.friendly_name ?? s.entity_id) }))
    .filter((e) => terms.every((t) => `${e.name} ${e.id}`.toLowerCase().includes(t)))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name))
    .slice(0, 40);
  return (
    <>
      <label className="search in-sheet">
        <Icon name="search" />
        <input data-autofocus type="search" placeholder="Search entities" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search entities" />
      </label>
      <div className="options picker">
        {results.map((e) => (
          <button key={e.id} className="pickrow" onClick={() => onPick(e.id)}>
            <EntityIcon hass={hass} entityId={e.id} />
            <span className="o-text">
              <span className="o-title">{e.name}</span>
              <span className="o-sub">{e.id}</span>
            </span>
          </button>
        ))}
        {results.length === 0 && <p className="hint">No entity matches “{q.trim()}”.</p>}
      </div>
    </>
  );
}

/* ── Choose what an entity favorite does ─────────────────── */
export function ActionSheet({ hass, entityId, current, onSave, onRename, name }: {
  hass: HomeAssistant; entityId: string; current?: FavoriteAction; onSave: (a: FavoriteAction) => void;
  /** Only for favorites that already exist. */
  onRename?: () => void; name?: string;
}) {
  const [service, setService] = useState<string | null>(null);
  const services = servicesFor(hass, entityId);
  const same = (a: FavoriteAction) => JSON.stringify(a) === JSON.stringify(current);

  if (service) {
    const info = services.find(([n]) => n === service)?.[1];
    return (
      <ServiceForm
        hass={hass} entityId={entityId} service={service} fields={fieldsOf(info)}
        initial={current?.kind === "service" && current.service === service ? current.data : undefined}
        onBack={() => setService(null)} onSave={(data) => onSave({ kind: "service", service, data })}
      />
    );
  }
  const choose = (name: string) => {
    const info = services.find(([n]) => n === name)?.[1];
    if (fieldsOf(info).length) setService(name);
    else onSave({ kind: "service", service: name });
  };
  return (
    <>
      {onRename && name && <NameRow name={name} onClick={onRename} />}
      <p className="sheet-label">When you tap it</p>
      <div className="options cols" role="radiogroup" aria-label="When you tap it">
        {canToggle(hass, entityId) && (
          <Opt title="Toggle" sub="Switch it on or off" checked={same({ kind: "toggle" })} onClick={() => onSave({ kind: "toggle" })} />
        )}
        <Opt title="Open details" sub="Home Assistant's own controls" checked={same({ kind: "more-info" })} onClick={() => onSave({ kind: "more-info" })} />
        {services.filter(([n]) => n !== "toggle").map(([svc, info]) => {
          const selected = current?.kind === "service" && current.service === svc;
          return (
            <Opt key={svc} title={serviceName(hass, entityId, svc)}
              sub={selected && current ? actionLabel(hass, entityId, current) : info.description}
              checked={selected} go={fieldsOf(info).length > 0} onClick={() => choose(svc)} />
          );
        })}
      </div>
      <p className="sheet-note">Press and hold the tile to open its details any time.</p>
    </>
  );
}

function ServiceForm({ hass, entityId, service, fields, initial, onBack, onSave }: {
  hass: HomeAssistant; entityId: string; service: string; fields: ReturnType<typeof fieldsOf>;
  initial?: Record<string, unknown>; onBack: () => void; onSave: (data: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      Object.entries(initial ?? {}).map(([k, v]) => [k, typeof v === "boolean" ? v : typeof v === "object" ? JSON.stringify(v) : String(v)]),
    ),
  );
  const kinds = Object.fromEntries(fields.map(([k, f]) => [k, fieldKind(f)])) as Record<string, FieldKind>;
  const filled = Object.entries(values).filter(([, v]) => v !== "" && v !== undefined);
  const data = Object.fromEntries(filled.map(([k, v]) => [k, parseInput(kinds[k], v)]));
  const missing = fields.filter(([k, f]) => f.required && !(k in data));
  return (
    <>
      <p className="sheet-label">{actionLabel(hass, entityId, { kind: "service", service, data })}</p>
      <p className="sheet-note top">Leave a field empty to skip it.</p>
      <div className="form">
        {fields.map(([key, f]) => {
          const kind = kinds[key];
          const set = (v: string | boolean) => setValues((s) => ({ ...s, [key]: v }));
          const num = (f.selector?.number ?? {}) as { min?: number; max?: number; step?: number | string; unit_of_measurement?: string };
          const example = f.example === undefined ? "" : `e.g. ${typeof f.example === "object" ? JSON.stringify(f.example) : String(f.example)}`;
          return (
            <label key={key} className="field">
              <span className="f-label">{f.name || key}{f.required ? " (required)" : ""}</span>
              {kind === "boolean" ? (
                <input type="checkbox" checked={values[key] === true} onChange={(e) => set(e.target.checked)} />
              ) : kind === "select" ? (
                <select value={String(values[key] ?? "")} onChange={(e) => set(e.target.value)}>
                  <option value="">—</option>
                  {selectOptions(f).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <span className="f-input">
                  <input
                    type={kind === "number" ? "number" : "text"} value={String(values[key] ?? "")} placeholder={example}
                    min={num.min} max={num.max} step={num.step === "any" ? "any" : num.step}
                    onChange={(e) => set(e.target.value)}
                  />
                  {num.unit_of_measurement && <span className="muted">{num.unit_of_measurement}</span>}
                </span>
              )}
            </label>
          );
        })}
      </div>
      <Foot>
        <button className="plain reset" onClick={onBack}>Back</button>
        <button className="done" disabled={missing.length > 0} onClick={() => onSave(data)}>Save</button>
      </Foot>
    </>
  );
}
