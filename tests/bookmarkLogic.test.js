const { test } = require('node:test');
const assert = require('node:assert/strict');
const { keyOf, pickLatest, selectEvictions } = require('../src/content/bookmarkLogic.js');

test('pickLatest: 둘 다 없으면 null', () => {
  assert.equal(pickLatest(null, null), null);
});

test('pickLatest: 한쪽만 있으면 그 값', () => {
  const e = { p: 3, t: 10, o: 10 };
  assert.equal(pickLatest(e, null), e);
  assert.equal(pickLatest(null, e), e);
});

test('pickLatest: t가 더 최신인 값을 쓴다 (sync 우선 아님)', () => {
  const local = { p: 7, t: 200, o: 200 };
  const sync = { p: 3, t: 100, o: 300 };
  assert.equal(pickLatest(local, sync), local);
  assert.equal(pickLatest(sync, local), local);
});

test('pickLatest: t가 같으면 첫 번째(local)', () => {
  const a = { p: 1, t: 100 };
  const b = { p: 2, t: 100 };
  assert.equal(pickLatest(a, b), a);
});

test('pickLatest: 형식이 깨진 값은 무시한다', () => {
  const ok = { p: 2, t: 100 };
  assert.equal(pickLatest({ p: 'x', t: 999 }, ok), ok);
  assert.equal(pickLatest(ok, { p: 0, t: 999 }), ok);
  assert.equal(pickLatest({ t: 1 }, { p: 5 }), null);
});

const items = (entries) => Object.fromEntries(entries.map(([id, o]) => [keyOf(id), { p: 1, t: o, o }]));

test('selectEvictions: 한도 이하이면 삭제하지 않는다', () => {
  assert.deepEqual(selectEvictions(items([['a', 1], ['b', 2], ['c', 3]]), { limit: 3, batch: 1 }), []);
});

test('selectEvictions: 한도 초과 시 o가 가장 오래된 항목부터 삭제', () => {
  const all = items([['a', 30], ['b', 10], ['c', 20], ['d', 40]]);
  assert.deepEqual(selectEvictions(all, { limit: 3, batch: 1 }), [keyOf('b')]);
});

test('selectEvictions: batch만큼 일괄 삭제', () => {
  const all = items([['a', 1], ['b', 2], ['c', 3], ['d', 4], ['e', 5]]);
  assert.deepEqual(selectEvictions(all, { limit: 4, batch: 3 }), [keyOf('a'), keyOf('b'), keyOf('c')]);
});

test('selectEvictions: 초과분이 batch보다 크면 초과분만큼 삭제', () => {
  const all = items([['a', 1], ['b', 2], ['c', 3], ['d', 4], ['e', 5]]);
  assert.deepEqual(selectEvictions(all, { limit: 2, batch: 1 }), [keyOf('a'), keyOf('b'), keyOf('c')]);
});

test('selectEvictions: keepKey(방금 연 PDF)는 삭제하지 않는다', () => {
  const all = items([['a', 1], ['b', 2], ['c', 3], ['d', 4]]);
  assert.deepEqual(selectEvictions(all, { limit: 3, batch: 1, keepKey: keyOf('a') }), [keyOf('b')]);
});

test('selectEvictions: settings 키는 개수와 삭제 대상에서 제외', () => {
  const all = { ...items([['a', 1], ['b', 2], ['c', 3]]), settings: { toast: true } };
  assert.deepEqual(selectEvictions(all, { limit: 3, batch: 1 }), []);
  const over = { ...items([['a', 1], ['b', 2], ['c', 3], ['d', 4]]), settings: { toast: true } };
  assert.deepEqual(selectEvictions(over, { limit: 3, batch: 5 }), [keyOf('a'), keyOf('b'), keyOf('c'), keyOf('d')]);
});

test('selectEvictions: o가 없으면 t로 정렬', () => {
  const all = {
    [keyOf('a')]: { p: 1, t: 50 },
    [keyOf('b')]: { p: 1, t: 10 },
    [keyOf('c')]: { p: 1, t: 30, o: 60 },
    [keyOf('d')]: { p: 1, t: 40, o: 70 },
  };
  assert.deepEqual(selectEvictions(all, { limit: 3, batch: 1 }), [keyOf('b')]);
});
