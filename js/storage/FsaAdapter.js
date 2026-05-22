import { StorageAdapter } from './StorageAdapter.js';

export class FsaAdapter extends StorageAdapter {
  constructor(handle) {
    super();
    this.handle = handle;
  }

  async load() {
    const file = await this.handle.getFile();
    const text = await file.text();
    if (!text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`Failed to parse ${this.handle.name} as JSON: ${err.message}`);
    }
  }

  async save(data) {
    const writable = await this.handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  }

  get name() { return this.handle.name; }
  get canChange() { return true; }
}
