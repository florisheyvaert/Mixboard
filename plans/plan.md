# Mixboard — plan

> Een eigen tab in de Home Assistant-sidebar waar je per automation de gekoppelde input-helpers rustig en
> gebruiksvriendelijk instelt, zonder de automation-editor te openen.

## Beslissingen (2026-11-18)

| Onderwerp | Keuze |
|---|---|
| Naam | **Mixboard**, domain `mixboard` |
| Repo | `https://github.com/florisheyvaert/Mixboard.git` (publiek) |
| Deploy | Alleen HACS. Tags met een koppelteken (`v0.1.0-beta.1`) worden pre-releases. Geen SSH. |
| Testdata | Mockdata (`frontend/src/dev/mock.ts`) en pytest-tests, geen toegang tot de echte HA tijdens het bouwen |
| UI-taal | Alleen Engels |
| Design | **Rustig** (`mockups/mixboard-v4.html`). De mengtafel (v1), de HA-stijl met twee panelen (v2) en de tegels (v3) zijn afgewezen omdat ze te druk waren. |

## Wat het doet

**Overzicht:** zoeken, categorieën als tekst-tabs en per automation de naam met de huidige waarden in grijs.
Automations zonder helpers zijn verborgen, met een knop "Show N without settings".

**Detail (aparte pagina):**
- *Settings*: één rij per helper, met de waarde in de accentkleur. Tik op een rij en er opent een paneel met één
  bediening:
  - getal: grote waarde, slider, −/+ en vaste keuzes;
  - tijd: tijd typen of ±15 min;
  - keuzelijst: lijst met vinkje;
  - tekst: veld met Save.
- In het paneel zet "Back to …" de oude waarde terug. Aan/uit-helpers en knoppen werken direct in de rij.
- *Automation*: Enabled, Run now (Trigger met condities of Run actions zonder), Traces en Edit in Home Assistant.

**Profielen:** de huidige helperwaarden opslaan onder een naam en later met één tik toepassen, met Undo.

## Architectuur

```
custom_components/mixboard/   Python-integratie (HACS)
  scanner.py                  zoekt helpers in een automation-config (pure Python, getest)
  websocket_api.py            mixboard/automations, mixboard/profiles(/save|/delete)
  store.py                    profielen in .storage/mixboard
  __init__.py                 panel + static path + WS-commando's
frontend/                     React + TS + Vite, CSS in de shadow DOM, tokens op HA-themavariabelen
tests/                        pytest voor de scanner
```

De scanner loopt door elke string in de automation-config. Zo vindt hij entity_id's, targets, `at:`-triggers,
blueprint-inputs en templates. Aangeroepen scripts volgt hij tot 3 niveaus diep, en elke helper die hij daar vindt,
krijgt het script mee waarlangs hij gevonden is. De waarden zelf komen live uit `hass.states`.

## Fasering

| Fase | Inhoud | Status |
|---|---|---|
| 0. Setup + design | Mockups, gekozen design, repo-skelet, CI (validate + release), `CLAUDE.md` | ✅ lokaal klaar |
| 1. Backend | Scanner + tests, websocket-commando's, profielopslag | ✅ lokaal klaar, nog niet getest in een echte HA |
| 2–3. Overzicht + detail | React-versie van v4 met mock-HA, getest op desktop en mobiel | ✅ lokaal klaar |
| 4. Eerste beta | Pushen, tag `v0.1.0-beta.1`, installeren via HACS, testen op de echte automations | ⏳ volgende stap |
| 5. Afwerking | Helpers handmatig koppelen of verbergen, `timer`/`counter` bedienbaar, wijzigingsgeschiedenis per helper | later |

## Nog te doen in de echte HA (na de eerste beta)

- Controleren of `raw_config` van automations en scripts in jouw HA-versie beschikbaar is. De scanner leest die config.
- Controleren of de categorieën goed overkomen.
- De rondes Traces / Edit in Home Assistant aflopen. Die gebruiken de `id` van de automation. YAML-automations zonder
  `id` tonen die links niet.
