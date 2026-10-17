// 실제 content script 파일을 가짜 chrome.storage와 함께 vm에서 실행해 저장소 동작을 검증한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '../src/content');

function createArea({ failWrites = false } = {}) {
  const data = {};
  return {
    data,
    failWrites,
    async get(keys) {
      if (keys == null) return structuredClone(data);
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((k) => k in data).map((k) => [k, structuredClone(data[k])]));
    },
    async set(obj) {
      if (this.failWrites) throw new Error('QUOTA_BYTES quota exceeded');
      Object.assign(data, structuredClone(obj));
    },
    async remove(keys) {
      for (const k of [].concat(keys)) delete data[k];
    },
  };
}

function loadStore({ syncFailWrites = false } = {}) {
  const clock = { now: 1000 };
  const local = createArea();
  const sync = createArea({ failWrites: syncFailWrites });
  const ctx = vm.createContext({
    chrome: { storage: { local, sync } },
    console: { debug() {} },
    Date: { now: () => clock.now },
  });
  for (const file of ['log.js', 'bookmarkLogic.js', 'bookmarkStore.js']) {
    vm.runInContext(fs.readFileSync(path.join(SRC, file), 'utf8'), ctx, { filename: file });
  }
  return {
    store: vm.runInContext('bookmarkStore', ctx),
    limits: vm.runInContext('STORAGE_LIMITS', ctx),
    local,
    sync,
    clock,
  };
}

test('save: local과 sync 양쪽에 { p, t, o }로 쓴다', async () => {
  const { store, local, sync } = loadStore();
  await store.save('A', 47);
  assert.deepEqual(local.data['b:A'], { p: 47, t: 1000, o: 1000 });
  assert.deepEqual(sync.data['b:A'], { p: 47, t: 1000, o: 1000 });
});

test('open: 기록이 없으면 null을 반환하고 아무것도 쓰지 않는다', async () => {
  const { store, local, sync } = loadStore();
  assert.equal(await store.open('A'), null);
  assert.deepEqual(local.data, {});
  assert.deepEqual(sync.data, {});
});

test('open: t가 더 최신인 값을 쓰고, 양쪽에 o만 갱신한다', async () => {
  const { store, local, sync, clock } = loadStore();
  local.data['b:A'] = { p: 7, t: 200, o: 200 };
  sync.data['b:A'] = { p: 3, t: 100, o: 100 };
  clock.now = 5000;
  assert.equal(await store.open('A'), 7);
  assert.deepEqual(local.data['b:A'], { p: 7, t: 200, o: 5000 });
  assert.deepEqual(sync.data['b:A'], { p: 7, t: 200, o: 5000 });
});

test('sync 쓰기가 실패해도 local에 저장되고 다음 열람에 쓰인다', async () => {
  const { store, local, sync } = loadStore({ syncFailWrites: true });
  await store.save('A', 12);
  assert.deepEqual(local.data['b:A'], { p: 12, t: 1000, o: 1000 });
  assert.equal(sync.data['b:A'], undefined);
  assert.equal(await store.open('A'), 12);
});

test('한도 3: 4번째 PDF 저장 시 o가 가장 오래된 항목이 sync에서만 삭제된다', async () => {
  const { store, limits, local, sync, clock } = loadStore();
  limits.syncBookmarkLimit = 3;
  limits.syncEvictBatch = 1;
  sync.data.settings = { toast: true };

  for (const [id, at] of [['A', 100], ['B', 200], ['C', 300]]) {
    clock.now = at;
    await store.save(id, 1);
  }
  clock.now = 400;
  await store.open('A'); // A를 다시 열어 o 갱신 → 가장 오래된 열람은 B
  clock.now = 500;
  await store.save('D', 1);

  assert.deepEqual(Object.keys(sync.data).sort(), ['b:A', 'b:C', 'b:D', 'settings']);
  assert.deepEqual(Object.keys(local.data).sort(), ['b:A', 'b:B', 'b:C', 'b:D']);
});

test('sync에서 정리된 PDF를 다시 열면 local 값으로 이동하고 sync 한도는 유지된다', async () => {
  const { store, limits, local, sync, clock } = loadStore();
  limits.syncBookmarkLimit = 3;
  limits.syncEvictBatch = 1;
  for (const [id, at] of [['A', 100], ['B', 200], ['C', 300], ['D', 400]]) {
    clock.now = at;
    await store.save(id, at / 100);
  }
  assert.equal(sync.data['b:A'], undefined);

  clock.now = 500;
  assert.equal(await store.open('A'), 1);
  assert.deepEqual(Object.keys(sync.data).sort(), ['b:A', 'b:C', 'b:D']);
  assert.equal(Object.keys(local.data).length, 4);
});
