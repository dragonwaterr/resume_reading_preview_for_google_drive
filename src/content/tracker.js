// 페이지 기록 (FR-1, ADR-001 규칙 3·6)
// - 시작 시점 페이지는 기준값으로만 쓰고, 값이 바뀔 때만 debounce 저장한다.
// - 저장할 fileId는 시작 시 캡처한 값을 쓴다.
// - 반환된 teardown은 대기 중인 저장을 flush한다 (R-06).
const SAVE_DEBOUNCE_MS = 1000;

function startTracking(fileId, viewer) {
  let lastPage = driveDom.getCurrentPage(viewer);
  let pendingPage = null;
  let timer = null;

  const flush = () => {
    clearTimeout(timer);
    timer = null;
    if (pendingPage != null) {
      bookmarkStore.save(fileId, pendingPage);
      pendingPage = null;
    }
  };

  const onScroll = () => {
    const page = driveDom.getCurrentPage(viewer);
    if (page == null || page === lastPage) return;
    lastPage = page;
    pendingPage = page;
    clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
  };

  viewer.scroller.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pagehide', flush);
  log('추적 시작', fileId, '기준 페이지', lastPage);

  return function teardown() {
    viewer.scroller.removeEventListener('scroll', onScroll);
    window.removeEventListener('pagehide', flush);
    flush();
    log('추적 종료', fileId);
  };
}
