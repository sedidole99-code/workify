import { TextUtil } from '../util/TextUtil.js';

export class SuggestPopup {
  constructor(getSuggestions) {
    this.getSuggestions = getSuggestions;
    this.popup = null;
    this.activeInput = null;
    this.items = [];
    this.highlight = -1;
  }

  init() {
    this.popup = document.createElement('div');
    this.popup.className = 'sug-popup hidden';
    document.body.appendChild(this.popup);
    document.addEventListener('mousedown', (e) => {
      if (this.popup.classList.contains('hidden')) return;
      if (this.popup.contains(e.target)) return;
      if (e.target === this.activeInput) return;
      this.close();
    });
    window.addEventListener('scroll', () => this.close(), true);
    window.addEventListener('resize', () => this.activeInput && this.#position());

    document.body.addEventListener('focusin', (e) => {
      if (!SuggestPopup.#isDescriptionInput(e.target)) return;
      this.open(e.target);
    });
    document.body.addEventListener('input', (e) => {
      if (this.activeInput !== e.target) return;
      this.update();
    });
    document.body.addEventListener('keydown', (e) => {
      if (this.activeInput !== e.target) return;
      this.#handleKey(e);
    });
  }

  static #isDescriptionInput(el) {
    if (!el || el.tagName !== 'INPUT') return false;
    return el.name === 'description' || el.dataset.field === 'description';
  }

  open(input) {
    this.activeInput = input;
    this.update();
  }

  update() {
    if (!this.activeInput) return;
    const query = (this.activeInput.value || '').trim();
    const all = this.getSuggestions();
    const q = query.toLowerCase();
    let items;
    if (!q) {
      items = all.slice(0, 7);
    } else {
      items = all.filter(d => d.toLowerCase().includes(q) && d.toLowerCase() !== q).slice(0, 7);
    }
    this.items = items;
    if (items.length === 0) { this.close(); return; }
    this.highlight = -1;
    this.popup.classList.remove('hidden');
    this.#render(query);
    this.#position();
  }

  #position() {
    if (!this.activeInput) return;
    const rect = this.activeInput.getBoundingClientRect();
    this.popup.style.left = (rect.left + window.scrollX) + 'px';
    this.popup.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    this.popup.style.width = rect.width + 'px';
  }

  #render(query) {
    const q = (query || '').trim();
    const re = q ? new RegExp('(' + TextUtil.escapeReg(q) + ')', 'ig') : null;
    let html = '';
    this.items.forEach((item, i) => {
      const classes = ['sug-item'];
      if (i === this.highlight) classes.push('active');
      const safe = TextUtil.escapeHtml(item);
      const display = re ? safe.replace(re, '<span class="match">$1</span>') : safe;
      html += `<button type="button" class="${classes.join(' ')}" data-idx="${i}">${display}</button>`;
    });
    this.popup.innerHTML = html;
    this.popup.querySelectorAll('[data-idx]').forEach(btn => {
      btn.onmousedown = (e) => {
        e.preventDefault();
        this.#choose(parseInt(btn.dataset.idx, 10));
      };
    });
  }

  #choose(idx) {
    if (!this.activeInput || idx < 0 || idx >= this.items.length) return;
    this.activeInput.value = this.items[idx];
    this.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    this.activeInput.dispatchEvent(new Event('change', { bubbles: true }));
    this.close();
  }

  close() {
    this.popup.classList.add('hidden');
    this.activeInput = null;
    this.items = [];
    this.highlight = -1;
  }

  #handleKey(e) {
    if (this.popup.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.highlight = Math.min(this.items.length - 1, this.highlight + 1);
      this.#render(this.activeInput.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.highlight = Math.max(-1, this.highlight - 1);
      this.#render(this.activeInput.value);
    } else if (e.key === 'Enter' && this.highlight >= 0) {
      e.preventDefault();
      this.#choose(this.highlight);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (e.key === 'Tab') {
      this.close();
    }
  }
}
