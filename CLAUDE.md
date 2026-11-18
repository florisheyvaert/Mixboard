# Mixboard

Home Assistant custom integration (HACS) that adds a sidebar panel to tune the input helpers automations use.
Plan and decisions: `plans/plan.md`. Approved design: `mockups/mixboard-v4.html` (earlier mockups were rejected).

## Layout

- `custom_components/mixboard/` — Python integration
  - `scanner.py` — finds helpers in an automation config. Pure Python, no HA imports, so `tests/` can load it directly.
  - `websocket_api.py` — `mixboard/automations`, `mixboard/profiles(/save|/delete)`, `mixboard/layout(/save)`
  - `store.py` — profiles and the home layout (groups, hidden, favorites) in `.storage/mixboard`
  - `__init__.py` — registers the static path, panel (`mixboard-panel`, admin only) and websocket commands
  - `frontend/` — build output only (git-ignored except `.gitkeep`)
- `frontend/` — React 18 + TypeScript + Vite, plain CSS in the panel's shadow DOM (`src/styles.css`)
  - `src/main.tsx` — the custom element HA mounts; `src/App.tsx` — state and navigation
  - `src/helpers.ts` — reading helper state, formatting, writing values through each helper's own service
  - `src/actions.ts` — entity favorites: actions built from `hass.services` (toggle, any domain service + fields, more-info)
  - `src/model.ts` — automations → home items (groups, display names), favorites keys
  - `src/dev/` — mock Home Assistant for `npm run dev`; never imported by `main.tsx`
- `tests/test_scanner.py` — pytest

## Commands

- `cd frontend && npm run dev` — mock HA at http://localhost:5173 (also `.claude/launch.json` → `mixboard-dev`)
- `cd frontend && npm run build` — type-check (`tsc -b`, stricter than `--noEmit` about unused code) and build
- `.venv/Scripts/python -m pytest` — scanner tests

## Design rules (the user rejected three busy designs; keep it calm)

- One accent color (`--primary-color`), used only for values you can change. Everything else neutral.
- Screens show text and values. Controls appear only after a tap, in a sheet (bottom on phones, centered on desktop).
- One primary action per sheet (the dark Done button). No pills, badges, colored stripes, cards or shadows on lists.
- Home and detail: quiet tiles (tinted surface, no borders or shadows), full width, 2 columns on phones.
- Buttons: one shape (`.btn`, soft); `.btn.dark` only for the single main action (Done, Group, Save).
- Profiles are out of the UI on purpose; the backend commands stay for later.
- Customizing (favorite, hide, group) lives in a separate Customize mode so the normal view stays calm.
- All CSS tokens map to HA theme variables so light/dark and custom themes work. All UI text in English.

## Deploying

HACS only, no SSH. A tag `v*` triggers `.github/workflows/release.yml`; a hyphen in the tag makes it a pre-release.
Ask the user before pushing tags or commits.
