/** `npm run dev`: mounts the real panel element with a mock Home Assistant. Not part of the build. */
import "./haIcon";
import "../main";
import { createMockHass } from "./mock";
import type { HomeAssistant } from "../types";

type PanelElement = HTMLElement & { hass: HomeAssistant; narrow: boolean };

const panel = document.createElement("mixboard-panel") as PanelElement;
document.getElementById("app")!.append(panel);

panel.narrow = innerWidth < 870;
panel.hass = createMockHass((hass) => (panel.hass = hass));
addEventListener("resize", () => (panel.narrow = innerWidth < 870));
panel.addEventListener("hass-toggle-menu", () => console.info("[mock] sidebar toggled"));
panel.addEventListener("hass-more-info", (e) => console.info("[mock] more-info", (e as CustomEvent).detail));
