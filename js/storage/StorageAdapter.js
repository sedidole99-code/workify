export class StorageAdapter {
  async load() { throw new Error('not implemented'); }
  async save(_data) { throw new Error('not implemented'); }
  get name() { return ''; }
  get canChange() { return true; }
}
