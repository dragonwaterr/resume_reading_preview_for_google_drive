// 드라이브 DOM 선택자에 의존하는 코드는 전부 이 파일에만 둔다 (R-01, ADR-002).
// 조회가 실패하면 예외를 던지지 않고 null/false를 반환한다.
const driveDom = (() => {
  const FILE_URL_RE = /\/file\/(?:u\/\d+\/)?d\/([\w-]{10,})/; // 다중 계정: /file/u/1/d/{id}
  const MIN_PAGE_HEIGHT = 100; // 페이지 사이의 "댓글 추가" 버튼(42px) 같은 작은 자식 제외

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const isScrollable = (el) =>
    el.scrollHeight - el.clientHeight > 20 && /(auto|scroll)/.test(getComputedStyle(el).overflowY);

  const getPages = (viewer) =>
    [...viewer.docEl.children].filter((c) => c.getBoundingClientRect().height > MIN_PAGE_HEIGHT);

  // 보이는 [role="document"] 중 페이지 요소를 가진 것. 인접 파일 뷰어는 display:none으로 미리 로드되어 있어 제외된다.
  function getViewer() {
    try {
      for (const docEl of document.querySelectorAll('[role="document"]')) {
        if (!isVisible(docEl)) continue;
        if (!getPages({ docEl }).length) continue;
        let scroller = docEl;
        while (scroller && !isScrollable(scroller)) scroller = scroller.parentElement;
        if (scroller) return { docEl, scroller };
      }
    } catch (e) {
      log('getViewer 실패', e);
    }
    return null;
  }

  function isAlive(viewer) {
    return !!viewer && viewer.docEl.isConnected && isVisible(viewer.docEl);
  }

  // 새 탭: URL. 오버레이: 툴바 파일명과 aria-label이 일치하는 그리드 항목의 data-id (유일할 때만).
  function getFileId() {
    try {
      const fromUrl = location.pathname.match(FILE_URL_RE)?.[1];
      if (fromUrl) return fromUrl;
      const gridItems = [...document.querySelectorAll('[data-id]')]
        .filter((el) => el.closest('[role="grid"], [role="treegrid"]'));
      const names = [...document.querySelectorAll('[role="heading"]')]
        .filter((h) => isVisible(h) && !h.closest('[role="document"], [role="grid"], [role="treegrid"]'))
        .map((h) => norm(h.textContent))
        .filter(Boolean);
      for (const name of names) {
        const ids = new Set(gridItems
          .filter((g) => {
            const label = norm(g.getAttribute('aria-label'));
            return label === name || label.startsWith(name + ' ');
          })
          .map((g) => g.getAttribute('data-id')));
        if (ids.size === 1) return [...ids][0];
        if (ids.size > 1) return null; // 동명 파일: 오기록보다 미추적이 낫다
      }
    } catch (e) {
      log('getFileId 실패', e);
    }
    return null;
  }

  function getPageCount(viewer) {
    try {
      return getPages(viewer).length;
    } catch (e) {
      return 0;
    }
  }

  // 스크롤 영역 세로 1/3 지점을 덮는 페이지 = 현재 페이지 (1부터)
  function getCurrentPage(viewer) {
    try {
      const pages = getPages(viewer);
      if (!pages.length) return null;
      const r = viewer.scroller.getBoundingClientRect();
      const line = r.top + r.height / 3;
      const i = pages.findIndex((p) => p.getBoundingClientRect().bottom > line);
      return i < 0 ? pages.length : i + 1;
    } catch (e) {
      return null;
    }
  }

  function scrollToPage(viewer, page) {
    try {
      const target = getPages(viewer)[page - 1];
      if (!target) return false;
      viewer.scroller.scrollTop += target.getBoundingClientRect().top - viewer.scroller.getBoundingClientRect().top;
      return true;
    } catch (e) {
      return false;
    }
  }

  return { getViewer, isAlive, getFileId, getPageCount, getCurrentPage, scrollToPage };
})();
