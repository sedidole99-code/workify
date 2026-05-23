import { Overlay } from './ui/Overlay.js';
import { SetupFlow } from './ui/SetupFlow.js';
import { IDBHandleStore } from './storage/IDBHandleStore.js';
import { Store } from './storage/Store.js';
import { EntryForm } from './ui/EntryForm.js';
import { EntryList } from './ui/EntryList.js';
import { TimeAdjustModal } from './ui/TimeAdjustModal.js';
import { CalendarPopup } from './ui/CalendarPopup.js';
import { SuggestPopup } from './ui/SuggestPopup.js';
import { ReportsView } from './ui/ReportsView.js';

export class App {
  async start() {
    this.overlay = new Overlay(
      document.getElementById('overlayRoot'),
      document.getElementById('overlayCard'),
    );
    this.idbStore = new IDBHandleStore('workify', 'handles');
    this.setupFlow = new SetupFlow(this.overlay, this.idbStore);

    this.calendar = new CalendarPopup();
    this.calendar.init();

    const adapter = await this.setupFlow.acquireAdapter();
    if (!adapter) return;

    this.store = new Store(adapter);
    try {
      await this.store.load();
    } catch (err) {
      this.overlay.fatal(`<p>Failed to load data: ${err.message || err}</p>`);
      return;
    }

    this.#showFileInfo(adapter);

    if (this.store.projects.length === 0) {
      await this.setupFlow.askFirstProject(this.store);
    }

    this.overlay.hide();
    this.#mount();
  }

  #showFileInfo(adapter) {
    document.getElementById('fileName').textContent = adapter.name;
    document.getElementById('fileInfo').classList.remove('hidden');
    document.getElementById('changeFileBtn').classList.toggle('hidden', !adapter.canChange);
  }

  #mount() {
    document.getElementById('appRoot').classList.remove('hidden');

    this.suggest = new SuggestPopup(() => this.store.uniqueDescriptions());
    this.suggest.init();

    const refresh = () => {
      this.entryList.render();
      if (!document.getElementById('reportsView').classList.contains('hidden')) {
        this.reports.render();
      }
    };

    this.timeAdjustModal = new TimeAdjustModal(this.overlay, this.store, refresh);

    this.entryList = new EntryList({
      container: document.getElementById('entriesContainer'),
      pageSizeSel: document.getElementById('pageSize'),
      pageInfo: document.getElementById('pageInfo'),
      firstBtn: document.getElementById('firstPage'),
      prevBtn: document.getElementById('prevPage'),
      nextBtn: document.getElementById('nextPage'),
      lastBtn: document.getElementById('lastPage'),
      store: this.store,
      timeAdjustModal: this.timeAdjustModal,
    });

    this.entryForm = new EntryForm(
      document.getElementById('entryForm'),
      this.store,
      () => {
        this.entryList.resetPage();
        this.entryList.render();
      },
    );

    this.reports = new ReportsView({
      store: this.store,
      rangeSel: document.getElementById('reportRange'),
      customRange: document.getElementById('customRange'),
      from: document.getElementById('rangeFrom'),
      to: document.getElementById('rangeTo'),
      totalEl: document.getElementById('reportTotal'),
      chartSvg: document.getElementById('reportChart'),
      chartTip: document.getElementById('reportChartTip'),
      donutSvg: document.getElementById('reportDonut'),
      tbody: document.getElementById('reportProjectBody'),
    });

    this.entryList.bind();
    this.entryForm.bind();
    this.entryForm.reset();
    this.reports.bind();
    this.entryList.render();

    document.getElementById('changeFileBtn').addEventListener('click', async () => {
      const newAdapter = await this.setupFlow.promptPickFile();
      if (!newAdapter) return;
      this.store.adapter = newAdapter;
      try {
        await this.store.load();
      } catch (err) {
        this.overlay.fatal(`<p>Failed to load: ${err.message || err}</p>`);
        return;
      }
      this.#showFileInfo(newAdapter);
      if (this.store.projects.length === 0) {
        await this.setupFlow.askFirstProject(this.store);
      }
      this.overlay.hide();
      this.entryList.resetPage();
      this.entryList.render();
      this.entryForm.reset();
    });

    document.getElementById('viewTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      this.#switchView(tab.dataset.view);
    });
  }

  #switchView(view) {
    document.querySelectorAll('#viewTabs .tab').forEach(t => {
      t.classList.toggle('active', t.dataset.view === view);
    });
    document.getElementById('trackerView').classList.toggle('hidden', view !== 'tracker');
    document.getElementById('reportsView').classList.toggle('hidden', view !== 'reports');
    if (view === 'reports') this.reports.render();
  }
}
