import { TimeUtil } from '../util/TimeUtil.js';

export class Entry {
  constructor(data = {}) {
    this.id = data.id || Entry.#newId();
    this.description = Entry.#coerceString(data.description);
    this.project = data.project || null;
    this.startTime = Entry.#validTime(data.startTime);
    this.endTime = Entry.#validTime(data.endTime);
    this.date = Entry.#validIsoDate(data.date);
    this.duration = Entry.#validDuration(data.duration);
  }

  static #newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  static #coerceString(v) {
    if (v == null) return '';
    return String(v);
  }

  static #validTime(v) {
    if (!v) return '00:00';
    return TimeUtil.normalize(v) || '00:00';
  }

  static #validIsoDate(v) {
    if (!v || typeof v !== 'string') return '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
    const [y, m, d] = v.split('-').map(Number);
    const dt = new Date(`${v}T00:00:00`);
    if (isNaN(dt.getTime())) return '';
    if (dt.getFullYear() !== y || dt.getMonth() + 1 !== m || dt.getDate() !== d) return '';
    return v;
  }

  static #validDuration(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.trunc(n);
  }

  toJSON() {
    return {
      id: this.id,
      description: this.description,
      project: this.project,
      startTime: this.startTime,
      endTime: this.endTime,
      date: this.date,
      duration: this.duration,
    };
  }

  get isZero() {
    return !this.duration;
  }

  setStartTime(v) {
    const newStartM = TimeUtil.toMinutes(v);
    const oldStartM = TimeUtil.toMinutes(this.startTime);
    const endM = TimeUtil.toMinutes(this.endTime);
    this.startTime = v;
    if (endM <= newStartM) {
      const keepDur = endM > oldStartM ? endM - oldStartM : 10;
      this.endTime = TimeUtil.fromMinutes(Math.min(newStartM + keepDur, 23 * 60 + 59));
    }
    this.duration = TimeUtil.calcDuration(this.startTime, this.endTime);
  }

  setEndTime(v) {
    const newEndM = TimeUtil.toMinutes(v);
    const startM = TimeUtil.toMinutes(this.startTime);
    if (newEndM < startM) return false;
    this.endTime = v;
    this.duration = TimeUtil.calcDuration(this.startTime, this.endTime);
    return true;
  }

  setDuration(mins) {
    const startM = TimeUtil.toMinutes(this.startTime);
    const clamped = Math.max(0, Math.min(mins, 23 * 60 + 59 - startM));
    this.duration = clamped;
    this.endTime = TimeUtil.fromMinutes(startM + clamped);
  }

  setProject(name) {
    this.project = name;
  }

  setDate(iso) {
    this.date = iso;
  }

  setDescription(s) {
    this.description = s;
  }

  adjustTime(target, deltaMin) {
    const startM = TimeUtil.toMinutes(this.startTime);
    const endM = TimeUtil.toMinutes(this.endTime);
    if (target === 'start') {
      let newStartM = startM + deltaMin;
      if (newStartM < 0) newStartM = 0;
      if (newStartM > endM) newStartM = endM;
      this.startTime = TimeUtil.fromMinutes(newStartM);
      this.duration = endM - newStartM;
    } else {
      let newEndM = endM + deltaMin;
      if (newEndM < startM) newEndM = startM;
      this.endTime = TimeUtil.fromMinutes(newEndM);
      this.duration = newEndM - startM;
    }
  }
}
