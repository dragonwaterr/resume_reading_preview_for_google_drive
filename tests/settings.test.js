// settings.js를 가짜 chrome.storage.sync와 함께 vm에서 실행해 기본값·병합을 검증한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSettings(initial = {}, { failWrites = false } = {}) {
  const data = structuredClone(initial);
  const sync = {
    data,
    async get(key) {
      return key in data ? { [key]: structuredClone(data[key]) } : {};
    },
    async set(obj) {
      if (failWrites) throw new Error('MAX_WRITE_OPERATIONS_PER_MINUTE');
      Object.assign(data, structuredClone(obj));
    },
  };
  const ctx = vm.createContext({ chrome: { storage: { sync } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/shared/settings.js'), 'utf8'), ctx);
  return { settingsStore: vm.runInContext('settingsStore', ctx), sync };
}

test('저장된 설정이 없으면 토스트 기본값은 켜짐', async () => {
  const { settingsStore } = loadSettings();
  assert.deepEqual({ ...(await settingsStore.load()) }, { toast: true });
});

test('끄기 저장 후 다시 읽으면 꺼짐', async () => {
  const { settingsStore, sync } = loadSettings();
  assert.equal(await settingsStore.save({ toast: false }), true);
  assert.deepEqual(sync.data.settings, { toast: false });
  assert.equal((await settingsStore.load()).toast, false);
});

test('쓰기 실패 시 false를 반환한다', async () => {
  const { settingsStore } = loadSettings({}, { failWrites: true });
  assert.equal(await settingsStore.save({ toast: false }), false);
});
