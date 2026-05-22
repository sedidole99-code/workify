import { StorageAdapter } from './StorageAdapter.js';

export class ServerAdapter extends StorageAdapter {
  async load() {
    const res = await fetch('/api/data', { method: 'GET' });
    if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
    return await res.json();
  }

  async save(data) {
    const res = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to save: ${res.status}`);
  }

  get name() { return 'data.json'; }
  get canChange() { return false; }
}
