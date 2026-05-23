import { TimeUtil } from '../util/TimeUtil.js';
import { DateUtil } from '../util/DateUtil.js';
import { TextUtil } from '../util/TextUtil.js';
import { EntryGrouping } from '../util/EntryGrouping.js';

export class ReportsView {
  static #PROJECT_COLORS = ['#03a9f4', '#4caf50', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4', '#ffeb3b', '#8bc34a', '#ff5722', '#673ab7'];


  constructor({ store, rangeSel, customRange, from, to, totalEl, chartSvg, chartTip, donutSvg, tbody }) {
    this.store = store;
    this.rangeSel = rangeSel;
    this.customRange = customRange;
    this.from = from;
    this.to = to;
    this.totalEl = totalEl;
    this.chartSvg = chartSvg;
    this.chartTip = chartTip;
    this.donutSvg = donutSvg;
    this.tbody = tbody;
  }

  bind() {
    this.rangeSel.addEventListener('change', () => {
      if (this.rangeSel.value === 'custom') {
        this.customRange.classList.remove('hidden');
        if (!DateUtil.displayToIso(this.from.value) || !DateUtil.displayToIso(this.to.value)) {
          const today = new Date();
          const first = new Date(today.getFullYear(), today.getMonth(), 1);
          this.from.value = DateUtil.isoToDisplay(DateUtil.dateToIso(first));
          this.to.value = DateUtil.isoToDisplay(DateUtil.dateToIso(today));
        }
      } else {
        this.customRange.classList.add('hidden');
      }
      this.render();
    });
    const onCustom = () => {
      if (this.rangeSel.value !== 'custom') this.rangeSel.value = 'custom';
      this.customRange.classList.remove('hidden');
      this.render();
    };
    this.from.addEventListener('change', onCustom);
    this.to.addEventListener('change', onCustom);

    if (this.chartTip) {
      this.chartSvg.addEventListener('mousemove', (e) => this.#onChartMove(e));
      this.chartSvg.addEventListener('mouseleave', () => { this.chartTip.hidden = true; });
    }
  }

  #onChartMove(e) {
    const target = e.target.closest('[data-tip]');
    if (!target) { this.chartTip.hidden = true; return; }
    const cardRect = this.chartSvg.parentElement.getBoundingClientRect();
    this.chartTip.textContent = target.getAttribute('data-tip');
    this.chartTip.style.left = (e.clientX - cardRect.left) + 'px';
    this.chartTip.style.top = (e.clientY - cardRect.top) + 'px';
    this.chartTip.hidden = false;
  }

