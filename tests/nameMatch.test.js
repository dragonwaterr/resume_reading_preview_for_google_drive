const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pickFileId } = require('../src/content/nameMatch.js');

const item = (id, label, ...texts) => ({ id, label, texts: new Set(texts) });
const NAME = 'COD Chapter 2 rev ISA for MIPS.pdf';
const grid = [
  item('idA', `${NAME} PDF 추가 정보(Option + →)`, NAME, 'PDF', '나'),
  item('idB', 'COD Chapter 4 rev Processor Architecture.pdf PDF 추가 정보', 'COD Chapter 4 rev Processor Architecture.pdf', 'PDF', '나'),
];

test('파일명이 정확히 한 항목에 걸리면 그 id', () => {
  assert.equal(pickFileId(grid, [NAME]).id, 'idA');
});

test('여러 항목에 걸리는 일반 텍스트("나", "PDF")는 증거에서 제외하고 파일명만 쓴다', () => {
  assert.equal(pickFileId(grid, ['닫기', '나', 'PDF', NAME, '도움말']).id, 'idA');
});

test('aria-label 접두(파일명 + 공백)로도 매칭한다 (바둑판 보기)', () => {
  const tiles = [item('idA', `${NAME} PDF 추가 정보`), item('idB', 'other.pdf PDF 추가 정보')];
  assert.equal(pickFileId(tiles, [NAME]).id, 'idA');
});

test('같은 이름의 파일이 2개면 추적하지 않는다 (null)', () => {
  const dup = [...grid, item('idC', `${NAME} PDF 추가 정보`, NAME)];
  assert.equal(pickFileId(dup, [NAME]).id, null);
});

test('서로 다른 파일을 가리키는 증거가 둘이면 null', () => {
  assert.equal(pickFileId(grid, [NAME, 'COD Chapter 4 rev Processor Architecture.pdf']).id, null);
});

test('증거가 없으면 null이고 통계를 돌려준다', () => {
  const r = pickFileId(grid, ['닫기', '나']);
  assert.equal(r.id, null);
  assert.deepEqual(r.stats, { names: 2, grid: 2, single: 0, ambiguous: 1 });
});
