# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Workify — a single-page time-tracking app loosely modeled on Clockify. The entire UI lives in one IIFE inside `index.html`. A ~60-line zero-dependency Node http server (`server.js`) reads/writes one JSON file (`data.json`). **No framework, no bundler, no test suite, no lint config.**

## Commands

```bash
./start                                # idempotent: start server detached (port 13001)
./stop                                 # kill the running server
node server.js                         # foreground (for debugging)
node import-clockify.js <csv> [csv …]  # import Clockify Detailed exports → data.json
                                       # (auto-backs up the existing data.json first)
```

The `start`/`stop` scripts are wired into the shell as `workify` / `workify-stop` (`~/.bash_aliases`), and `autostart.sh` is called from `~/.bashrc` so the server is up by the time any terminal is open. All hooks delegate to scripts in this folder — the project owns its lifecycle.

## Architecture

### Static SPA + tiny JSON server (dual mode)

`index.html` ships the entire client. `server.js` does two things only: serve the folder statically, and expose `GET /api/data` + `PUT /api/data` against `data.json`. The client supports two storage modes and picks one silently at startup:

- **Server mode** (default): on load, `fetch('/api/data')`. If it 200s, all `persist()` calls become PUTs.
- **FSA mode** (fallback): if there's no server endpoint, fall back to the File System Access API. The chosen `FileSystemFileHandle` is stashed in IndexedDB so it survives reloads. Only works in Chromium-based browsers on a secure origin (https/localhost) — not on `file://`.

Both modes share the same `applyData()` / `persist()` plumbing — don't add a third codepath.

### Data shape

```json
{
  "entries": [
    {
      "id": "imp-...",
      "description": "...",
      "project": "Acme Corp",
      "startTime": "09:00",
      "endTime": "11:30",
      "date": "2026-05-17",
      "duration": 150
    }
  ],
  "projects": ["Acme Corp", "Internal"],
  "lastProject": "Acme Corp",
  "pageSize": 50
}
```

- `date` is ISO `YYYY-MM-DD`. `startTime` / `endTime` are 24-hour `HH:MM`. `duration` is **minutes (int)** — not hours, not decimal hours.
- The app stores ISO internally and renders `DD/MM/YYYY` via `isoToDisplayDate()` / `displayToIsoDate()`. **Never** persist the display format.

### UI invariants (don't accidentally regress)

- **Native `<input type="time">` and `<input type="date">` are intentionally NOT used.** Chromium ignores the page `lang` attribute and follows OS locale → AM/PM and MM/DD bleed through. Time and date inputs are plain `type="text"` driven by:
  - `normalizeTime()` — accepts `HH:MM`, `HH.MM`, `HH-MM`, and compact `1515`/`915`/`9`. Validates 23:59 max.
  - `displayToIsoDate()` / `isoToDisplayDate()` — DD/MM/YYYY with `/`, `.`, `-` separators; 2-digit years (`>= 70` → 19xx, else 20xx).
  - The custom **`cal` module** (calendar popup) and **`suggest` module** (description autocomplete) replace the native widgets entirely.
- **Pagination is day-aware** (`paginateByDay()`). A date is the smallest pagination unit; a date overflowing `pageSize` still renders intact rather than being split.
- **Form date persists between adds**; only description is cleared. The time window chains: after adding an entry that ends 15:30, the form's next start = 15:30, end = 15:40 (see `nextSlotForDate()`).
- **Default slot for an empty date is 07:15–07:25.**
- Entries are grouped in the list **by week then by day**; week labels are "This week", "Last week", else a date range like `Apr 27 – May 3` (`formatWeekLabel()`).
- Description suggestions are a **custom popup**, not `<datalist>` (which Chromium won't let us style).

### Reports tab

Charts are inline SVG generated in `renderBarChart()` and `renderDonut()`. No chart library. Range options live in `getReportRange()` — the `custom` mode reads From/To text inputs (same DD/MM/YYYY widget as the tracker).

### CSS

- `rem` for lengths and font-size, `em` for letter-spacing and media query breakpoints, **`1px` kept for borders** (fractional borders render fuzzy).
- Shared radius tokens in `:root` (`--radius-sm/--radius/--radius-md/--radius-lg`) — don't sprinkle raw radii.
- Page is `<html lang="en-GB">` so anything that *does* fall back to a native widget renders 24h / DD-MM.

### Lifecycle scripts

| Script | Purpose | Caller |
|---|---|---|
| `autostart.sh` | Silent, idempotent. Starts server via `setsid -f` if port 13001 isn't responding. | `~/.bashrc` hook |
| `start` | Same logic, but prints status. | `workify` alias |
| `stop` | `pkill -f 'workify/server\.js'` with status. | `workify-stop` alias |

Logs go to `/tmp/workify.log`. `setsid -f` detaches so the server survives the terminal closing.

### Importing Clockify

`import-clockify.js` expects the **Detailed** export (Summary has no per-entry dates and won't parse). Anchors each entry's `date` to *Start Date*, rounds duration seconds to nearest minute, writes `data-31-12-2026.json`, backs up `data.json` → `data.json.bak-<timestamp>`, then copies the new file over so the running server picks it up on next read. IDs are namespaced `imp-<runStamp>-<index>` to avoid collisions across re-runs.

## Port

`13001`. Picked to avoid common dev ports (3000/8080/etc.). If you change it, update: `server.js`, `autostart.sh`, `start`, and the fatal-overlay text in `index.html`.
