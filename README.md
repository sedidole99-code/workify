# Workify

Time-tracking web app with a JSON data store. No framework, no bundler, no database.

## Quick start

```bash
./start          # idempotent — prints the URL or "already running"
```

Open <http://localhost:13001>.

To stop: `./stop`. To run in the foreground for debugging: `node server.js`.

## How it works

- **UI**: `index.html` + `css/styles.css` + ES modules under `js/` (booted by `js/main.js`). Open it in a browser and it talks to the local server (or, if served as static files in Chromium, falls back to the File System Access API).
- **Storage**: a single JSON file (`data.json`) at the project root. The server exposes `GET /api/data` and `PUT /api/data`; the client reads/writes the whole file on every change.
- **Port**: `13001`.

That's the whole app.

## Importing Clockify exports

Use Clockify's **Detailed** report (the Summary export has no per-entry dates and won't work).

```bash
node import-clockify.js Clockify_Time_Report_Detailed_<range>.csv [more.csv …]
```

The importer:
1. Writes a combined `data-31-12-2026.json`.
2. Backs up the current `data.json` to `data.json.bak-<timestamp>`.
3. Copies the new file over `data.json` so the running server picks it up.

You can re-run safely — every run produces a fresh timestamped backup.

## Files

| Path | What |
|---|---|
| `index.html` | Markup shell. |
| `css/styles.css` | All styles. |
| `js/main.js` | Boot entry. |
| `js/App.js` | Top-level orchestrator. |
| `js/util/` | `TimeUtil`, `DateUtil`, `TextUtil`, `EntryGrouping`. Pure logic, no browser APIs. |
| `js/storage/` | `StorageAdapter`, `ServerAdapter`, `FsaAdapter`, `IDBHandleStore`, `Entry`, `Store`. |
| `js/ui/` | `Overlay`, `SetupFlow`, `EntryForm`, `EntryList`, `EntryRow`, `ProjectSelect`, `TimeAdjustModal`, `CalendarPopup`, `SuggestPopup`, `ReportsView`. |
| `test/` | `*.test.mjs` — pure-logic specs for `util/` and `storage/`. |
| `server.js` | Zero-dependency Node http server. |
| `import-clockify.js` | Clockify CSV → `data.json` importer. |
| `start`, `stop` | Manual lifecycle scripts (aliased as `workify` / `workify-stop`). |
| `autostart.sh` | Idempotent silent variant called from `~/.bashrc` so the server is up by the time you open a browser. |
| `data.json` | Your entries. **Source of truth.** |
| `data.json.bak-*` | Automatic backups (created by the importer). |

## Testing

```bash
node --test test/*.test.mjs
```

180+ specs covering the pure-logic surface (`TimeUtil`, `DateUtil`, `TextUtil`, `Entry`, `Store`, `EntryGrouping`, `StorageAdapter`). Uses Node's built-in test runner — zero npm dependencies. Pass the glob (`test/*.test.mjs`), not the bare directory.

**Test-driven development.** New features land with tests. The flow:

1. If the feature's logic lives inside a DOM-bound class, extract the pure parts into a static-method utility class under `js/util/` (as `EntryGrouping` was extracted out of `EntryList`).
2. Add `test/<Name>.test.mjs` — cover good paths, bad paths, and edge cases.
3. Implement until green. Bug fixes get a failing test first.

DOM-bound classes (`Overlay`, `EntryForm`, `EntryRow`, `CalendarPopup`, `SuggestPopup`, `TimeAdjustModal`, `SetupFlow`, `ReportsView`, `App`) are intentionally not tested — that would need JSDOM and contradict the zero-toolchain stance.

## Auto-start on shell open

`~/.bashrc` contains a small marked block that calls `autostart.sh`. Open any terminal → server is up. Remove the marked block to disable. The `workify` / `workify-stop` aliases work independently.

## Tech

- No npm dependencies. Pure Node + browser APIs. Tests use Node's built-in `node:test` runner.
- Modern ES under `js/` — native ES modules, classes with private fields/methods (Chrome 84+, Firefox 90+, Safari 15+). No bundler.
- OOP conventions: one class per file, utility namespaces as static-method classes, storage behind an adapter interface, models own their mutators. See `CLAUDE.md` for details.
- 24-hour times, DD/MM/YYYY dates everywhere. Pagination groups entries by week → day; a date never splits across pages.
- Chromium-only when run statically (File System Access API). Run via `./start` for cross-browser support.

## Backing up

Just copy `data.json` somewhere. Restoring is the reverse. There's no migration system — the JSON shape is the schema.
