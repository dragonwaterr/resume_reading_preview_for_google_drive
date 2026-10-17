// 루프 1: chrome.storage.local 단독 저장.
// 루프 2에서 local+sync 이중 저장, 최신값(t) 읽기, 열람 시각(o) 갱신으로 확장한다 (ADR-003, ADR-004).
const bookmarkStore = (() => {
  const keyOf = (fileId) => `b:${fileId}`;

  async function load(fileId) {
    try {
      const key = keyOf(fileId);
      const result = await chrome.storage.local.get(key);
      return result[key]?.p ?? null;
    } catch (e) {
      log('load 실패', e);
      return null;
    }
  }

  async function save(fileId, page) {
    try {
      await chrome.storage.local.set({ [keyOf(fileId)]: { p: page, t: Date.now() } });
      log('저장', fileId, page);
    } catch (e) {
      log('save 실패 (무시)', e);
    }
  }

  return { load, save };
})();
