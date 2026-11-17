# Name Picker

A mobile-friendly name picker for randomly selecting people from a group. It has a full-screen animated picker, a separate group editor, character SVG icons, and a history of selected names.

## Run locally

This is a static website; it has no build step or package dependencies. From the repository directory, start a local HTTP server:

```sh
python3 -m http.server 8765
```

Then open <http://localhost:8765> in a browser. Use a local web server rather than opening the HTML files directly, since the app fetches its JSON data and SVG assets.

## Use the picker

1. Open **Edit group** to choose people from the library or add names.
2. Select **Start drawing** to open the picker and start the first five-second selection.
3. Select **Pick next name** for each subsequent selection. A picked person is removed from the remaining names and added to the history.
4. Use **Reset** / **Start over** to clear the round and restore the group captured when the first pick began. You can then edit the group again.

Each remaining person has an equal chance of being selected. The scrolling animation cycles through the remaining names without repeating one until it has displayed the others.

## Group and data storage

- The original roster is loaded from `players.json`; each person maps to an avatar name and SVG path.
- Available SVG avatars are listed in `SVG/avatars.json`. Newly added people receive a random avatar that is not already assigned to another player.
- Selected players, added names, the active round, the latest reel sequence, and pick history are saved in the browser's `localStorage` under `name-draw-state-v1`.
- This is browser/device-local storage: data is not written back to `players.json`, synchronized to other devices, or stored on a server. Clearing the browser's site data will remove saved changes.

## Project files

- `index.html` — full-screen picker and pick history.
- `group.html` — selected group and searchable player library.
- `app.js` — picker logic, animations, avatar assignment, and local persistence.
- `styles.css` — responsive layout and visual styling.
- `players.json` — initial player roster.
- `SVG/` — player icons and `avatars.json`, the available-avatar manifest.
