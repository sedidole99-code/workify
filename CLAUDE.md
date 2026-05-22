# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Workify — a single-page time-tracking app loosely modeled on Clockify. The client is plain ES modules under `js/` (no bundler, no framework); CSS lives in `css/styles.css`; `index.html` is the markup shell. A ~60-line zero-dependency Node http server (`server.js`) serves the folder statically and reads/writes one JSON file (`data.json`). Tests are pure-logic specs under `test/`, run via Node's built-in test runner (no npm dependencies). **No framework, no bundler, no lint config.**

## Commands

```bash
./start                                # idempotent: start server detached (port 13001)
./stop                                 # kill the running server
node server.js                         # foreground (for debugging)
node import-clockify.js <csv> [csv …]  # import Clockify Detailed exports → data.json
                                       # (auto-backs up the existing data.json first)
node --test test/*.test.mjs            # run the test suite (Node's built-in runner)
```

Important: pass the glob (`test/*.test.mjs`), not the bare directory — on Node 25, `node --test test/` tries to load `test` as a module rather than scanning the folder.

The `start`/`stop` scripts are wired into the shell as `workify` / `workify-stop` (`~/.bash_aliases`), and `autostart.sh` is called from `~/.bashrc` so the server is up by the time any terminal is open. All hooks delegate to scripts in this folder — the project owns its lifecycle.

## Session backups

At the start of every Claude Code session in this repo, snapshot `data.json` to `bak/data-DD-MM-YYYY.json` (today's date in DD-MM-YYYY, matching the project's display convention). One backup per day — re-opening the same day overwrites the file. The `bak/` directory is gitignored.

```bash
cp data.json "bak/data-$(date +%d-%m-%Y).json"
```

## Architecture

### Module layout

```
index.html              # markup shell
css/styles.css          # all styles
js/package.json         # one-liner `{ "type": "module" }` so Node treats js/*.js as ESM
js/main.js              # boot: `new App().start()`
js/App.js               # top-level orchestrator (startup + mount + change-file + tabs)
js/util/                # TimeUtil, DateUtil, TextUtil, EntryGrouping (pure, no browser APIs)
js/storage/             # StorageAdapter, ServerAdapter, FsaAdapter, IDBHandleStore, Entry, Store
js/ui/                  # Overlay, SetupFlow, EntryForm, EntryList, EntryRow,
                        # ProjectSelect, TimeAdjustModal, CalendarPopup,
                        # SuggestPopup, ReportsView
test/                   # *.test.mjs — pure-logic specs only (no DOM)
```

ES modules — files import each other directly. The `Store` owns a `StorageAdapter`; views read/mutate the `Store` and pair each `await store.persist()` with an explicit re-render. There is no event bus.

### Conventions

OOP, applied with judgement — the goal is encapsulation and testability, not ceremony.

- **One class per file**, class name == file name (PascalCase). The few small helpers that earned their own file (`ProjectSelect`, `EntryGrouping`) followed the same rule.
- **Utility namespaces are classes with `static` methods** (`TimeUtil`, `DateUtil`, `TextUtil`, `EntryGrouping`). Don't sprinkle bare top-level functions into modules — keep them attached to a class.
- **Private fields and methods use `#`** for true runtime encapsulation. Public-by-default is fine for plain data on models (`Entry.startTime` etc.) — the mutators are the encapsulation boundary, not the field visibility.
- **Storage is behind an adapter** (`StorageAdapter` base + `ServerAdapter` / `FsaAdapter`). A new storage backend means a new adapter class, never a third branch in `Store`.
- **Entry owns its mutators** (`setStartTime`, `setEndTime`, `setDuration`, `adjustTime`) — they recompute paired fields. Callers must use those instead of assigning `entry.startTime = ...` directly, or the duration/endTime invariants will drift.
- **No globals, no module-scope state.** State lives on `Store` (data) or on view instances (UI state like `EntryList.page`). Constants that used to sit at module scope (`PROJECT_COLORS`, `HANDLE_KEY`) live as `static` (or `static #`) fields on the relevant class.
- **DOM stays in `js/ui/`.** When a UI class accumulates pure logic worth testing, extract it to `js/util/` (as `EntryGrouping` was extracted out of `EntryList`) rather than de-privatising the class.
- **Views receive their DOM elements via the constructor** (object-arg pattern: `new EntryList({ container, pageSizeSel, ... })`). No view does `document.getElementById` in its own constructor — `App` does the lookups once and wires them in.
- **Validate at boundaries.** Untrusted input (data loaded from `data.json`, payloads from the network) goes through validation at the model constructor. `Entry` falls back to safe defaults rather than throwing — corrupt data shouldn't crash app load — but invalid `HH:MM`, ISO dates, or duration values get cleaned at the boundary, not propagated to render time.

