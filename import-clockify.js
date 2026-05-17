// Workify — import Clockify "Detailed" CSV exports into the app's data.json.
//
// Usage:
//   node import-clockify.js Clockify_..._2025.csv Clockify_..._2026.csv [...]
//
// What it does:
//   1. Parses each CSV row -> entry { id, description, project, date, startTime, endTime, duration }
//   2. Writes a combined data-31-12-2026.json shaped like the app expects.
//   3. Backs up existing data.json to data.json.bak-<timestamp>.
//   4. Copies the new file over data.json so the running server picks it up.
//
// Expected columns (from Clockify's Detailed export):
//   Project, Client, Description, Task, User, Group, Email, Tags, Billable,
//   Start Date, Start Time, End Date, End Time, Duration (h), Duration (decimal),
//   Billable Rate (USD), Billable Amount (USD), Date of creation

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, 'data-31-12-2026.json');
const DATA_FILE = path.join(ROOT, 'data.json');
const BAK_DIR = path.join(ROOT, 'bak');

// ---------- CSV parser (RFC-4180-ish: quoted fields, escaped "") ----------
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM
  const rows = [];
  let cur = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\r') { /* swallow */ }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else field += c;
    }
  }
  if (field !== '' || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function ddmmyyyyToIso(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const month = m[2].padStart(2, '0');
  const year = m[3];
  return `${year}-${month}-${day}`;
}

function hmsToHm(s) {
  const m = String(s || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function durationToMin(s) {
  const m = String(s || '').trim().match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const ss = parseInt(m[3] || '0', 10);
  return h * 60 + mm + (ss >= 30 ? 1 : 0); // round seconds to nearest minute
}

function loadCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(text);
  if (rows.length < 1) throw new Error(`${filePath}: empty`);
  const header = rows[0];
  const find = (name) => {
    const i = header.findIndex(h => h.trim().toLowerCase() === name.toLowerCase());
    if (i < 0) throw new Error(`${filePath}: missing column "${name}"`);
    return i;
  };
  const idx = {
    project: find('Project'),
    description: find('Description'),
    startDate: find('Start Date'),
    startTime: find('Start Time'),
    endTime: find('End Time'),
    duration: find('Duration (h)'),
  };
  const entries = [];
  let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < header.length) { skipped++; continue; }
    const project = (row[idx.project] || '').trim();
    const description = (row[idx.description] || '').trim();
    const startDate = ddmmyyyyToIso(row[idx.startDate]);
    const startTime = hmsToHm(row[idx.startTime]);
    const endTime = hmsToHm(row[idx.endTime]);
    const duration = durationToMin(row[idx.duration]);
    if (!project || !startDate || !startTime || !endTime) {
      skipped++;
      continue;
    }
    entries.push({ project, description, date: startDate, startTime, endTime, duration });
  }
  return { entries, skipped };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node import-clockify.js <file.csv> [more.csv ...]');
    process.exit(1);
  }
  for (const f of args) {
    if (!fs.existsSync(f)) { console.error(`Not found: ${f}`); process.exit(1); }
  }

  let all = [];
  for (const f of args) {
    const { entries, skipped } = loadCsv(f);
    console.log(`  ${path.basename(f)}: ${entries.length} entries${skipped ? `, ${skipped} skipped` : ''}`);
    all = all.concat(entries);
  }

  // Sort ascending so older entries appear first when paging back
  all.sort((a, b) => (a.date + ' ' + a.startTime).localeCompare(b.date + ' ' + b.startTime));

  // Stable IDs per import run
  const stamp = Date.now().toString(36);
  all.forEach((e, i) => { e.id = `imp-${stamp}-${i.toString(36)}`; });

  // Build projects list + most-used as lastProject
  const counts = new Map();
  for (const e of all) counts.set(e.project, (counts.get(e.project) || 0) + 1);
  const projects = [...counts.keys()];
  const lastProject = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const data = { entries: all, projects, lastProject, pageSize: 50 };
  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2));
  console.log(`\nWrote ${path.basename(OUTPUT)}: ${all.length} entries, ${projects.length} project(s).`);
  console.log(`  Default project: ${lastProject}`);

  // Backup + swap
  if (fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(BAK_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const backup = path.join(BAK_DIR, `data.json.bak-${ts}`);
    fs.copyFileSync(DATA_FILE, backup);
    console.log(`Backed up data.json -> bak/${path.basename(backup)}`);
  }
  fs.copyFileSync(OUTPUT, DATA_FILE);
  console.log(`Copied -> data.json. Reload the running app to see imported entries.`);
}

main();
