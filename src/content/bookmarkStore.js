// 책갈피 저장소 (FR-5, ADR-003, ADR-004)
// - local과 sync 양쪽에 쓰고, 쓰기 실패는 무시한다 (R-07).
// - 읽기는 두 저장소 중 t가 더 최신인 값을 쓴다.
// - 기록이 있는 PDF를 열면 o만 갱신한다.
// - sync만 임계치 초과 시 o가 오래된 순으로 일괄 삭제한다. local은 삭제하지 않는다 (R-08).
const STORAGE_LIMITS = {
  syncBookmarkLimit: 500, // sync 512개 한도(settings 키 포함)에 여유를 둔 임계치. 테스트 시 3으로 바꿔 검증
  syncEvictBatch: 50,
};

const bookmarkStore = (() => {
  const { keyOf, pickLatest, selectEvictions } = bookmarkLogic;

  async function readArea(area, key) {
    try {
      return (await area.get(key))[key] ?? null;
    } catch (e) {
      log('읽기 실패 (무시)', e);
      return null;
    }
  }

  async function writeBoth(key, value) {
    await Promise.all([chrome.storage.local, chrome.storage.sync].map(async (area) => {
      try {
        await area.set({ [key]: value });
      } catch (e) {
        log('쓰기 실패 (무시)', e);
      }
    }));
  }

  async function pruneSync(keepKey) {
    try {
      const items = await chrome.storage.sync.get(null);
      const keys = selectEvictions(items, {
        limit: STORAGE_LIMITS.syncBookmarkLimit,
        batch: STORAGE_LIMITS.syncEvictBatch,
        keepKey,
      });
      if (keys.length) {
        await chrome.storage.sync.remove(keys);
        log('sync 정리', keys);
      }
    } catch (e) {
      log('sync 정리 실패 (무시)', e);
    }
  }

  // 미리보기 진입 시 호출. 기록이 있으면 o만 갱신하고 저장된 페이지를 반환한다.
  async function open(fileId) {
    const key = keyOf(fileId);
    const [local, sync] = await Promise.all([
      readArea(chrome.storage.local, key),
      readArea(chrome.storage.sync, key),
    ]);
    const latest = pickLatest(local, sync);
    if (!latest) return null;
    await writeBoth(key, { p: latest.p, t: latest.t, o: Date.now() });
    await pruneSync(key); // sync에서 정리됐던 항목이 다시 써질 수 있으므로
    return latest.p;
  }

  async function save(fileId, page) {
    const key = keyOf(fileId);
    const now = Date.now();
    await writeBoth(key, { p: page, t: now, o: now });
    log('저장', fileId, page);
    await pruneSync(key);
  }

  return { open, save };
})();
