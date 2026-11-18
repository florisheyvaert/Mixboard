import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";
import styles from "./styles.css?inline";
import type { HomeAssistant } from "./types";

/** The custom element Home Assistant mounts as the sidebar panel. */
class MixboardPanel extends HTMLElement {
  private root: Root | null = null;
  private _hass: HomeAssistant | null = null;
  private _narrow = false;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this.render();
  }

  set narrow(narrow: boolean) {
    this._narrow = narrow;
    this.render();
  }

  // HA also sets `panel` and `route`; Mixboard does not need them.
  set panel(_: unknown) {}
  set route(_: unknown) {}

  connectedCallback() {
    if (this.root) return;
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = styles;
    const mount = document.createElement("div");
    mount.className = "mount";
    shadow.append(style, mount);
    this.root = createRoot(mount);
    this.render();
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
    this.shadowRoot?.replaceChildren();
  }

  private toggleMenu = () => {
    this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
  };

  private render() {
    if (!this.root || !this._hass) return;
    this.root.render(<App hass={this._hass} narrow={this._narrow} onMenu={this.toggleMenu} />);
  }
}

if (!customElements.get("mixboard-panel")) customElements.define("mixboard-panel", MixboardPanel);
