import { useMemo } from "react";
import { formatValue, readHelper } from "../helpers";
import { Icon } from "../icons";
import { categoriesOf, categoryId, type Automation } from "../model";
import type { HomeAssistant } from "../types";

interface Props {
  hass: HomeAssistant;
  automations: Automation[];
  narrow: boolean;
  query: string;
  category: string | null;
  showAll: boolean;
  onQuery: (q: string) => void;
  onCategory: (id: string | null) => void;
  onShowAll: () => void;
  onOpen: (entityId: string) => void;
  onMenu: () => void;
  onProfiles: (opener: HTMLElement) => void;
}

function summary(hass: HomeAssistant, a: Automation) {
  const values = a.helpers
    .map((l) => readHelper(hass, l.entity_id))
    .filter((h) => h.kind !== "missing" && h.kind !== "button")
    .map(formatValue);
  return values.length ? values.join(" · ") : "No settings";
}

/** Names and current values as plain text. Nothing here competes for attention. */
export function Overview(p: Props) {
  const categories = useMemo(() => categoriesOf(p.automations), [p.automations]);
  const q = p.query.trim().toLowerCase();

  const matching = p.automations.filter((a) => {
    if (p.category && categoryId(a) !== p.category) return false;
    if (!q) return true;
    const names = a.helpers.map((h) => String(p.hass.states[h.entity_id]?.attributes.friendly_name ?? h.entity_id));
    return [a.name, a.entityId, ...names, ...a.helpers.map((h) => h.entity_id)].join(" ").toLowerCase().includes(q);
  });
  const shown = matching.filter((a) => p.showAll || a.helpers.length > 0);
  const hidden = matching.length - shown.length;
  const grouped = categories.length > 1 && !p.category;

  const item = (a: Automation) => (
    <div
      key={a.entityId}
      className={`item${a.enabled ? "" : " off"}`}
      role="link"
      tabIndex={0}
      onClick={() => p.onOpen(a.entityId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          p.onOpen(a.entityId);
        }
      }}
      data-entity={a.entityId}
    >
      <div className="txt">
        <div className="name">{a.name}</div>
        <div className="sub">
          {summary(p.hass, a)}
        </div>
      </div>
      {!a.enabled && <span className="tag">Off</span>}
      <span className="chev"><Icon name="chevron" /></span>
    </div>
  );

  return (
    <>
      <div className="head">
        {p.narrow && (
          <button className="iconbtn" aria-label="Open the sidebar" onClick={p.onMenu}>
            <Icon name="menu" />
          </button>
        )}
        <h1>Mixboard</h1>
        <button className="iconbtn" aria-label="Profiles" onClick={(e) => p.onProfiles(e.currentTarget)}>
          <Icon name="layers" />
        </button>
      </div>
      <label className="search">
        <Icon name="search" />
        <input
          type="search"
          placeholder="Search"
          aria-label="Search automations and settings"
          value={p.query}
          onChange={(e) => p.onQuery(e.target.value)}
        />
      </label>
      {categories.length > 1 && (
        <div className="tabs" role="group" aria-label="Categories">
          <button className="tab" aria-pressed={!p.category} onClick={() => p.onCategory(null)}>All</button>
          {categories.map((c) => (
            <button key={c.id} className="tab" aria-pressed={p.category === c.id} onClick={() => p.onCategory(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 && (
        <p className="empty">
          {q ? `Nothing matches “${p.query.trim()}”.` : p.automations.length ? "None of these automations use an input helper yet." : "You don't have any automations yet."}
        </p>
      )}
      {grouped
        ? categories.map((c) => {
            const list = shown.filter((a) => categoryId(a) === c.id);
            return list.length ? (
              <section key={c.id}>
                <div className="section">{c.name}</div>
                {list.map(item)}
              </section>
            ) : null;
          })
        : shown.map(item)}
      {hidden > 0 && (
        <button className="more" onClick={p.onShowAll}>
          Show {hidden} without settings
        </button>
      )}
    </>
  );
}
