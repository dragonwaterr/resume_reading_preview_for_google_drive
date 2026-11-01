const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeMessage, parseMessage, createHostIdStore, STALE_MS } = require('../src/content/frameLink.js');

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

test('makeMessage → parseMessage 왕복: fileId 그대로', () => {
  assert.equal(parseMessage(makeMessage(ID)), ID);
});

test('parseMessage: 파일을 못 찾은 호스트(null)는 null', () => {
  assert.equal(parseMessage(makeMessage(null)), null);
});

test('parseMessage: 우리 메시지가 아니면 undefined (무시)', () => {
  assert.equal(parseMessage(undefined), undefined);
  assert.equal(parseMessage('rr:fileId'), undefined);
  assert.equal(parseMessage({ type: 'other', fileId: ID }), undefined);
});

test('parseMessage: fileId 형식이 틀리면 undefined (문자열 주입 방지)', () => {
  assert.equal(parseMessage({ type: 'rr:fileId', fileId: 'short' }), undefined);
  assert.equal(parseMessage({ type: 'rr:fileId', fileId: '../../etc/passwd/xxxx' }), undefined);
  assert.equal(parseMessage({ type: 'rr:fileId', fileId: 12345678901234 }), undefined);
});

test('createHostIdStore: 받은 id를 유효 시간 안에는 돌려준다', () => {
  let now = 1000;
  const store = createHostIdStore(() => now);
  assert.equal(store.get(), null);
  store.set(ID);
  now += STALE_MS;
  assert.equal(store.get(), ID);
});

test('createHostIdStore: 하트비트가 끊기면(미리보기 닫힘) null', () => {
  let now = 1000;
  const store = createHostIdStore(() => now);
  store.set(ID);
  now += STALE_MS + 1;
  assert.equal(store.get(), null);
});

test('createHostIdStore: 하트비트로 갱신하면 계속 유효, null을 받으면 즉시 null', () => {
  let now = 1000;
  const store = createHostIdStore(() => now);
  store.set(ID);
  now += STALE_MS;
  store.set(ID);
  now += STALE_MS;
  assert.equal(store.get(), ID);
  store.set(null);
  assert.equal(store.get(), null);
});

const { makeNamesMessage, parseNamesMessage, createNamesStore } = require('../src/content/frameLink.js');

test('names 메시지 왕복: 문자열 배열 그대로', () => {
  assert.deepEqual(parseNamesMessage(makeNamesMessage(['a.pdf', 'b'])), ['a.pdf', 'b']);
});

test('parseNamesMessage: 우리 메시지가 아니면 undefined', () => {
  assert.equal(parseNamesMessage(undefined), undefined);
  assert.equal(parseNamesMessage({ type: 'rr:fileId', fileId: ID }), undefined);
  assert.equal(parseNamesMessage({ type: 'rr:names', names: 'x' }), undefined);
});

test('parseNamesMessage: 문자열이 아닌 값·너무 긴 값·과다 개수는 걸러낸다', () => {
  const long = 'x'.repeat(300);
  const many = Array.from({ length: 500 }, (_, i) => 'n' + i);
  assert.deepEqual(parseNamesMessage({ type: 'rr:names', names: ['ok', 1, null, long, {}] }), ['ok']);
  assert.equal(parseNamesMessage({ type: 'rr:names', names: many }).length, 200);
});

test('createNamesStore: 유효 시간 안에는 돌려주고, 끊기면 빈 배열', () => {
  let now = 1000;
  const store = createNamesStore(() => now);
  assert.deepEqual(store.get(), []);
  store.set(['a.pdf']);
  now += STALE_MS;
  assert.deepEqual(store.get(), ['a.pdf']);
  now += 1;
  assert.deepEqual(store.get(), []);
});
