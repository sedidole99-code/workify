import { ServerAdapter } from '../storage/ServerAdapter.js';
import { FsaAdapter } from '../storage/FsaAdapter.js';

export class SetupFlow {
  static #HANDLE_KEY = 'dataFile';


  constructor(overlay, idbStore) {
    this.overlay = overlay;
    this.idbStore = idbStore;
  }

  async acquireAdapter() {
    if (await this.#serverAvailable()) {
      return new ServerAdapter();
    }
    if (!this.#hasFsa()) {
      this.#showFatalNoFsa();
      return null;
    }
    try {
      const stored = await this.idbStore.get(SetupFlow.#HANDLE_KEY);
      if (stored) {
        if (await SetupFlow.#hasPermission(stored)) {
          return new FsaAdapter(stored);
        }
        return await this.#promptReconnect(stored);
      }
    } catch (err) {
      console.warn('Startup error', err);
    }
    return await this.promptPickFile();
  }

  async #serverAvailable() {
    if (location.protocol === 'file:') return false;
    try {
      const res = await fetch('/api/data', { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  #hasFsa() {
    return ('showSaveFilePicker' in window) && ('showOpenFilePicker' in window);
  }

  static async #hasPermission(handle) {
    return (await handle.queryPermission({ mode: 'readwrite' })) === 'granted';
  }

  static async #requestPermission(handle) {
    return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
  }

  #showFatalNoFsa() {
    const instructions =
      '<p>For the easiest setup, run the included server (works in any browser):</p>' +
      '<pre style="background:var(--surface-2);padding:0.625rem;border-radius:var(--radius);margin-top:0.375rem;font-size:0.75rem;overflow:auto;color:var(--text);">node server.js</pre>' +
      '<p>Then open <code>http://localhost:13001</code>.</p>';
    if (location.protocol === 'file:') {
      this.overlay.fatal(
        '<p>Workify can\'t persist data when opened directly from disk (<code>file://</code>).</p>' +
        instructions +
        '<p style="margin-top:0.875rem;">Or, in Chrome/Edge, serve this folder over <code>http://localhost</code> with any static server to enable the File System Access API.</p>',
        'Run the local server'
      );
    } else {
      this.overlay.fatal(
        '<p>This browser doesn\'t expose the File System Access API.</p>' +
        instructions +
        '<p style="margin-top:0.875rem;">Or open this URL in Chrome/Edge/Opera to use the file-picker mode instead.</p>',
        'Use the local server, or switch browsers'
      );
    }
  }

  #promptReconnect(stored) {
    return new Promise(resolve => {
      this.overlay.show(`
        <h2>Reconnect to your data file</h2>
        <p>Workify needs your permission to read and write <code>${stored.name}</code>.</p>
        <div class="actions">
          <button type="button" class="primary" id="reconnectBtn">Grant access</button>
          <button type="button" id="pickDifferentBtn">Choose different file…</button>
        </div>
      `);
      document.getElementById('reconnectBtn').onclick = async () => {
        if (await SetupFlow.#requestPermission(stored)) {
          resolve(new FsaAdapter(stored));
        } else {
          alert('Permission denied. Try again or choose a different file.');
        }
      };
      document.getElementById('pickDifferentBtn').onclick = async () => {
        resolve(await this.promptPickFile());
      };
    });
  }

  promptPickFile() {
    return new Promise(resolve => {
      this.overlay.show(`
        <h2>Workify · Set up your data file</h2>
        <p>Workify saves your time entries to a single JSON file on disk. Pick an existing file or create a new one — the same file can be opened in any browser on this machine to see the same data.</p>
        <div class="actions">
          <button type="button" class="primary" id="createNewBtn">Create new file…</button>
          <button type="button" id="openExistingBtn">Open existing…</button>
        </div>
        <div class="error hidden" id="setupError"></div>
      `);

      const setError = (msg) => {
        const el = document.getElementById('setupError');
        if (el) { el.textContent = msg; el.classList.remove('hidden'); }
      };

      document.getElementById('createNewBtn').onclick = async () => {
        try {
          const h = await window.showSaveFilePicker({
            suggestedName: 'workify-data.json',
            types: [{ description: 'Workify data', accept: { 'application/json': ['.json'] } }],
          });
          await this.idbStore.set(SetupFlow.#HANDLE_KEY, h);
          const adapter = new FsaAdapter(h);
          await adapter.save({ entries: [], projects: [], lastProject: null, pageSize: 50 });
          resolve(adapter);
        } catch (err) {
          if (err.name !== 'AbortError') setError(err.message);
        }
      };
      document.getElementById('openExistingBtn').onclick = async () => {
        try {
          const [h] = await window.showOpenFilePicker({
            types: [{ description: 'Workify data', accept: { 'application/json': ['.json'] } }],
            multiple: false,
          });
          if (!await SetupFlow.#hasPermission(h)) {
            if (!await SetupFlow.#requestPermission(h)) {
              setError('Permission denied.');
              return;
            }
          }
          await this.idbStore.set(SetupFlow.#HANDLE_KEY, h);
          resolve(new FsaAdapter(h));
        } catch (err) {
          if (err.name !== 'AbortError') setError(err.message);
        }
      };
    });
  }

  askFirstProject(store) {
    return new Promise(resolve => {
      this.overlay.show(`
        <h2>Create your first project</h2>
        <p>Workify groups time entries by project. Name your first one to get started — you can add more later.</p>
        <input type="text" id="firstProjectInput" placeholder="e.g. Acme Website" autofocus>
        <div class="actions">
          <button type="button" class="primary" id="createProjectBtn">Create project</button>
        </div>
      `);
      const input = document.getElementById('firstProjectInput');
      setTimeout(() => input.focus(), 50);
      const submit = async () => {
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        store.ensureProject(name);
        store.lastProject = name;
        await store.persist();
        resolve();
      };
      document.getElementById('createProjectBtn').onclick = submit;
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    });
  }
}
