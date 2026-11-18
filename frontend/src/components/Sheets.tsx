import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  clampNumber, formatNumber, formatState, PROFILE_DOMAINS, quickValues, readHelper, setHelperValue, shiftTime,
  type Helper,
} from "../helpers";
import { Icon } from "../icons";
import type { Automation } from "../model";
import type { HomeAssistant, Profile } from "../types";
import { errorText } from "../ui";

/** Bottom sheet on phones, centered dialog on wide screens. Holds one thing at a time. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus], input, .opt[aria-checked='true'], .opt, .done");
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
        <h2>{title}</h2>
        {children}
      </section>
    </>
  );
}

const Foot = ({ children }: { children: ReactNode }) => <div className="sheet-foot">{children}</div>;

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
        <div className="options" role="radiogroup" aria-label={h.name}>
          {h.options.map((o) => (
            <button key={o} className="opt" role="radio" aria-checked={o === h.value} onClick={() => write(o)}>
              <span>{o}</span>
              <span className="check"><Icon name="check" /></span>
            </button>
          ))}
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
      <button className="plain save" disabled={v === h.value}>Save</button>
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
      <div className="options">
        <button className="opt" onClick={() => run(false)} disabled={!a.enabled}>
          <span>Trigger<small>{a.enabled ? "Runs only if the conditions pass" : "Turn the automation on to trigger it"}</small></span>
        </button>
        <button className="opt" onClick={() => run(true)}>
          <span>Run actions<small>Skips the conditions and runs right away</small></span>
        </button>
      </div>
      <Foot><button className="done quiet" onClick={onDone}>Cancel</button></Foot>
    </>
  );
}

/* ── Profiles ────────────────────────────────────────────── */
export function ProfilesSheet({
  hass, automations, profiles, onChange, onDone, toast,
}: {
  hass: HomeAssistant; automations: Automation[]; profiles: Profile[]; onChange: () => void; onDone: () => void;
  toast: (t: string, undo?: () => void) => void;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const apply = async (p: Profile) => {
    const changes = Object.entries(p.values).filter(([eid, v]) => hass.states[eid] && hass.states[eid].state !== v);
    const before = changes.map(([eid]) => [eid, hass.states[eid].state] as const);
    onDone();
    try {
      await Promise.all(changes.map(([eid, v]) => setHelperValue(hass, eid, v)));
      toast(
        changes.length ? `${p.name} applied to ${changes.length} setting${changes.length === 1 ? "" : "s"}` : `${p.name} already matches`,
        changes.length ? () => before.forEach(([eid, v]) => setHelperValue(hass, eid, v)) : undefined,
      );
    } catch (e) {
      toast(errorText(e));
    }
  };

  const save = async () => {
    const values: Record<string, string> = {};
    for (const a of automations)
      for (const l of a.helpers)
        if (PROFILE_DOMAINS.has(l.entity_id.split(".")[0]) && hass.states[l.entity_id]) values[l.entity_id] = hass.states[l.entity_id].state;
    try {
      await hass.callWS({ type: "mixboard/profiles/save", name: name.trim(), values });
      onChange();
      onDone();
      toast(`Saved ${name.trim()}`);
      setName("");
      setNaming(false);
    } catch (e) {
      toast(errorText(e));
    }
  };

  const remove = async (p: Profile) => {
    try {
      await hass.callWS({ type: "mixboard/profiles/delete", profile_id: p.id });
      onChange();
    } catch (e) {
      toast(errorText(e));
    }
  };

  return (
    <>
      <div className="options">
        {profiles.length === 0 && !naming && <p className="hint">Save your current settings as a profile, like “Summer”, to switch back to them later in one tap.</p>}
        {profiles.map((p) => (
          <div className="opt row" key={p.id}>
            <button className="plain grow" onClick={() => apply(p)}>
              {p.name}<small>Sets {Object.keys(p.values).length} settings</small>
            </button>
            <button className="iconbtn" aria-label={`Delete ${p.name}`} onClick={() => remove(p)}><Icon name="close" size={18} /></button>
          </div>
        ))}
        {naming ? (
          <form className="textedit" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save(); }}>
            <input data-autofocus placeholder="Profile name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Profile name" />
            <button className="plain save" disabled={!name.trim()}>Save</button>
          </form>
        ) : (
          <button className="opt" onClick={() => setNaming(true)}><span>Save current settings as a profile</span></button>
        )}
      </div>
      <Foot><button className="done quiet" onClick={onDone}>Close</button></Foot>
    </>
  );
}

/* ── Traces and editor ───────────────────────────────────── */
export function MoreSheet({ automation: a, onDone, navigate }: { automation: Automation; onDone: () => void; navigate: (path: string) => void }) {
  return (
    <>
      <div className="options">
        <button className="opt" onClick={() => { onDone(); navigate(`/config/automation/trace/${a.configId}`); }}>
          <span>Traces<small>See what happened the last times it ran</small></span>
        </button>
        <button className="opt" onClick={() => { onDone(); navigate(`/config/automation/edit/${a.configId}`); }}>
          <span>Edit in Home Assistant<small>Open the automation editor</small></span>
        </button>
      </div>
      <Foot><button className="done quiet" onClick={onDone}>Cancel</button></Foot>
    </>
  );
}

/* ── Name a group ────────────────────────────────────────── */
export function GroupNameSheet({ initial, action, onSave, onDone }: { initial: string; action: string; onSave: (name: string) => void; onDone: () => void }) {
  const [name, setName] = useState(initial);
  return (
    <form className="textedit" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()); }}>
      <input data-autofocus placeholder="Group name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Group name" />
      <button className="plain save" disabled={!name.trim()}>{action}</button>
      <button type="button" className="plain reset" onClick={onDone}>Cancel</button>
    </form>
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
          <button key={e.id} className="opt" onClick={() => onPick(e.id)}>
            <span>{e.name}<small>{e.id}</small></span>
          </button>
        ))}
        {results.length === 0 && <p className="hint">No entity matches “{q.trim()}”.</p>}
      </div>
    </>
  );
}
