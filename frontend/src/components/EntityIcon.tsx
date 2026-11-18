import { createElement, useEffect, useRef, useState } from "react";
import {
  mdiAccount, mdiBell, mdiCheckboxMarkedCircleOutline, mdiCircleOutline, mdiFan, mdiGauge, mdiGestureTapButton,
  mdiLightbulb, mdiLightbulbOutline, mdiLock, mdiLockOpenVariant, mdiPalette, mdiRobot, mdiRobotVacuum, mdiScriptText,
  mdiSpeaker, mdiThermometer, mdiThermostat, mdiToggleSwitch, mdiToggleSwitchOffOutline, mdiVideo, mdiWaterPercent,
  mdiWindowShutter, mdiWindowShutterOpen,
} from "@mdi/js";
import type { HomeAssistant } from "../types";

/** Home Assistant's own icon for an entity (custom icons, state-based icons), with a built-in fallback. */
export function EntityIcon({ hass, entityId, size = 24 }: { hass: HomeAssistant; entityId: string; size?: number }) {
  const ref = useRef<HTMLElement & { hass?: HomeAssistant; stateObj?: unknown }>(null);
  const [native, setNative] = useState(() => !!customElements.get("ha-state-icon"));
  const stateObj = hass.states[entityId];

  // HA loads its components lazily; switch to the real icon as soon as it exists.
  useEffect(() => {
    if (native) return;
    let live = true;
    customElements.whenDefined("ha-state-icon").then(() => live && setNative(true));
    return () => { live = false; };
  }, [native]);
  useEffect(() => {
    if (native && ref.current) {
      ref.current.hass = hass;
      ref.current.stateObj = stateObj;
    }
  });

  if (native && stateObj) {
    return createElement("ha-state-icon", { ref, class: "e-icon", style: { "--mdc-icon-size": `${size}px` } });
  }
  return (
    <svg className="e-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={fallbackPath(entityId, stateObj?.state, stateObj?.attributes.device_class)} fill="currentColor" />
    </svg>
  );
}

function fallbackPath(entityId: string, state?: string, deviceClass?: unknown): string {
  const on = state === "on";
  switch (entityId.split(".")[0]) {
    case "light": return on ? mdiLightbulb : mdiLightbulbOutline;
    case "switch": case "input_boolean": return on ? mdiToggleSwitch : mdiToggleSwitchOffOutline;
    case "cover": return state === "closed" ? mdiWindowShutter : mdiWindowShutterOpen;
    case "fan": return mdiFan;
    case "climate": return mdiThermostat;
    case "sensor":
      return deviceClass === "temperature" ? mdiThermometer : deviceClass === "humidity" ? mdiWaterPercent : mdiGauge;
    case "binary_sensor": return mdiCheckboxMarkedCircleOutline;
    case "script": return mdiScriptText;
    case "scene": return mdiPalette;
    case "button": case "input_button": return mdiGestureTapButton;
    case "media_player": return mdiSpeaker;
    case "lock": return state === "unlocked" ? mdiLockOpenVariant : mdiLock;
    case "automation": return mdiRobot;
    case "vacuum": return mdiRobotVacuum;
    case "camera": return mdiVideo;
    case "person": return mdiAccount;
    case "siren": return mdiBell;
    default: return mdiCircleOutline;
  }
}

/** An icon by name ("mdi:window-shutter") through Home Assistant's own ha-icon element. */
export function NamedIcon({ icon, size = 24 }: { icon: string; size?: number }) {
  const [native, setNative] = useState(() => !!customElements.get("ha-icon"));
  useEffect(() => {
    if (native) return;
    let live = true;
    customElements.whenDefined("ha-icon").then(() => live && setNative(true));
    return () => { live = false; };
  }, [native]);
  if (native) return createElement("ha-icon", { icon, class: "e-icon", style: { "--mdc-icon-size": `${size}px` } });
  return (
    <svg className="e-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={mdiRobot} fill="currentColor" />
    </svg>
  );
}

/**
 * Icon for an automation tile or group: the icon set on the automation in Home Assistant,
 * else its category's icon, else HA's automation icon. A group uses its first automation.
 */
export function AutomationIcon({ hass, entityId, categoryIcon, size = 24 }: {
  hass: HomeAssistant; entityId: string; categoryIcon: string | null; size?: number;
}) {
  const own = hass.states[entityId]?.attributes.icon;
  if (typeof own === "string" && own) return <NamedIcon icon={own} size={size} />;
  if (categoryIcon) return <NamedIcon icon={categoryIcon} size={size} />;
  return <EntityIcon hass={hass} entityId={entityId} size={size} />;
}
