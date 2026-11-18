/** Dev only: a tiny stand-in for Home Assistant's <ha-icon icon="mdi:…"> so named icons render in the mock. */
import { mdiFan, mdiHelpCircleOutline, mdiLightbulb, mdiRobot, mdiWindowShutter } from "@mdi/js";

const PATHS: Record<string, string> = {
  "mdi:window-shutter": mdiWindowShutter,
  "mdi:lightbulb": mdiLightbulb,
  "mdi:fan": mdiFan,
  "mdi:robot": mdiRobot,
};

class MockHaIcon extends HTMLElement {
  static observedAttributes = ["icon"];
  attributeChangedCallback() { this.render(); }
  connectedCallback() { this.render(); }
  private render() {
    const size = getComputedStyle(this).getPropertyValue("--mdc-icon-size") || "24px";
    const d = PATHS[this.getAttribute("icon") ?? ""] ?? mdiHelpCircleOutline;
    this.style.display = "inline-flex";
    this.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path fill="currentColor" d="${d}"/></svg>`;
  }
}
if (!customElements.get("ha-icon")) customElements.define("ha-icon", MockHaIcon);
