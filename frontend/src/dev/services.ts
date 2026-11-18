/** A trimmed copy of what Home Assistant publishes in `hass.services`, for the mock. */
import type { ServiceInfo } from "../types";

const onOff = (thing: string): Record<string, ServiceInfo> => ({
  turn_on: { name: "Turn on", description: `Turns the ${thing} on.`, fields: {} },
  turn_off: { name: "Turn off", description: `Turns the ${thing} off.`, fields: {} },
  toggle: { name: "Toggle", description: `Toggles the ${thing}.`, fields: {} },
});

export const MOCK_SERVICES: Record<string, Record<string, ServiceInfo>> = {
  light: {
    turn_on: {
      name: "Turn on",
      description: "Turns on one or more lights and adjusts their properties.",
      fields: {
        brightness_pct: { name: "Brightness", description: "Brightness in percent.", selector: { number: { min: 0, max: 100, unit_of_measurement: "%" } } },
        advanced_fields: {
          fields: {
            transition: { name: "Transition", description: "Duration it takes to get to the next state.", selector: { number: { min: 0, max: 300, unit_of_measurement: "seconds" } } },
            color_temp_kelvin: { name: "Color temperature", selector: { color_temp: { unit: "kelvin" } }, example: 3000 },
            flash: { name: "Flash", selector: { select: { options: ["long", "short"] } } },
          },
        },
      },
    },
    turn_off: { name: "Turn off", description: "Turns off one or more lights.", fields: { transition: { name: "Transition", selector: { number: { min: 0, max: 300, unit_of_measurement: "seconds" } } } } },
    toggle: { name: "Toggle", description: "Toggles one or more lights.", fields: {} },
  },
  switch: onOff("switch"),
  fan: onOff("fan"),
  input_boolean: { ...onOff("helper"), reload: { name: "Reload", fields: {} } },
  automation: {
    ...onOff("automation"),
    trigger: { name: "Trigger", description: "Triggers the actions of an automation.", fields: { skip_condition: { name: "Skip conditions", selector: { boolean: {} }, default: true } } },
  },
  cover: {
    open_cover: { name: "Open", description: "Opens a cover.", fields: {} },
    close_cover: { name: "Close", description: "Closes a cover.", fields: {} },
    stop_cover: { name: "Stop", description: "Stops the cover movement.", fields: {} },
    toggle: { name: "Toggle", description: "Toggles a cover open/closed.", fields: {} },
    set_cover_position: { name: "Set position", description: "Moves a cover to a specific position.", fields: { position: { name: "Position", required: true, selector: { number: { min: 0, max: 100, unit_of_measurement: "%" } } } } },
  },
  script: { turn_on: { name: "Turn on", description: "Runs the sequence of actions defined in a script.", fields: {} }, turn_off: { name: "Turn off", fields: {} }, toggle: { name: "Toggle", fields: {} } },
  scene: { turn_on: { name: "Activate", description: "Activates a scene.", fields: { transition: { name: "Transition", selector: { number: { min: 0, max: 300 } } } } } },
  button: { press: { name: "Press", description: "Presses a button entity.", fields: {} } },
  input_button: { press: { name: "Press", description: "Presses the input button entity.", fields: {} } },
};
