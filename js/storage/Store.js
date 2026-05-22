import { Entry } from './Entry.js';
import { TimeUtil } from '../util/TimeUtil.js';

export class Store {
  constructor(adapter) {
    this.adapter = adapter;
    this.entries = [];
    this.projects = [];
    this.lastProject = null;
    this.pageSize = 50;
  }

  async load() {
    const data = await this.adapter.load();
    this.#apply(data);
  }

  #apply(data) {
    if (!data || typeof data !== 'object') {
      this.entries = [];
      this.projects = [];
      this.lastProject = null;
      this.pageSize = 50;
      return;
    }
    this.entries = Array.isArray(data.entries) ? data.entries.map(e => new Entry(e)) : [];
    this.projects = Array.isArray(data.projects) ? data.projects : [];
    this.lastProject = data.lastProject || null;
    this.pageSize = Number.isFinite(data.pageSize) ? data.pageSize : 50;
  }

  toJSON() {
    return {
      entries: this.entries,
      projects: this.projects,
      lastProject: this.lastProject,
      pageSize: this.pageSize,
    };
  }

  async persist() {
    await this.adapter.save(this.toJSON());
  }

  addEntry(data) {
    const e = data instanceof Entry ? data : new Entry(data);
    this.entries.push(e);
    return e;
  }

  deleteEntry(id) {
    this.entries = this.entries.filter(e => e.id !== id);
  }

  findEntry(id) {
    return this.entries.find(e => e.id === id);
  }

  ensureProject(name) {
    if (!this.projects.includes(name)) this.projects.push(name);
  }

  uniqueDescriptions() {
    const seen = new Set();
    const items = [];
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const d = this.entries[i].description;
      if (!d || seen.has(d)) continue;
      seen.add(d);
      items.push(d);
    }
    return items;
  }

  nextSlotForDate(dateStr) {
    const onDate = this.entries.filter(e => e.date === dateStr);
    if (onDate.length === 0) return { start: '07:15', end: '07:25' };
    const latest = onDate.reduce((a, b) =>
      TimeUtil.toMinutes(b.endTime) > TimeUtil.toMinutes(a.endTime) ? b : a
    );
    const startM = TimeUtil.toMinutes(latest.endTime);
    return { start: TimeUtil.fromMinutes(startM), end: TimeUtil.fromMinutes(startM + 10) };
  }
}
