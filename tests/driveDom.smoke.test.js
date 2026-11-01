const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 빈 문서에서 공개 함수를 모두 호출해, 정의 누락(ReferenceError 등)이 try/catch에 삼켜지지 않는지 확인한다.
// driveDom은 예외를 log()로만 남기므로, log가 호출되면 실패로 본다.
function load(pathname = '/drive/folders/abc') {
  const errors = [];
  const empty = { querySelectorAll: () => [] };
  const sandbox = {
    log: (...args) => errors.push(args),
    location: { origin: 'https://drive.google.com', pathname },
    document: empty,
    getComputedStyle: () => ({ overflowY: 'visible' }),
    module: undefined,
  };
  vm.createContext(sandbox);
  for (const f of ['nameMatch.js', 'driveDom.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/content', f), 'utf8'), sandbox, { filename: f });
  }
  return { driveDom: vm.runInContext('driveDom', sandbox), errors };
}

test('driveDom: 빈 문서에서 공개 함수가 예외·내부 오류 없이 빈 결과를 돌려준다', () => {
  const { driveDom, errors } = load();
  assert.equal(driveDom.getViewer(), null);
  assert.equal(driveDom.getViewerFrame(), null);
  assert.equal(driveDom.getFileId(), null);
  assert.equal(driveDom.getFileId(true, ['COD.pdf']), null);
  assert.equal(driveDom.getFrameTexts().length, 0);
  assert.equal(errors.length, 0, JSON.stringify(errors.map(String)));
});

test('driveDom: 새 탭 URL이면 URL에서 fileId를 읽는다', () => {
  const { driveDom } = load('/file/d/1-yYY3QphqCMO3TrO6X20rPemBWnzCUvR/view');
  assert.equal(driveDom.getFileId(), '1-yYY3QphqCMO3TrO6X20rPemBWnzCUvR');
});
