# Workify

Single-file time-tracking web app with a JSON data store. No framework, no build step, no database.

## Quick start

```bash
./start          # idempotent — prints the URL or "already running"
```

Open <http://localhost:13001>.

To stop: `./stop`. To run in the foreground for debugging: `node server.js`.

## How it works

- **UI**: one `index.html`. Open it in a browser and it talks to the local server (or, if served as static files in Chromium, falls back to the File System Access API).
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
| `index.html` | Whole UI (HTML + CSS + JS in one file). |
| `server.js` | Zero-dependency Node http server. |
| `import-clockify.js` | Clockify CSV → `data.json` importer. |
| `start`, `stop` | Manual lifecycle scripts (aliased as `workify` / `workify-stop`). |
| `autostart.sh` | Idempotent silent variant called from `~/.bashrc` so the server is up by the time you open a browser. |
| `data.json` | Your entries. **Source of truth.** |
| `data.json.bak-*` | Automatic backups (created by the importer). |

## Auto-start on shell open

`~/.bashrc` contains a small marked block that calls `autostart.sh`. Open any terminal → server is up. Remove the marked block to disable. The `workify` / `workify-stop` aliases work independently.

## Tech

- No dependencies. Pure Node + browser APIs.
- ES2018+ JavaScript inside `index.html` (template literals, async/await, optional chaining).
- 24-hour times, DD/MM/YYYY dates everywhere. Pagination groups entries by week → day; a date never splits across pages.
- Chromium-only when run statically (File System Access API). Run via `./start` for cross-browser support.

## Backing up

Just copy `data.json` somewhere. Restoring is the reverse. There's no migration system — the JSON shape is the schema.
