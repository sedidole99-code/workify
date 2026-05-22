export class Overlay {
  constructor(root, card) {
    this.root = root;
    this.card = card;
  }

  show(html) {
    this.card.innerHTML = html;
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
    this.card.innerHTML = '';
  }

  fatal(message, title = 'Cannot start') {
    this.show(`
      <h2>${title}</h2>
      <div style="color: var(--muted); line-height: 1.5; font-size: 0.8125rem;">${message}</div>
    `);
  }
}
