import type { ReactNode } from "react";
import { Icon } from "../icons";
import {
  categoriesOf, entityAction, entityName, entityState, favoriteKey, itemFavorite, itemHelpers, type Item,
} from "../model";
import type { Favorite, HomeAssistant, Layout } from "../types";
import { errorText, Switch } from "../ui";

interface Props {
  hass: HomeAssistant;
  items: Item[];
  layout: Layout;
  narrow: boolean;
  query: string;
  editing: boolean;
  selected: Set<string>;
  showHidden: boolean;
  onQuery: (q: string) => void;
  onOpen: (key: string) => void;
  onMenu: () => void;
  onProfiles: (opener: HTMLElement) => void;
  onEditing: (on: boolean) => void;
  onSelect: (key: string) => void;
  onFavorite: (fav: Favorite) => void;
  onHide: (keys: string[], hide: boolean) => void;
  onShowHidden: () => void;
  onAddFavorite: (opener: HTMLElement) => void;
  onMoreInfo: (entityId: string) => void;
  toast: (text: string) => void;
}

/** Home: favorites first, then every automation (or group) as a quiet tile, per category. */
export function Home(p: Props) {
  const q = p.query.trim().toLowerCase();
  const hidden = new Set(p.layout.hidden);
  const favKeys = new Set(p.layout.favorites.map(favoriteKey));
  const byKey = new Map(p.items.map((i) => [i.key, i]));

  const matches = (i: Item) =>
    !q ||
    [i.name, ...i.automations.flatMap((a) => [a.name, a.entityId]), ...itemHelpers(i).flatMap((h) => [h.entity_id, entityName(p.hass, h.entity_id)])]
      .join(" ").toLowerCase().includes(q);

  // Favorites leave the category lists so nothing shows twice (except while customizing).
  const listed = p.items.filter((i) => matches(i) && (p.editing || !favKeys.has(i.key)));
  const visible = listed.filter((i) => p.editing || p.showHidden || !hidden.has(i.key));
  const hiddenCount = listed.length - visible.length;
  const noSettings = p.items.filter((i) => !itemHelpers(i).length && !hidden.has(i.key) && !favKeys.has(i.key));

  const favorites = p.layout.favorites.filter((f) => {
    if (f.type === "entity") return !q || `${f.id} ${entityName(p.hass, f.id)}`.toLowerCase().includes(q);
    const item = byKey.get(favoriteKey(f));
    return item && matches(item);
  });

  const itemTile = (i: Item) => (
    <ItemTile
      key={i.key} item={i} editing={p.editing} selected={p.selected.has(i.key)}
      favorite={favKeys.has(i.key)} hidden={hidden.has(i.key)}
      onOpen={() => (p.editing ? p.onSelect(i.key) : p.onOpen(i.key))}
      onFavorite={() => p.onFavorite(itemFavorite(i))}
      onHide={() => p.onHide([i.key], !hidden.has(i.key))}
    />
  );

  return (
    <div className="home">
      <div className="head">
        {p.narrow && !p.editing && (
          <button className="iconbtn" aria-label="Open the sidebar" onClick={p.onMenu}><Icon name="menu" /></button>
        )}
        <h1>{p.editing ? "Customize" : "Mixboard"}</h1>
        {p.editing ? (
          <button className="done small" onClick={() => p.onEditing(false)}>Done</button>
        ) : (
          <>
            <button className="iconbtn" aria-label="Profiles" onClick={(e) => p.onProfiles(e.currentTarget)}><Icon name="layers" /></button>
            <button className="iconbtn" aria-label="Customize" onClick={() => p.onEditing(true)}><Icon name="edit" /></button>
          </>
        )}
      </div>
      {p.editing ? (
        <p className="intro">Star what you use most, hide what you never touch, and select automations to group them.</p>
      ) : (
        <label className="search">
          <Icon name="search" />
          <input type="search" placeholder="Search" aria-label="Search automations, settings and favorites" value={p.query} onChange={(e) => p.onQuery(e.target.value)} />
        </label>
      )}

      {(favorites.length > 0 || p.editing) && (
        <Section title="Favorites">
          {favorites.map((f) => {
            if (f.type !== "entity") {
              const item = byKey.get(favoriteKey(f))!;
              return p.editing ? null : itemTile(item);
            }
            return (
              <EntityTile
                key={f.id} hass={p.hass} entityId={f.id} editing={p.editing} toast={p.toast}
                onMoreInfo={() => p.onMoreInfo(f.id)} onRemove={() => p.onFavorite(f)}
              />
            );
          })}
          {p.editing && (
            <button className="tile add" onClick={(e) => p.onAddFavorite(e.currentTarget)}>
              <Icon name="plus" />
              <span>Add a light, switch or other entity</span>
            </button>
          )}
        </Section>
      )}

      {visible.length === 0 && favorites.length === 0 && (
        <p className="empty">{q ? `Nothing matches “${p.query.trim()}”.` : "You don't have any automations yet."}</p>
      )}
      {categoriesOf(visible).map((c) => (
        <Section key={c.id} title={c.name}>
          {visible.filter((i) => i.category.id === c.id).map(itemTile)}
        </Section>
      ))}

      {p.editing && noSettings.length > 0 && (
        <button className="more" onClick={() => p.onHide(noSettings.map((i) => i.key), true)}>
          Hide the {noSettings.length} automation{noSettings.length === 1 ? "" : "s"} without settings
        </button>
      )}
      {!p.editing && hiddenCount > 0 && (
        <button className="more" onClick={p.onShowHidden}>{p.showHidden ? "Hide" : "Show"} {hiddenCount} hidden</button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="section">{title}</div>
      <div className="grid">{children}</div>
    </section>
  );
}

function ItemTile(p: {
  item: Item; editing: boolean; selected: boolean; favorite: boolean; hidden: boolean;
  onOpen: () => void; onFavorite: () => void; onHide: () => void;
}) {
  const { item } = p;
  const off = item.automations.filter((a) => !a.enabled).length;
  const foot = [
    item.kind === "group" ? `${item.automations.length} automations` : "",
    off === item.automations.length ? "Off" : off ? `${off} off` : "",
  ].filter(Boolean).join(" · ");
  return (
    <div
      className={`tile${off === item.automations.length ? " off" : ""}${p.editing && p.hidden ? " dim" : ""}`}
      role="button" tabIndex={0} aria-pressed={p.editing ? p.selected : undefined} data-key={item.key}
      onClick={p.onOpen}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); p.onOpen(); } }}
    >
      <div className="t-name">{item.name}</div>
      {foot && <div className="t-foot">{foot}</div>}
      {p.editing && (
        <div className="t-tools" onClick={(e) => e.stopPropagation()}>
          <button className="iconbtn" aria-pressed={p.favorite} aria-label={p.favorite ? "Remove from favorites" : "Add to favorites"} onClick={p.onFavorite}>
            <Icon name={p.favorite ? "starFilled" : "star"} size={20} />
          </button>
          <button className="iconbtn" aria-pressed={p.hidden} aria-label={p.hidden ? "Show on the home page" : "Hide from the home page"} onClick={p.onHide}>
            <Icon name={p.hidden ? "eyeOff" : "eye"} size={20} />
          </button>
        </div>
      )}
      {p.editing && <span className="t-check" aria-hidden="true"><Icon name="check" size={16} /></span>}
    </div>
  );
}

