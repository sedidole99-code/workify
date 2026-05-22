import { DateUtil } from '../util/DateUtil.js';

export class CalendarPopup {
  constructor() {
    this.popup = null;
    this.activeInput = null;
    this.viewYear = 0;
    this.viewMonth = 0;
  }

  init() {
    this.popup = document.createElement('div');
    this.popup.className = 'cal-popup hidden';
    document.body.appendChild(this.popup);
    document.addEventListener('click', (e) => {
      if (this.popup.classList.contains('hidden')) return;
      if (this.popup.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.date-trigger')) return;
      this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
    window.addEventListener('scroll', () => this.close(), true);
    window.addEventListener('resize', () => this.close());

    document.body.addEventListener('click', (e) => {
      const trigger = e.target.closest && e.target.closest('.date-trigger');
      if (!trigger) return;
      const input = trigger.parentElement.querySelector('.date-input');
      if (!input) return;
      if (this.activeInput === input) {
        this.close();
      } else {
        this.open(input);
      }
    });
  }

  open(input) {
    this.activeInput = input;
    const iso = DateUtil.displayToIso(input.value) || DateUtil.todayISO();
    const [y, m] = iso.split('-').map(Number);
    this.viewYear = y;
    this.viewMonth = m - 1;
    this.popup.classList.remove('hidden');
    this.#render();
    const rect = input.getBoundingClientRect();
    const popupRect = this.popup.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - popupRect.width - 8;
    if (left > maxLeft) left = maxLeft;
    this.popup.style.left = left + 'px';
    this.popup.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  }

  close() {
    this.popup.classList.add('hidden');
    this.activeInput = null;
  }

  #render() {
    const y = this.viewYear, m = this.viewMonth;
    const firstDay = new Date(y, m, 1);
    const dow = DateUtil.mondayOffset(firstDay);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const monthName = firstDay.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    const selected = this.activeInput ? DateUtil.displayToIso(this.activeInput.value) : null;
    const todayIso = DateUtil.todayISO();

    let html = `
      <div class="cal-header">
        <button type="button" class="cal-nav" data-act="prev">‹</button>
        <span class="cal-title">${monthName}</span>
        <button type="button" class="cal-nav" data-act="next">›</button>
      </div>
      <div class="cal-grid">
    `;
    for (const d of ['Mo','Tu','We','Th','Fr','Sa','Su']) {
      html += `<div class="cal-dow">${d}</div>`;
    }
    for (let i = 0; i < dow; i++) html += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateIso = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const classes = ['cal-day'];
      if (dateIso === selected) classes.push('selected');
      if (dateIso === todayIso) classes.push('today');
      html += `<button type="button" class="${classes.join(' ')}" data-iso="${dateIso}">${d}</button>`;
    }
    html += '</div>';
    html += `<div class="cal-footer"><button type="button" class="cal-today" data-act="today">Today</button></div>`;
    this.popup.innerHTML = html;

    this.popup.querySelector('[data-act="prev"]').onclick = (e) => {
      e.stopPropagation();
      this.viewMonth--; if (this.viewMonth < 0) { this.viewMonth = 11; this.viewYear--; }
      this.#render();
    };
    this.popup.querySelector('[data-act="next"]').onclick = (e) => {
      e.stopPropagation();
      this.viewMonth++; if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++; }
      this.#render();
    };
    this.popup.querySelectorAll('[data-iso]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const iso = btn.dataset.iso;
        if (!this.activeInput) return;
        this.activeInput.value = DateUtil.isoToDisplay(iso);
        this.activeInput.dispatchEvent(new Event('change', { bubbles: true }));
        this.close();
      };
    });
    this.popup.querySelector('[data-act="today"]').onclick = (e) => {
      e.stopPropagation();
      if (!this.activeInput) return;
      this.activeInput.value = DateUtil.isoToDisplay(DateUtil.todayISO());
      this.activeInput.dispatchEvent(new Event('change', { bubbles: true }));
      this.close();
    };
  }
}
