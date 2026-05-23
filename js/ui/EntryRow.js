import { ProjectSelect } from './ProjectSelect.js';
import { TimeUtil } from '../util/TimeUtil.js';
import { DateUtil } from '../util/DateUtil.js';

export class EntryRow {
  constructor(entry, store, callbacks) {
    this.entry = entry;
    this.store = store;
    this.onSave = callbacks.onSave;
    this.onDelete = callbacks.onDelete;
    this.onAdjustTime = callbacks.onAdjustTime;
  }

  render(isOverlap, gapMinutes) {
    const e = this.entry;
    const row = document.createElement('div');
    let cls = 'entry-row';
    if (e.isZero) cls += ' zero';
    if (isOverlap) cls += ' overlap';
    if (gapMinutes) cls += ' gap';
    row.className = cls;
    const titles = [];
    if (e.isZero) titles.push('Zero-duration entry');
    if (isOverlap) titles.push('Time overlaps with another entry on this day');
    if (gapMinutes) titles.push(`${gapMinutes}-minute gap from previous entry`);
    if (titles.length) row.title = titles.join(' · ');
    row.dataset.id = e.id;
    row.innerHTML = `
      <input type="text" data-field="description" autocomplete="off">
      <select data-field="project"></select>
      <div class="time-range">
        <input type="text" data-field="startTime" class="time-input" inputmode="numeric" maxlength="5" placeholder="HH:MM" pattern="^(\\d{1,4}|\\d{1,2}[:.\\-\\s]\\d{1,2})$" value="${e.startTime}">
        <span>-</span>
        <input type="text" data-field="endTime" class="time-input" inputmode="numeric" maxlength="5" placeholder="HH:MM" pattern="^(\\d{1,4}|\\d{1,2}[:.\\-\\s]\\d{1,2})$" value="${e.endTime}">
      </div>
      <div class="date-field">
        <input type="text" data-field="date" class="date-input" inputmode="numeric" maxlength="10" placeholder="DD/MM/YYYY" pattern="^\\d{1,2}[./\\-]\\d{1,2}[./\\-]\\d{2,4}$" value="${DateUtil.isoToDisplay(e.date)}">
        <button type="button" class="date-trigger" aria-label="Open calendar">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
        </button>
      </div>
      <input type="text" data-field="duration" class="duration-input" value="${TimeUtil.formatDuration(e.duration)}" pattern="^(\\d{1,4}|\\d{1,2}[:.\\-\\s]\\d{1,2})$" title="HH:MM, or just minutes (30, 90), or compact (130 = 1:30)">
      <div class="row-actions">
        <button type="button" class="edit-btn" title="Adjust time (±)">±</button>
        <button type="button" class="delete-btn" title="Delete">×</button>
      </div>
    `;
    const descInput = row.querySelector('[data-field="description"]');
    descInput.value = e.description;
    descInput.title = e.description;
    descInput.addEventListener('input', () => { descInput.title = descInput.value; });
    const sel = row.querySelector('[data-field="project"]');
    const projSelect = new ProjectSelect(sel, this.store);
    projSelect.fill(e.project);

    row.addEventListener('change', async (ev) => {
      const t = ev.target;
      const field = t.dataset && t.dataset.field;
      if (!field) return;
      if (field === 'project') {
        e.setProject(await projSelect.handleNewSelection(e.project));
      } else if (field === 'duration') {
        const m = TimeUtil.parseDuration(t.value);
        if (m == null) {
          t.value = TimeUtil.formatDuration(e.duration);
          return;
        }
        e.setDuration(m);
        t.value = TimeUtil.formatDuration(e.duration);
      } else if (field === 'startTime') {
        const v = TimeUtil.normalize(t.value);
        if (!v) { t.value = e.startTime; return; }
        e.setStartTime(v);
        t.value = e.startTime;
      } else if (field === 'endTime') {
        const v = TimeUtil.normalize(t.value);
        if (!v) { t.value = e.endTime; return; }
        if (!e.setEndTime(v)) { t.value = e.endTime; return; }
        t.value = e.endTime;
      } else if (field === 'date') {
        const iso = DateUtil.displayToIso(t.value);
        if (!iso) { t.value = DateUtil.isoToDisplay(e.date); return; }
        t.value = DateUtil.isoToDisplay(iso);
        e.setDate(iso);
      } else if (field === 'description') {
        e.setDescription(t.value);
      } else {
        return;
      }
      await this.onSave();
    });

    row.querySelector('.edit-btn').addEventListener('click', () => {
      this.onAdjustTime(e);
    });
    row.querySelector('.delete-btn').addEventListener('click', async () => {
      if (!confirm('Delete this entry?')) return;
      await this.onDelete(e);
    });
    return row;
  }
}
