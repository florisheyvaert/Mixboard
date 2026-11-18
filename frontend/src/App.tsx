import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Detail } from "./components/Detail";
import { Home } from "./components/Home";
import {
  EditHelper, EntityPicker, GroupNameSheet, MoreSheet, ProfilesSheet, RunSheet, Sheet,
} from "./components/Sheets";
import { readHelper } from "./helpers";
import {
  buildItems, commonPrefix, EMPTY_LAYOUT, favoriteKey, groupKey, navigate, toAutomations, type Automation, type Item,
} from "./model";
import type { AutomationInfo, Favorite, HomeAssistant, Layout, Profile } from "./types";
import { errorText, Toast, useToast } from "./ui";

type SheetState =
  | { kind: "edit"; entityId: string }
  | { kind: "run"; automation: string }
  | { kind: "more"; automation: string }
  | { kind: "profiles" }
  | { kind: "group"; mode: "create" | "rename" }
  | { kind: "picker" };

interface Props {
  hass: HomeAssistant;
  narrow: boolean;
  onMenu: () => void;
  onMoreInfo: (entityId: string) => void;
}

const newId = () => Math.random().toString(36).slice(2, 10);

export function App({ hass, narrow, onMenu, onMoreInfo }: Props) {
  const [infos, setInfos] = useState<AutomationInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [layout, setLayout] = useState<Layout>(EMPTY_LAYOUT);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const { toast, show, hide } = useToast();

  const hassRef = useRef(hass);
  hassRef.current = hass;
  const scroller = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const opener = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await hassRef.current.callWS<{ automations: AutomationInfo[] }>({ type: "mixboard/automations" });
      setInfos(res.automations);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, []);
  const loadProfiles = useCallback(async () => {
    try {
      setProfiles((await hassRef.current.callWS<{ profiles: Profile[] }>({ type: "mixboard/profiles" })).profiles);
    } catch { /* optional */ }
  }, []);
  const loadLayout = useCallback(async () => {
    try {
      setLayout((await hassRef.current.callWS<{ layout: Layout }>({ type: "mixboard/layout" })).layout);
    } catch { /* an older backend without layouts: keep the default */ }
  }, []);

  const automationKey = Object.keys(hass.states).filter((k) => k.startsWith("automation.")).sort().join(",");
  useEffect(() => { load(); }, [automationKey, load]);
  useEffect(() => { loadProfiles(); loadLayout(); }, [loadProfiles, loadLayout]);
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let gone = false;
    hassRef.current.connection.subscribeEvents(() => load(), "automation_reloaded")
      .then((u) => (gone ? u() : (unsub = u))).catch(() => {});
    return () => { gone = true; unsub?.(); };
  }, [load]);

  const automations = useMemo(() => (infos ? toAutomations(hass, infos) : []), [hass, infos]);
  const items = useMemo(() => buildItems(automations, layout), [automations, layout]);
  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const open = openKey ? byKey.get(openKey) ?? null : null;
  const findAutomation = (id: string) => automations.find((a) => a.entityId === id);

  /** Optimistic: show the change now, save in the background, roll back if saving fails. */
  const saveLayout = (next: Layout) => {
    const prev = layout;
    setLayout(next);
    hassRef.current.callWS({ type: "mixboard/layout/save", layout: next }).catch((e) => {
      setLayout(prev);
      show(`Couldn't save: ${errorText(e)}`);
    });
  };

  const go = (key: string | null) => {
    const el = scroller.current;
    if (key && el) listScroll.current = el.scrollTop;
    const from = openKey;
    setSheet(null);
    setOpenKey(key);
    requestAnimationFrame(() => {
      if (!el) return;
      el.scrollTop = key ? 0 : listScroll.current;
      const target = key ? el.querySelector<HTMLElement>(".back") : el.querySelector<HTMLElement>(`[data-key="${from}"]`);
      target?.focus({ preventScroll: true });
    });
  };

  const openSheet = (s: SheetState, from: HTMLElement | null) => {
    opener.current = from;
    setSheet(s);
  };
  const closeSheet = useCallback(() => {
    setSheet(null);
    opener.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (sheet || !openKey) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && go(null);
    const el = scroller.current;
    el?.addEventListener("keydown", onKey);
    return () => el?.removeEventListener("keydown", onKey);
  });

  /* ── Customize actions ── */
  const toggleFavorite = (fav: Favorite) => {
    const key = favoriteKey(fav);
    const exists = layout.favorites.some((f) => favoriteKey(f) === key);
    saveLayout({ ...layout, favorites: exists ? layout.favorites.filter((f) => favoriteKey(f) !== key) : [...layout.favorites, fav] });
  };
  const setHidden = (keys: string[], hidden: boolean) => {
    const set = new Set(layout.hidden);
    keys.forEach((k) => (hidden ? set.add(k) : set.delete(k)));
    saveLayout({ ...layout, hidden: [...set] });
    if (keys.length > 1) show(`Hid ${keys.length} automations`, () => saveLayout(layout));
  };
  const toggleSelect = (key: string) =>
    setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const selectedItems = [...selected].map((k) => byKey.get(k)).filter((i): i is Item => !!i);
  const selectedGroups = selectedItems.filter((i): i is Extract<Item, { kind: "group" }> => i.kind === "group");
  const selectedAutomationIds = selectedItems.flatMap((i) => i.automations.map((a) => a.entityId));

  const createGroup = (name: string) => {
    // Merge everything selected into one group; keep the first selected group's id so favorites stay.
    const keep = selectedGroups[0]?.group;
    const id = keep?.id ?? newId();
    const dropped = new Set(selectedGroups.map((g) => g.group.id));
    const members = [...new Set(selectedAutomationIds)];
    const groups = layout.groups
      .filter((g) => !dropped.has(g.id))
      .map((g) => ({ ...g, automations: g.automations.filter((a) => !members.includes(a)) }))
      .filter((g) => g.automations.length > 0);
    const removedKeys = new Set([...selectedItems.map((i) => i.key)].filter((k) => k !== groupKey(id)));
    saveLayout({
      groups: [...groups, { id, name, automations: members }],
      hidden: layout.hidden.filter((k) => !removedKeys.has(k)),
      favorites: layout.favorites.filter((f) => !removedKeys.has(favoriteKey(f))),
    });
    setSelected(new Set());
    setSheet(null);
    show(`Grouped ${members.length} automations as ${name}`);
  };
  const renameGroup = (name: string) => {
    const g = selectedGroups[0];
    saveLayout({ ...layout, groups: layout.groups.map((x) => (x.id === g.group.id ? { ...x, name } : x)) });
    setSelected(new Set());
    setSheet(null);
  };
  const ungroup = () => {
    const g = selectedGroups[0];
    saveLayout({
      groups: layout.groups.filter((x) => x.id !== g.group.id),
      hidden: layout.hidden.filter((k) => k !== g.key),
      favorites: layout.favorites.filter((f) => favoriteKey(f) !== g.key),
    });
    setSelected(new Set());
    show(`Ungrouped ${g.name}`, () => saveLayout(layout));
  };

  /* ── Sheets ── */
  let sheetTitle = "";
  let sheetBody: React.ReactNode = null;
  if (sheet?.kind === "edit") {
    sheetTitle = readHelper(hass, sheet.entityId).name;
    sheetBody = <EditHelper key={sheet.entityId} hass={hass} entityId={sheet.entityId} onDone={closeSheet} toast={show} />;
  } else if (sheet?.kind === "run" || sheet?.kind === "more") {
    const a = findAutomation(sheet.automation);
    if (a) {
      sheetTitle = sheet.kind === "run" ? `Run ${a.name}` : a.name;
      sheetBody = sheet.kind === "run"
        ? <RunSheet hass={hass} automation={a} onDone={closeSheet} toast={show} />
        : <MoreSheet automation={a} onDone={closeSheet} navigate={navigate} />;
    }
  } else if (sheet?.kind === "profiles") {
    sheetTitle = "Profiles";
    sheetBody = <ProfilesSheet hass={hass} automations={automations} profiles={profiles} onChange={loadProfiles} onDone={closeSheet} toast={show} />;
  } else if (sheet?.kind === "group") {
    const creating = sheet.mode === "create";
    sheetTitle = creating ? `Group ${new Set(selectedAutomationIds).size} automations` : "Rename group";
    const initial = creating
      ? selectedGroups[0]?.name ?? commonPrefix(selectedItems.map((i) => i.name))
      : selectedGroups[0]?.name ?? "";
    sheetBody = <GroupNameSheet initial={initial} action={creating ? "Group" : "Rename"} onSave={creating ? createGroup : renameGroup} onDone={closeSheet} />;
  } else if (sheet?.kind === "picker") {
    sheetTitle = "Add a favorite";
    const exclude = new Set(layout.favorites.filter((f) => f.type === "entity").map((f) => f.id));
    sheetBody = (
      <EntityPicker hass={hass} exclude={exclude} onPick={(id) => {
        saveLayout({ ...layout, favorites: [...layout.favorites, { type: "entity", id }] });
        closeSheet();
        show(`Added ${String(hass.states[id]?.attributes.friendly_name ?? id)}`);
      }} />
    );
  }

  const canGroup = new Set(selectedAutomationIds).size >= 2 && !(selectedItems.length === 1);
  const oneGroup = selectedItems.length === 1 && selectedGroups.length === 1;

  return (
    <div className="root" ref={scroller}>
      <main className={open ? "page" : "page wide"}>
        {loadError && !infos ? (
          <div className="problem">
            <h1>Mixboard</h1>
            <p>Couldn't load your automations: {loadError}</p>
            <button className="done" onClick={load}>Try again</button>
          </div>
        ) : !infos ? (
          <p className="empty">Loading automations…</p>
        ) : open ? (
          <Detail
            hass={hass} item={open} toast={show} onBack={() => go(null)}
            onEdit={(entityId, from) => openSheet({ kind: "edit", entityId }, from)}
            onRun={(a: Automation, from) => openSheet({ kind: "run", automation: a.entityId }, from)}
            onMore={(a: Automation, from) => openSheet({ kind: "more", automation: a.entityId }, from)}
          />
        ) : (
          <Home
            hass={hass} items={items} layout={layout} narrow={narrow} query={query} editing={editing}
            selected={selected} showHidden={showHidden} toast={show}
            onQuery={setQuery} onOpen={go} onMenu={onMenu} onMoreInfo={onMoreInfo}
            onProfiles={(from) => openSheet({ kind: "profiles" }, from)}
            onEditing={(on) => { setEditing(on); setSelected(new Set()); }}
            onSelect={toggleSelect} onFavorite={toggleFavorite} onHide={setHidden}
            onShowHidden={() => setShowHidden((s) => !s)}
            onAddFavorite={(from) => openSheet({ kind: "picker" }, from)}
          />
        )}
      </main>

      {editing && !open && selected.size > 0 && (
        <div className="editbar" role="toolbar" aria-label="Selection">
          <span>{selected.size} selected</span>
          <button className="plain reset" onClick={() => setSelected(new Set())}>Clear</button>
          {oneGroup && <button className="plain reset" onClick={ungroup}>Ungroup</button>}
          {oneGroup && <button className="plain reset" onClick={(e) => openSheet({ kind: "group", mode: "rename" }, e.currentTarget)}>Rename</button>}
          {canGroup && <button className="done small" onClick={(e) => openSheet({ kind: "group", mode: "create" }, e.currentTarget)}>Group</button>}
          {!canGroup && !oneGroup && <span className="muted small">Select another to group</span>}
        </div>
      )}
      <Sheet open={!!sheetBody} title={sheetTitle} onClose={closeSheet}>{sheetBody}</Sheet>
      <Toast toast={toast} onHide={hide} />
    </div>
  );
}
