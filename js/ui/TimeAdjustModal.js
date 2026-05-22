import { TimeUtil } from '../util/TimeUtil.js';

export class TimeAdjustModal {
  constructor(overlay, store, onAfterApply) {
    this.overlay = overlay;
    this.store = store;
    this.onAfterApply = onAfterApply;
    this.escHandler = null;
  }

  open(entry) {
    let op = '+';
    let target = 'end';
    const html = `
      <h2>Adjust time</h2>
      <div class="time-adjust-meta">
        <strong>${entry.startTime}–${entry.endTime}</strong> · ${entry.description || '<em style="color:var(--muted)">(no description)</em>'}
      </div>
      <div class="time-adjust-row">
        <div class="op-toggle">
          <button type="button" data-op="+" class="op-btn active">+</button>
          <button type="button" data-op="-" class="op-btn">−</button>
        </div>
        <div class="op-toggle">
          <button type="button" data-target="start" class="target-btn">Start</button>
          <button type="button" data-target="end" class="target-btn active">End</button>
        </div>
        <input type="text" id="timeAdjustInput" class="time-adjust-input" value="00:10" pattern="^\\d{1,3}:[0-5][0-9]$" placeholder="HH:MM" inputmode="numeric" maxlength="6">
      </div>
      <div class="actions">
        <button type="button" id="timeAdjustApply" class="primary">Apply</button>
        <button type="button" id="timeAdjustCancel">Cancel</button>
      </div>
    `;
    this.overlay.show(html);
    const card = this.overlay.card;
    const input = document.getElementById('timeAdjustInput');
    const opButtons = card.querySelectorAll('.op-btn');
    opButtons.forEach(b => {
      b.addEventListener('click', () => {
        op = b.dataset.op;
        opButtons.forEach(x => x.classList.toggle('active', x.dataset.op === op));
        input.focus();
      });
    });
    const targetButtons = card.querySelectorAll('.target-btn');
    targetButtons.forEach(b => {
      b.addEventListener('click', () => {
        target = b.dataset.target;
        targetButtons.forEach(x => x.classList.toggle('active', x.dataset.target === target));
        input.focus();
      });
    });

    const close = () => {
      document.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
      this.overlay.hide();
    };

    const apply = async () => {
      const mins = TimeUtil.parseDuration(input.value);
      if (mins == null || mins === 0) {
        input.focus();
        input.select();
        return;
      }
      const delta = op === '+' ? mins : -mins;
      entry.adjustTime(target, delta);
      await this.store.persist();
      close();
      if (this.onAfterApply) this.onAfterApply();
    };

    document.getElementById('timeAdjustApply').addEventListener('click', apply);
    document.getElementById('timeAdjustCancel').addEventListener('click', close);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); apply(); }
    });
    this.escHandler = (ev) => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', this.escHandler);

    setTimeout(() => { input.focus(); input.select(); }, 0);
  }
}