### Test-driven development

Going forward, **new features land with tests**. The flow:

1. Identify the pure-logic surface of the feature. If it lives inside a DOM-bound class, extract it into a static-method utility class under `js/util/` (or extend an existing one). DOM-bound classes themselves are intentionally untested.
2. Write a `test/<ClassName>.test.mjs` spec covering good paths, bad paths, and edge cases (empty/nullish input, boundary values, midnight wraps, invalid calendar dates, etc.) — see existing specs for the shape.
3. Implement the feature until the spec is green.
4. Run `node --test test/*.test.mjs`. **All 180+ tests must pass** before the feature is considered done.

Bug fixes: add a failing test that reproduces the bug first, then fix.

**Time-dependent tests** freeze `Date` via `mock.timers.enable({ apis: ['Date'], now: <millis> })` from `node:test` — see `test/DateUtil.test.mjs` for the pattern. Always teardown via `t.after(() => mock.timers.reset())`.

**Fetch-based code** mocks `globalThis.fetch` with save/restore — see `test/StorageAdapter.test.mjs`.

What is *not* tested (deliberately): `Overlay`, `SetupFlow`, `EntryForm`, `EntryRow`, `ProjectSelect`, `TimeAdjustModal`, `CalendarPopup`, `SuggestPopup`, `ReportsView`, `App`. Testing those requires JSDOM or a browser harness, which would drag in npm dependencies and contradict the project's zero-toolchain stance. If you find yourself wanting to test something in those classes, that's a signal to extract the testable logic into `js/util/`.

### Static SPA + tiny JSON server (dual mode)

`server.js` does two things only: serve the folder statically, and expose `GET /api/data` + `PUT /api/data` against `data.json`. The client supports two storage modes and picks one silently at startup (`SetupFlow.acquireAdapter()`):

- **Server mode** (default): on load, `fetch('/api/data')`. If it 200s, `Store` uses a `ServerAdapter` whose `save()` PUTs to `/api/data`.
- **FSA mode** (fallback): if there's no server endpoint, fall back to the File System Access API via `FsaAdapter`. The chosen `FileSystemFileHandle` is stashed in IndexedDB (`IDBHandleStore`) so it survives reloads. Only works in Chromium-based browsers on a secure origin (https/localhost) — not on `file://`.

Both modes implement the same `StorageAdapter` interface (`js/storage/StorageAdapter.js`); `Store` calls `load()`/`save()` against whichever it was given — don't add a third codepath.

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
- The app stores ISO internally and renders `DD/MM/YYYY` via `DateUtil.isoToDisplay()` / `DateUtil.displayToIso()`. **Never** persist the display format.
- The `Entry` class (`js/storage/Entry.js`) owns the gnarly mutators (`setStartTime`, `setEndTime`, `setDuration`, `adjustTime`) — they recompute paired fields so the form and the row don't each reinvent that logic. Mutate entries through those methods, not by assigning fields directly.

### UI invariants (don't accidentally regress)

- **Native `<input type="time">` and `<input type="date">` are intentionally NOT used.** Chromium ignores the page `lang` attribute and follows OS locale → AM/PM and MM/DD bleed through. Time and date inputs are plain `type="text"` driven by:
  - `TimeUtil.normalize()` — accepts `HH:MM`, `HH.MM`, `HH-MM`, and compact `1515`/`915`/`9`. Validates 23:59 max.
  - `DateUtil.displayToIso()` / `DateUtil.isoToDisplay()` — DD/MM/YYYY with `/`, `.`, `-` separators; 2-digit years (`>= 70` → 19xx, else 20xx).
  - `CalendarPopup` (`js/ui/CalendarPopup.js`) and `SuggestPopup` (`js/ui/SuggestPopup.js`) replace the native widgets entirely — both attach once at startup via global event delegation on `document.body`.
- **Pagination is day-aware** (`EntryList.#paginateByDay`). A date is the smallest pagination unit; a date overflowing `pageSize` still renders intact rather than being split.
- **Form date persists between adds**; only description is cleared. The time window chains: after adding an entry that ends 15:30, the form's next start = 15:30, end = 15:40 (see `Store.nextSlotForDate()`).
- **Default slot for an empty date is 07:15–07:25.**
- Entries are grouped in the list **by week then by day**; week labels are "This week", "Last week", else a date range like `Apr 27 – May 3` (`DateUtil.formatWeekLabel()`).
- Description suggestions are a **custom popup**, not `<datalist>` (which Chromium won't let us style).

### Reports tab

`ReportsView` (`js/ui/ReportsView.js`) handles everything. Charts are inline SVG generated in private `#renderBarChart` / `#renderDonut` — no chart library. Range options live in `#getRange` — the `custom` mode reads From/To text inputs (same DD/MM/YYYY widget as the tracker).

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
