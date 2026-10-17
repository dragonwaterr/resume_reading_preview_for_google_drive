// 사용자 설정 (FR-6). sync 전용 "settings" 키에 저장하며 sync 512개 한도에 포함된다.
// content script와 옵션 페이지가 함께 쓴다.
const settingsStore = (() => {
  const KEY = 'settings';
  const DEFAULTS = { toast: true };

  async function load() {
    try {
      const result = await chrome.storage.sync.get(KEY);
      return { ...DEFAULTS, ...(result[KEY] || {}) };
    } catch (e) {
      return { ...DEFAULTS };
    }
  }

  // 저장 성공 여부를 반환한다 (옵션 페이지 상태 표시용)
  async function save(patch) {
    try {
      await chrome.storage.sync.set({ [KEY]: { ...(await load()), ...patch } });
      return true;
    } catch (e) {
      return false;
    }
  }

  return { load, save };
})();
