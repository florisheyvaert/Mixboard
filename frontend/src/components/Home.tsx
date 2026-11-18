import { useRef, type ReactNode } from "react";
import { actionLabel, defaultAction, isOn, runAction } from "../actions";
import { Icon } from "../icons";
import { categoriesOf, entityName, entityState, favoriteKey, itemFavorite, itemHelpers, type Item } from "../model";
import type { Favorite, HomeAssistant, Layout } from "../types";
import { errorText, Switch } from "../ui";
import { EntityIcon } from "./EntityIcon";

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
  onEditing: (on: boolean) => void;
  onSelect: (key: string) => void;
  onFavorite: (fav: Favorite) => void;
  onHide: (keys: string[], hide: boolean) => void;
  onShowHidden: (show: boolean) => void;
  onAddFavorite: (opener: HTMLElement) => void;
  onEditFavorite: (fav: Favorite, opener: HTMLElement) => void;
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
    [i.name, ...i.automations.flatMap((a) => [a.name, a.haName ?? "", a.entityId]), ...itemHelpers(i).flatMap((h) => [h.entity_id, entityName(p.hass, h.entity_id)])]
      .join(" ").toLowerCase().includes(q);

  // Favorites leave the category lists so nothing shows twice (except while customizing).
  const listed = p.items.filter((i) => matches(i) && (p.editing || !favKeys.has(i.key)));
  const hiddenCount = listed.filter((i) => hidden.has(i.key)).length;
  const visible = listed.filter((i) => p.editing || p.showHidden || !hidden.has(i.key));
  const noSettings = p.items.filter((i) => !itemHelpers(i).length && !hidden.has(i.key) && !favKeys.has(i.key));

  const favorites = p.layout.favorites.filter((f) => {
    if (f.type === "entity") return !q || `${f.id} ${entityName(p.hass, f.id)}`.toLowerCase().includes(q);
    const item = byKey.get(favoriteKey(f));
    return item && matches(item) && !p.editing;
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
          <button className="btn dark" onClick={() => p.onEditing(false)}>Done</button>
        ) : (
          <>
            {(hiddenCount > 0 || p.showHidden) && (
              <label className="hidden-toggle" title="Show hidden automations">
                <span>Hidden{hiddenCount ? <span className="count"> ({hiddenCount})</span> : null}</span>
                <Switch checked={p.showHidden} label="Show hidden automations" onChange={() => p.onShowHidden(!p.showHidden)} />
              </label>
            )}
            <button className="roundbtn" aria-label="Customize" title="Customize: favorites, hide, group, rename" onClick={() => p.onEditing(true)}>
              <Icon name="tune" size={22} />
            </button>
          </>
        )}
      </div>
      {p.editing ? (
        <p className="intro">Star what you use most, hide what you never touch, select tiles to group or rename them.</p>
      ) : (
        <label className="search">
          <Icon name="search" />
          <input type="search" placeholder="Search" aria-label="Search automations, settings and favorites" value={p.query} onChange={(e) => p.onQuery(e.target.value)} />
        </label>
      )}

      {(favorites.length > 0 || p.editing) && (
        <Section title="Favorites">
          {favorites.map((f) =>
            f.type === "entity" ? (
              <EntityTile
                key={f.id} hass={p.hass} fav={f} editing={p.editing} toast={p.toast}
                onMoreInfo={() => p.onMoreInfo(f.id)} onRemove={() => p.onFavorite(f)}
                onEdit={(el) => p.onEditFavorite(f, el)}
              />
            ) : (
              itemTile(byKey.get(favoriteKey(f))!)
            ),
          )}
          {p.editing && (
            <button className="tile add" onClick={(e) => p.onAddFavorite(e.currentTarget)}>
              <Icon name="plus" />
              <span>Add a device or action</span>
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
        <button className="btn spaced" onClick={() => p.onHide(noSettings.map((i) => i.key), true)}>
          Hide the {noSettings.length} automation{noSettings.length === 1 ? "" : "s"} without settings
        </button>
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
    !p.editing && p.hidden ? "Hidden" : "",
  ].filter(Boolean).join(" · ");
  return (
    <div
      className={`tile${off === item.automations.length ? " off" : ""}${p.hidden ? " dim" : ""}`}
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

/** A Home Assistant entity with the action the user chose. Tap runs it; press and hold opens HA's details. */
function EntityTile(p: {
  hass: HomeAssistant; fav: Favorite; editing: boolean; toast: (t: string) => void;
  onMoreInfo: () => void; onRemove: () => void; onEdit: (el: HTMLElement) => void;
}) {
  const id = p.fav.id;
  const action = p.fav.action ?? defaultAction(p.hass, id);
  const name = entityName(p.hass, id);
  const state = entityState(p.hass, id);
  const on = isOn(p.hass, id);
  const held = useRef(false);
  const timer = useRef<number>();

  const tap = () => {
    if (held.current) { held.current = false; return; }
    if (action.kind === "more-info") return p.onMoreInfo();
    runAction(p.hass, id, action)
      .then(() => action.kind === "service" && p.toast(`${name}: ${actionLabel(p.hass, id, action)}`))
      .catch((e) => p.toast(errorText(e)));
  };
  const press = {
    onPointerDown: () => { held.current = false; timer.current = window.setTimeout(() => { held.current = true; p.onMoreInfo(); }, 550); },
    onPointerUp: () => window.clearTimeout(timer.current),
    onPointerLeave: () => window.clearTimeout(timer.current),
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); window.clearTimeout(timer.current); held.current = true; p.onMoreInfo(); },
  };

  if (p.editing) {
    return (
      <div className="tile entity" role="button" tabIndex={0} onClick={(e) => p.onEdit(e.currentTarget)}
        onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === "Enter") p.onEdit(e.currentTarget); }}>
        <div className="t-head"><EntityIcon hass={p.hass} entityId={id} /><div className="t-name">{name}</div></div>
        <div className="t-sub">{actionLabel(p.hass, id, action)}</div>
        <div className="t-foot">Tap to change</div>
        <div className="t-tools" onClick={(e) => e.stopPropagation()}>
          <button className="iconbtn" aria-label={`Remove ${name} from favorites`} onClick={p.onRemove}><Icon name="close" size={20} /></button>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`tile entity ${action.kind}${action.kind === "toggle" && on ? " on" : ""}`}
      role="button" tabIndex={0} aria-label={`${name}: ${actionLabel(p.hass, id, action)}`}
      onClick={tap} {...press}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); tap(); } }}
    >
      <div className="t-head"><EntityIcon hass={p.hass} entityId={id} /><div className="t-name">{name}</div></div>
      {action.kind === "service" ? (
        <div className="t-sub">{actionLabel(p.hass, id, action)}</div>
      ) : (
        state && <div className="t-sub">{state}</div>
      )}
      {action.kind === "toggle" && (
        <div className="t-action" onClick={(e) => e.stopPropagation()}>
          <Switch checked={on} label={`Toggle ${name}`} onChange={() => runAction(p.hass, id, action).catch((e) => p.toast(errorText(e)))} />
        </div>
      )}
      {action.kind === "service" && <span className="t-run" aria-hidden="true"><Icon name="play" size={18} /></span>}
    </div>
  );
}
