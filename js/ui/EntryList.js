import { EntryRow } from './EntryRow.js';
import { TimeUtil } from '../util/TimeUtil.js';
import { DateUtil } from '../util/DateUtil.js';
import { EntryGrouping } from '../util/EntryGrouping.js';

export class EntryList {
  constructor({ container, pageSizeSel, pageInfo, firstBtn, prevBtn, nextBtn, lastBtn, store, timeAdjustModal }) {
    this.container = container;
    this.pageSizeSel = pageSizeSel;
    this.pageInfo = pageInfo;
    this.firstBtn = firstBtn;
    this.prevBtn = prevBtn;
    this.nextBtn = nextBtn;
    this.lastBtn = lastBtn;
    this.store = store;
    this.timeAdjustModal = timeAdjustModal;
    this.page = 1;
  }

  bind() {
    const offered = [...this.pageSizeSel.options].map(o => parseInt(o.value, 10));
    if (!offered.includes(this.store.pageSize)) {
      const opt = document.createElement('option');
      opt.value = String(this.store.pageSize);
      opt.textContent = String(this.store.pageSize);
      this.pageSizeSel.appendChild(opt);
    }
    this.pageSizeSel.value = String(this.store.pageSize);
    this.pageSizeSel.addEventListener('change', async () => {
      this.store.pageSize = parseInt(this.pageSizeSel.value, 10);
      this.page = 1;
      await this.store.persist();
      this.render();
    });
    const go = (fn) => () => { fn(); this.render(); window.scrollTo({ top: 0, behavior: 'auto' }); };
    this.firstBtn.addEventListener('click', go(() => { this.page = 1; }));
    this.prevBtn.addEventListener('click', go(() => { this.page--; }));
    this.nextBtn.addEventListener('click', go(() => { this.page++; }));
    this.lastBtn.addEventListener('click', go(() => { this.page = Infinity; }));
  }

  resetPage() {
    this.page = 1;
  }

  static #DAY_TARGET_MIN = 8 * 60;
  static #FULL_WEEK_TARGET_MIN = 40 * 60;

  render() {
    const sorted = [...this.store.entries].sort(
      (a, b) => EntryGrouping.sortKey(b).localeCompare(EntryGrouping.sortKey(a))
    );
    const weekTotals = this.#computeWeekTotals(sorted);
    const pages = EntryGrouping.paginateByDay(sorted, this.store.pageSize);
    const totalPages = pages.length;
    this.page = Math.max(1, Math.min(this.page, totalPages));
    const pageItems = pages[this.page - 1] || [];

    this.container.innerHTML = '';
    if (pageItems.length === 0) {
      this.container.appendChild(this.#renderEmpty());
    } else {
      const weeks = this.#groupByWeekDay(pageItems);
      for (const [wkStart, days] of weeks) {
        this.container.appendChild(this.#renderWeek(wkStart, days, weekTotals.get(wkStart) || 0));
      }
    }
    this.#updatePagination(sorted.length, totalPages);
  }

  #computeWeekTotals(entries) {
    const totals = new Map();
    for (const e of entries) {
      const wk = DateUtil.weekStartIso(e.date);
      totals.set(wk, (totals.get(wk) || 0) + (e.duration || 0));
    }
    return totals;
  }

  #groupByWeekDay(entries) {
    const weeks = new Map();
    for (const e of entries) {
      const wk = DateUtil.weekStartIso(e.date);
      if (!weeks.has(wk)) weeks.set(wk, new Map());
      const days = weeks.get(wk);
      if (!days.has(e.date)) days.set(e.date, []);
      days.get(e.date).push(e);
    }
    return weeks;
  }

  static #weekTarget(wkStart) {
    if (!DateUtil.isThisWeek(wkStart)) return EntryList.#FULL_WEEK_TARGET_MIN;
    const dow = DateUtil.mondayOffset(new Date());
    const elapsedDays = Math.min(5, dow + 1);
    return elapsedDays * EntryList.#DAY_TARGET_MIN;
  }

  #renderEmpty() {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No time entries yet. Add your first one above.';
    return empty;
  }

  #renderWeek(wkStart, days, wkTotal) {
    const weekEl = document.createElement('div');
    weekEl.className = 'week-group';
    const wkTarget = EntryList.#weekTarget(wkStart);
    const wkHeader = document.createElement('div');
    wkHeader.className = 'week-header' + (wkTotal < wkTarget ? ' under' : '');
    wkHeader.innerHTML = `<span class="week-label">${DateUtil.formatWeekLabel(wkStart)}</span><span class="week-total-line">Week total: <strong>${TimeUtil.formatDuration(wkTotal)}</strong></span>`;
    weekEl.appendChild(wkHeader);
    for (const [date, items] of days) {
      weekEl.appendChild(this.#renderDay(date, items));
    }
    return weekEl;
  }

  #renderDay(date, items) {
    const dayEl = document.createElement('div');
    dayEl.className = 'day-group';
    dayEl.appendChild(EntryList.#renderDayHeader(date, items));
    const overlapIds = EntryGrouping.findOverlapIds(items);
    const gapIds = EntryGrouping.findGapIds(items);
    for (const entry of items) {
      dayEl.appendChild(this.#buildRow(entry, overlapIds.has(entry.id), gapIds.get(entry.id)));
    }
    return dayEl;
  }

  static #renderDayHeader(date, items) {
    const dayTotal = items.reduce((s, e) => s + (e.duration || 0), 0);
    const header = document.createElement('div');
    let cls = 'day-header';
    let delta = '';
    if (dayTotal < EntryList.#DAY_TARGET_MIN) {
      cls += ' under';
      delta = ` <span class="day-delta">(−${TimeUtil.formatDuration(EntryList.#DAY_TARGET_MIN - dayTotal)})</span>`;
    } else if (dayTotal > EntryList.#DAY_TARGET_MIN) {
      cls += ' over';
      delta = ` <span class="day-delta">(+${TimeUtil.formatDuration(dayTotal - EntryList.#DAY_TARGET_MIN)})</span>`;
    }
    header.className = cls;
    header.innerHTML = `<span>${DateUtil.formatFriendly(date)}</span><span>Total: <span class="day-total">${TimeUtil.formatDuration(dayTotal)}</span>${delta}</span>`;
    return header;
  }

  #buildRow(entry, isOverlap, gapMinutes) {
    const row = new EntryRow(entry, this.store, {
      onSave: async () => { await this.store.persist(); this.render(); },
      onDelete: async (e) => {
        this.store.deleteEntry(e.id);
        await this.store.persist();
        this.render();
      },
      onAdjustTime: (e) => this.timeAdjustModal.open(e),
    });
    return row.render(isOverlap, gapMinutes);
  }

  #updatePagination(total, totalPages) {
    this.pageInfo.textContent = `${this.page} / ${totalPages} · ${total} ${total === 1 ? 'entry' : 'entries'}`;
    this.firstBtn.disabled = this.page <= 1;
    this.prevBtn.disabled = this.page <= 1;
    this.nextBtn.disabled = this.page >= totalPages;
    this.lastBtn.disabled = this.page >= totalPages;
  }
}
