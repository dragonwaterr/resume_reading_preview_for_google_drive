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

  // 그리드 항목의 이름 단서: 바둑판 보기는 aria-label = "파일명 PDF 추가 정보…", 목록 보기는 파일명만 담긴 하위 칸.
  const indexItem = (item) => {
    const texts = new Set([norm(item.textContent)]);
    for (const el of item.querySelectorAll('*')) {
      if (el.childElementCount === 0) texts.add(norm(el.textContent));
    }
    return { id: item.getAttribute('data-id'), label: norm(item.getAttribute('aria-label')), texts };
  };

  const GRID_SEL = '[role="grid"], [role="treegrid"]';
  const NAME_EXCLUDE_SEL = '[role="document"], [role="grid"], [role="treegrid"], [role="tree"], [role="navigation"]';
  const MAX_NAME_LEN = 255;

  // 오버레이 미리보기는 최상위 프레임 위에 뜨는 /viewer/ iframe이다 (ADR-007). 보이는 것만 대상으로 한다.
  function getViewerFrame() {
    try {
      return [...document.querySelectorAll('iframe')]
        .find((f) => f.src.startsWith(location.origin + '/viewer/') && isVisible(f)) || null;
    } catch (e) {
      log('getViewerFrame 실패', e);
    }
    return null;
  }

  // 화면의 말단 텍스트 → 그 텍스트를 가진 요소들. 툴바 파일명은 role 없는 요소라서 위치로 특정할 수 없어
  // 문서 전체를 훑고, 그리드 항목에 정확히 1개 걸리는 텍스트만 getFileId에서 증거로 쓴다 (가시성 검사는 그 뒤에).
  function collectLeafTexts() {
    const byText = new Map();
    for (const el of document.querySelectorAll('*')) {
      if (el.childElementCount !== 0) continue;
      const text = norm(el.textContent);
      if (!text || text.length > MAX_NAME_LEN) continue;
      (byText.get(text) || byText.set(text, []).get(text)).push(el);
    }
    return byText;
  }

  // iframe 안(뷰어 문서)에서: 보이는 말단 텍스트 후보를 최상위 프레임으로 보내기 위해 모은다. 페이지 본문(role=document)은 제외.
  function getFrameTexts() {
    try {
      const texts = new Set();
      for (const el of document.querySelectorAll('*')) {
        if (el.childElementCount !== 0 || el.closest('[role="document"]')) continue;
        const text = norm(el.textContent);
        if (text && text.length <= MAX_NAME_LEN && isVisible(el)) texts.add(text);
        if (texts.size >= 100) break;
      }
      return [...texts];
    } catch (e) {
      return [];
    }
  }

  const isNameEl = (el) => isVisible(el) && !el.closest(NAME_EXCLUDE_SEL);

  // 진단용: 마지막 getFileId 실패 시점의 상태
  let lastDiag = null;
  const getDiag = () => lastDiag;

  // 새 탭: URL. 오버레이: 파일명 후보와 일치하는 그리드 항목의 data-id (유일할 때만, 판정은 nameMatch).
  // useOverlayText: iframe 오버레이는 파일명이 heading이 아니라서 문서 전체의 텍스트에서도 찾는다.
  // frameTexts: iframe(뷰어 툴바)이 알려준 텍스트. 이미 뷰어 쪽 증거이므로 가시성·위치 검사를 하지 않는다.
  function getFileId(useOverlayText = false, frameTexts = []) {
    try {
      const fromUrl = location.pathname.match(FILE_URL_RE)?.[1];
      if (fromUrl) return fromUrl;

      const gridIndex = [...document.querySelectorAll('[data-id]')]
        .filter((el) => el.closest(GRID_SEL))
        .map(indexItem);
      const byText = useOverlayText ? collectLeafTexts() : new Map();
      for (const h of document.querySelectorAll('[role="heading"]')) {
        const text = norm(h.textContent);
        if (text) (byText.get(text) || byText.set(text, []).get(text)).push(h);
      }
      const names = new Set(frameTexts);
      for (const [text, els] of byText) {
        if (els.some(isNameEl)) names.add(text);
      }

      const { id, stats } = nameMatch.pickFileId(gridIndex, [...names]);
      lastDiag = id ? null : stats;
      return id;
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

  return { getViewer, isAlive, getViewerFrame, getFileId, getFrameTexts, getDiag, getPageCount, getCurrentPage, scrollToPage };
})();
