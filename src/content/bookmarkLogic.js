// 책갈피 저장소의 순수 로직 (chrome API 없음). content script와 Node 단위 테스트에서 함께 쓴다.
const bookmarkLogic = (() => {
  const PREFIX = 'b:';

  const keyOf = (fileId) => PREFIX + fileId;
  const isBookmarkKey = (key) => key.startsWith(PREFIX);
  const isValid = (entry) => !!entry && Number.isInteger(entry.p) && entry.p >= 1 && Number.isFinite(entry.t);
  const openedAt = (entry) => entry?.o ?? entry?.t ?? 0;

  // ADR-003: local·sync 중 t(기록 시각)가 더 최신인 값. 같으면 a. 형식이 깨진 값은 무시한다.
  function pickLatest(a, b) {
    if (!isValid(a)) return isValid(b) ? b : null;
    if (!isValid(b)) return a;
    return b.t > a.t ? b : a;
  }

  // ADR-004: 책갈피 수가 limit을 넘으면 o(열람 시각)가 오래된 순으로 삭제할 키 목록.
  // 최소 batch개를 한 번에 지워 매번 정리하지 않도록 한다. keepKey(방금 연 PDF)와 책갈피가 아닌 키(settings)는 제외.
  function selectEvictions(items, { limit, batch, keepKey }) {
    const bookmarks = Object.entries(items).filter(([key]) => isBookmarkKey(key));
    if (bookmarks.length <= limit) return [];
    const count = Math.max(batch, bookmarks.length - limit);
    return bookmarks
      .filter(([key]) => key !== keepKey)
      .sort(([, a], [, b]) => openedAt(a) - openedAt(b))
      .slice(0, count)
      .map(([key]) => key);
  }

  return { keyOf, pickLatest, selectEvictions };
})();

if (typeof module !== 'undefined') module.exports = bookmarkLogic;
