import { Entry } from '../storage/Entry.js';
import { TimeUtil } from '../util/TimeUtil.js';
import { DateUtil } from '../util/DateUtil.js';
import { ProjectSelect } from './ProjectSelect.js';

export class EntryForm {
  constructor(formEl, store, onAdd) {
    this.form = formEl;
    this.store = store;
    this.onAdd = onAdd;
    this.fDesc = formEl.elements.description;
    this.fProj = formEl.elements.project;
    this.fStart = formEl.elements.startTime;
    this.fEnd = formEl.elements.endTime;
    this.fDate = formEl.elements.date;
    this.fDur = formEl.elements.duration;
    this.projectSelect = new ProjectSelect(this.fProj, store);
  }

  bind() {
    this.fStart.addEventListener('focus', () => { this.fStart.dataset.prev = this.fStart.value; });
    this.fStart.addEventListener('change', () => this.#onStartChange());
    this.fStart.addEventListener('blur', () => this.#onStartChange());
    this.fEnd.addEventListener('change', () => this.#onEndChange());
    this.fEnd.addEventListener('blur', () => this.#onEndChange());
    this.fDur.addEventListener('change', () => this.#onDurChange());
    this.fProj.addEventListener('change', async () => {
      await this.projectSelect.handleNewSelection(this.store.lastProject);
    });
    this.fDate.addEventListener('change', () => this.#onDateChange());
    this.form.addEventListener('submit', (e) => this.#onSubmit(e));
  }

  reset({ keepProject = true } = {}) {
    this.fDesc.value = '';
    const currentIso = DateUtil.displayToIso(this.fDate.value) || DateUtil.todayISO();
    this.fDate.value = DateUtil.isoToDisplay(currentIso);
    const slot = this.store.nextSlotForDate(currentIso);
    this.fStart.value = slot.start;
    this.fEnd.value = slot.end;
    this.fDur.value = TimeUtil.formatDuration(TimeUtil.calcDuration(slot.start, slot.end));
    this.projectSelect.fill(keepProject ? (this.store.lastProject || this.store.projects[0]) : this.store.projects[0]);
    this.fDesc.focus();
  }

  #syncDurationFromTimes() {
    if (this.fStart.value && this.fEnd.value) {
      this.fDur.value = TimeUtil.formatDuration(TimeUtil.calcDuration(this.fStart.value, this.fEnd.value));
    }
  }

  #onStartChange() {
    const prev = this.fStart.dataset.prev;
    const v = TimeUtil.normalize(this.fStart.value);
    if (v) this.fStart.value = v;
    if (this.fStart.value && this.fEnd.value) {
      const startM = TimeUtil.toMinutes(this.fStart.value);
      const endM = TimeUtil.toMinutes(this.fEnd.value);
      if (endM <= startM) {
        let dur = 10;
        if (prev) {
          const prevM = TimeUtil.toMinutes(prev);
          if (endM > prevM) dur = endM - prevM;
        }
        this.fEnd.value = TimeUtil.fromMinutes(startM + dur);
      }
    }
    this.#syncDurationFromTimes();
    this.fStart.dataset.prev = this.fStart.value;
  }

  #onEndChange() {
    const v = TimeUtil.normalize(this.fEnd.value);
    if (v) this.fEnd.value = v;
    if (this.fStart.value && this.fEnd.value) {
      const startM = TimeUtil.toMinutes(this.fStart.value);
      const endM = TimeUtil.toMinutes(this.fEnd.value);
      if (endM < startM) this.fEnd.value = this.fStart.value;
    }
    this.#syncDurationFromTimes();
  }

  #onDurChange() {
    const m = TimeUtil.parseDuration(this.fDur.value);
    if (m != null && this.fStart.value) {
      const startM = TimeUtil.toMinutes(this.fStart.value);
      const clamped = Math.max(0, Math.min(m, 23 * 60 + 59 - startM));
      this.fEnd.value = TimeUtil.fromMinutes(startM + clamped);
    }
    this.#syncDurationFromTimes();
  }

  #onDateChange() {
    const iso = DateUtil.displayToIso(this.fDate.value);
    if (!iso) {
      this.fDate.value = DateUtil.isoToDisplay(DateUtil.todayISO());
      return;
    }
    this.fDate.value = DateUtil.isoToDisplay(iso);
    const slot = this.store.nextSlotForDate(iso);
    this.fStart.value = slot.start;
    this.fEnd.value = slot.end;
    this.#syncDurationFromTimes();
  }

  async #onSubmit(ev) {
    ev.preventDefault();
    const project = await this.projectSelect.handleNewSelection(this.store.lastProject);
    if (!project) return;
    const startTime = TimeUtil.normalize(this.fStart.value);
    const endTime = TimeUtil.normalize(this.fEnd.value);
    const dateIso = DateUtil.displayToIso(this.fDate.value);
    if (!startTime || !endTime || !dateIso) return;
    const duration = TimeUtil.parseDuration(this.fDur.value);
    const finalDuration = duration != null ? duration : TimeUtil.calcDuration(startTime, endTime);
    const entry = new Entry({
      description: this.fDesc.value.trim(),
      project,
      startTime,
      endTime,
      date: dateIso,
      duration: finalDuration,
    });
    this.store.addEntry(entry);
    this.store.lastProject = project;
    await this.store.persist();
    this.reset({ keepProject: true });
    if (this.onAdd) this.onAdd();
  }
}