  static #colorForIndex(i) {
    return ReportsView.#PROJECT_COLORS[i % ReportsView.#PROJECT_COLORS.length];
  }

  #getRange(key) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const t = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    switch (key) {
      case 'this-week': {
        const dow = DateUtil.mondayOffset(today);
        const start = new Date(today); start.setDate(today.getDate() - dow);
        const end = new Date(start); end.setDate(start.getDate() + 6);
        return [start, end];
      }
      case 'last-week': {
        const dow = DateUtil.mondayOffset(today);
        const end = new Date(today); end.setDate(today.getDate() - dow - 1);
        const start = new Date(end); start.setDate(end.getDate() - 6);
        return [start, end];
      }
      case 'this-month':
        return [new Date(today.getFullYear(), today.getMonth(), 1), new Date(today.getFullYear(), today.getMonth() + 1, 0)];
      case 'last-month':
        return [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0)];
      case 'last-30': {
        const start = new Date(today); start.setDate(today.getDate() - 29);
        return [start, t(today)];
      }
      case 'this-year':
        return [new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31)];
      case 'last-year':
        return [new Date(today.getFullYear() - 1, 0, 1), new Date(today.getFullYear() - 1, 11, 31)];
      case 'custom': {
        const fromIso = DateUtil.displayToIso(this.from.value);
        const toIso = DateUtil.displayToIso(this.to.value);
        if (!fromIso || !toIso) return this.#getRange('this-month');
        const from = new Date(fromIso + 'T00:00:00');
        const to = new Date(toIso + 'T00:00:00');
        return from <= to ? [from, to] : [to, from];
      }
      case 'all':
      default: {
        if (this.store.entries.length === 0) return [today, today];
        const dates = this.store.entries.map(e => e.date).sort();
        return [new Date(dates[0] + 'T00:00:00'), new Date(dates[dates.length - 1] + 'T00:00:00')];
      }
    }
  }

  #renderBarChart(data) {
    const svg = this.chartSvg;
    const W = 800, H = 280;
    const padTop = 24, padBottom = 44, padLeft = 56, padRight = 16;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    if (data.length === 0 || data.every(d => d.minutes === 0)) {
      svg.innerHTML = `<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#8a8fa3" font-size="14">No data for this range</text>`;
      return;
    }

    const maxMinutes = Math.max(...data.map(d => d.minutes));
    const niceMax = Math.max(60, Math.ceil(maxMinutes / 60) * 60);
    const stepCount = 4;
    const stepMin = Math.ceil(niceMax / stepCount / 60) * 60;
    const yMax = stepMin * stepCount;

    const barSlot = chartW / data.length;
    const barW = Math.max(2, Math.min(40, barSlot * 0.7));

    let html = '';
    for (let m = 0; m <= yMax; m += stepMin) {
      const y = padTop + chartH - (m / yMax) * chartH;
      html += `<line x1="${padLeft}" y1="${y}" x2="${W - padRight}" y2="${y}" stroke="rgba(255,255,255,0.06)" />`;
      html += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" fill="#8a8fa3" font-size="11">${TimeUtil.formatDuration(m)}</text>`;
    }

    const labelEvery = Math.max(1, Math.ceil(data.length / 12));
    data.forEach((d, i) => {
      const cx = padLeft + i * barSlot + barSlot / 2;
      const x = cx - barW / 2;
      const h = (d.minutes / yMax) * chartH;
      const y = padTop + chartH - h;
      if (d.minutes > 0) {
        const fill = d.overlap ? '#e74c3c' : '#03a9f4';
        const tip = `${DateUtil.formatFullDate(d.date)}: ${TimeUtil.formatDuration(d.minutes)}${d.overlap ? ' ⚠ overlap' : ''}`;
        html += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${fill}" rx="2" data-tip="${tip}" />`;
      }
      if (i % labelEvery === 0 || i === data.length - 1) {
        html += `<text x="${cx}" y="${H - padBottom + 16}" text-anchor="middle" fill="#8a8fa3" font-size="11">${DateUtil.formatShortDate(d.date)}</text>`;
      }
    });
    svg.innerHTML = html;
  }

  #renderDonut(items, total) {
    const svg = this.donutSvg;
    const cx = 100, cy = 100, r = 80, ir = 54;
    let html = '';
    if (!total || items.length === 0) {
      html = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#34374f" stroke-width="${r-ir}" />`;
      html += `<text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="#8a8fa3" font-size="14">No data</text>`;
      svg.innerHTML = html;
      return;
    }
    if (items.length === 1) {
      html += `<circle cx="${cx}" cy="${cy}" r="${(r+ir)/2}" fill="none" stroke="${ReportsView.#colorForIndex(0)}" stroke-width="${r-ir}" />`;
    } else {
      let start = -Math.PI / 2;
      items.forEach((item, i) => {
        const portion = item.minutes / total;
        const end = start + portion * Math.PI * 2;
        const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end),   y2 = cy + r * Math.sin(end);
        const x3 = cx + ir * Math.cos(end),  y3 = cy + ir * Math.sin(end);
        const x4 = cx + ir * Math.cos(start),y4 = cy + ir * Math.sin(start);
        const large = portion > 0.5 ? 1 : 0;
        html += `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${ir} ${ir} 0 ${large} 0 ${x4} ${y4} Z" fill="${ReportsView.#colorForIndex(i)}"><title>${TextUtil.escapeHtml(item.project)}: ${TimeUtil.formatDuration(item.minutes)}</title></path>`;
        start = end;
      });
    }
    html += `<text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="#e6e8f0" font-size="18" font-weight="600">${TimeUtil.formatDuration(total)}</text>`;
    svg.innerHTML = html;
  }

  render() {
    const rangeKey = this.rangeSel.value;
    const [start, end] = this.#getRange(rangeKey);
    const startIso = DateUtil.dateToIso(start), endIso = DateUtil.dateToIso(end);
    const inRange = this.store.entries.filter(e => e.date >= startIso && e.date <= endIso);
    const totalMins = inRange.reduce((s, e) => s + (e.duration || 0), 0);
    this.totalEl.textContent = TimeUtil.formatDuration(totalMins);

    const dailyMap = new Map();
    for (const e of inRange) dailyMap.set(e.date, (dailyMap.get(e.date) || 0) + (e.duration || 0));
    const overlapDates = EntryGrouping.findOverlapDates(inRange);
    const daily = [];
    if (rangeKey === 'all') {
      [...dailyMap.keys()].sort().forEach(d => daily.push({ date: d, minutes: dailyMap.get(d), overlap: overlapDates.has(d) }));
      if (daily.length === 0) daily.push({ date: DateUtil.dateToIso(new Date()), minutes: 0, overlap: false });
    } else {
      const d = new Date(start);
      while (d <= end) {
        const iso = DateUtil.dateToIso(d);
        daily.push({ date: iso, minutes: dailyMap.get(iso) || 0, overlap: overlapDates.has(iso) });
        d.setDate(d.getDate() + 1);
      }
    }
    this.#renderBarChart(daily);

    const projMap = new Map();
    for (const e of inRange) {
      const p = e.project || '(no project)';
      projMap.set(p, (projMap.get(p) || 0) + (e.duration || 0));
    }
    const projRows = [...projMap.entries()].sort((a, b) => b[1] - a[1]).map(([project, minutes]) => ({ project, minutes }));
    if (projRows.length === 0) {
      this.tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:1.25rem;">No entries in this range</td></tr>`;
    } else {
      this.tbody.innerHTML = projRows.map((row, i) => {
        const pct = totalMins > 0 ? Math.round(row.minutes / totalMins * 100) : 0;
        return `<tr>
          <td><span class="proj-dot" style="background:${ReportsView.#colorForIndex(i)}"></span>${TextUtil.escapeHtml(row.project)}</td>
          <td class="num">${TimeUtil.formatDuration(row.minutes)}</td>
          <td class="num">${pct}%</td>
        </tr>`;
      }).join('');
    }
    this.#renderDonut(projRows, totalMins);
  }
}
