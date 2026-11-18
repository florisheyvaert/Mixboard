# Mixboard

A Home Assistant sidebar panel to tune your automations.

Many automations use input helpers for their settings, such as a delay after sunset or the night brightness of the
hall lights. Mixboard finds the helpers each automation uses and shows them in one place: pick an automation, tap a
value, change it. No automation editor needed.

- **Overview:** every automation with its current settings, searchable and grouped by category.
- **Detail:** the settings of one automation. Tap a value to change it in a sheet with a slider, quick values or a
  time picker. You can enable or disable the automation, trigger it, or run its actions.
- **Profiles:** save your current settings as a profile ("Summer", "Autumn") and switch back in one tap.

Mixboard finds a helper when the automation mentions it anywhere: in a trigger, a condition, a target, a template
(`{{ states('input_number.delay') }}`), blueprint inputs, or a script the automation calls.

Supported helpers: `input_number`, `input_boolean`, `input_select`, `input_datetime`, `input_text`, `input_button`.
`timer` and `counter` are shown read-only.

## Installation (HACS)

1. HACS → ⋮ → **Custom repositories** → add `https://github.com/florisheyvaert/Mixboard`, type **Integration**.
2. Download **Mixboard**. To try a beta, turn on **Show beta versions** for Mixboard first.
3. Restart Home Assistant.
4. **Settings → Devices & services → Add integration → Mixboard.** The panel appears in the sidebar (admins only).

## Development

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 with a mock Home Assistant (src/dev/mock.ts)
npm run build    # writes custom_components/mixboard/frontend/mixboard.js
```

Backend tests (the helper scanner is plain Python and needs no Home Assistant install):

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-test.txt   # .venv/bin/python on Linux/macOS
.venv/Scripts/python -m pytest
```

## Releases

Push a tag. The release workflow builds the frontend, sets the manifest version from the tag and attaches
`mixboard.zip`. Tags with a hyphen (`v0.1.0-beta.1`) become pre-releases, which HACS shows only with
*Show beta versions* on.

```bash
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```
