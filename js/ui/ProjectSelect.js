export class ProjectSelect {
  static NEW_PROJECT_TOKEN = '__new__';

  constructor(selectEl, store) {
    this.select = selectEl;
    this.store = store;
  }

  fill(selected) {
    this.select.innerHTML = '';
    for (const p of this.store.projects) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      if (p === selected) opt.selected = true;
      this.select.appendChild(opt);
    }
    const opt = document.createElement('option');
    opt.value = ProjectSelect.NEW_PROJECT_TOKEN;
    opt.textContent = '+ Create project…';
    this.select.appendChild(opt);
  }

  async handleNewSelection(fallback) {
    if (this.select.value !== ProjectSelect.NEW_PROJECT_TOKEN) return this.select.value;
    const name = (prompt('New project name:') || '').trim();
    let chosen = fallback || this.store.projects[0];
    if (name) {
      const wasNew = !this.store.projects.includes(name);
      this.store.ensureProject(name);
      if (wasNew) await this.store.persist();
      chosen = name;
    }
    this.fill(chosen);
    return chosen;
  }
}
