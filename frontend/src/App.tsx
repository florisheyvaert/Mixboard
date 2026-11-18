import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Detail } from "./components/Detail";
import { Overview } from "./components/Overview";
import { EditHelper, ProfilesSheet, RunSheet, Sheet } from "./components/Sheets";
import { readHelper } from "./helpers";
import { toAutomations } from "./model";
import type { AutomationInfo, HomeAssistant, Profile } from "./types";
import { errorText, Toast, useToast } from "./ui";

type SheetState =
  | { kind: "edit"; entityId: string }
  | { kind: "run" }
  | { kind: "profiles" };

interface Props {
  hass: HomeAssistant;
  narrow: boolean;
  onMenu: () => void;
}

export function App({ hass, narrow, onMenu }: Props) {
  const [infos, setInfos] = useState<AutomationInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
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
      const res = await hassRef.current.callWS<{ profiles: Profile[] }>({ type: "mixboard/profiles" });
      setProfiles(res.profiles);
    } catch {
      /* profiles are optional; the sheet shows an empty list */
    }
  }, []);

  // Reload when automations are added, removed or reloaded.
  const automationKey = Object.keys(hass.states).filter((k) => k.startsWith("automation.")).sort().join(",");
  useEffect(() => { load(); }, [automationKey, load]);
  useEffect(() => { loadProfiles(); }, [loadProfiles]);
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let gone = false;
    hassRef.current.connection
      .subscribeEvents(() => load(), "automation_reloaded")
      .then((u) => (gone ? u() : (unsub = u)))
      .catch(() => {});
    return () => { gone = true; unsub?.(); };
  }, [load]);

  const automations = useMemo(() => (infos ? toAutomations(hass, infos) : []), [hass, infos]);
  const open = automations.find((a) => a.entityId === openId) ?? null;

  const go = (entityId: string | null) => {
    const el = scroller.current;
    if (entityId && el) listScroll.current = el.scrollTop;
    const from = openId;
    setSheet(null);
    setOpenId(entityId);
    requestAnimationFrame(() => {
      if (!el) return;
      el.scrollTop = entityId ? 0 : listScroll.current;
      const target = entityId
        ? el.querySelector<HTMLElement>(".back")
        : el.querySelector<HTMLElement>(`[data-entity="${from}"]`);
      target?.focus({ preventScroll: true });
    });
  };

  const openSheet = (s: SheetState, from: HTMLElement) => {
    opener.current = from;
    setSheet(s);
  };
  const closeSheet = useCallback(() => {
    setSheet(null);
    opener.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (sheet || !openId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && go(null);
    const el = scroller.current;
    el?.addEventListener("keydown", onKey);
    return () => el?.removeEventListener("keydown", onKey);
  });

  let sheetTitle = "";
  let sheetBody: React.ReactNode = null;
  if (sheet?.kind === "edit") {
    sheetTitle = readHelper(hass, sheet.entityId).name;
    sheetBody = <EditHelper key={sheet.entityId} hass={hass} entityId={sheet.entityId} onDone={closeSheet} toast={show} />;
  } else if (sheet?.kind === "run" && open) {
    sheetTitle = "Run now";
    sheetBody = <RunSheet hass={hass} automation={open} onDone={closeSheet} toast={show} />;
  } else if (sheet?.kind === "profiles") {
    sheetTitle = "Profiles";
    sheetBody = (
      <ProfilesSheet hass={hass} automations={automations} profiles={profiles} onChange={loadProfiles} onDone={closeSheet} toast={show} />
    );
  }

  return (
    <div className="root" ref={scroller}>
      <main className="page">
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
            hass={hass}
            automation={open}
            onBack={() => go(null)}
            onEdit={(entityId, from) => openSheet({ kind: "edit", entityId }, from)}
            onRun={(from) => openSheet({ kind: "run" }, from)}
            toast={show}
          />
        ) : (
          <Overview
            hass={hass}
            automations={automations}
            narrow={narrow}
            query={query}
            category={category}
            showAll={showAll}
            onQuery={setQuery}
            onCategory={setCategory}
            onShowAll={() => setShowAll(true)}
            onOpen={go}
            onMenu={onMenu}
            onProfiles={(from) => openSheet({ kind: "profiles" }, from)}
          />
        )}
      </main>
      <Sheet open={!!sheetBody} title={sheetTitle} onClose={closeSheet}>{sheetBody}</Sheet>
      <Toast toast={toast} onHide={hide} />
    </div>
  );
}