function EntityTile(p: { hass: HomeAssistant; entityId: string; editing: boolean; onMoreInfo: () => void; onRemove: () => void; toast: (t: string) => void }) {
  const action = entityAction(p.hass, p.entityId);
  const domain = p.entityId.split(".")[0];
  const run = (fn: Promise<unknown>) => fn.catch((e) => p.toast(errorText(e)));
  const state = entityState(p.hass, p.entityId);
  return (
    <div
      className={`tile entity${action.type === "toggle" && action.on ? " on" : ""}`}
      role="button" tabIndex={0} onClick={p.editing ? undefined : p.onMoreInfo}
      onKeyDown={(e) => { if (!p.editing && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); p.onMoreInfo(); } }}
    >
      <div className="t-name">{entityName(p.hass, p.entityId)}</div>
      {state && <div className="t-sub">{state}</div>}
      {!p.editing && action.type !== "none" && (
        <div className="t-action" onClick={(e) => e.stopPropagation()}>
          {action.type === "toggle" ? (
            <Switch checked={action.on} label={`Toggle ${entityName(p.hass, p.entityId)}`}
              onChange={() => run(p.hass.callService(domain, "toggle", {}, { entity_id: p.entityId }))} />
          ) : (
            <button className="plain save" onClick={() => run(p.hass.callService(domain, action.service, {}, { entity_id: p.entityId }))}>{action.label}</button>
          )}
        </div>
      )}
      {p.editing && (
        <div className="t-tools">
          <button className="iconbtn" aria-label="Remove from favorites" onClick={p.onRemove}><Icon name="close" size={20} /></button>
        </div>
      )}
    </div>
  );
}
