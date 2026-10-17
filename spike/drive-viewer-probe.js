/*
 * 드라이브 PDF 뷰어 조사 스니펫 v6 — 루프 0 스파이크 마무리 (ADR-002, R-01)
 * 확장 코드가 아니다. 배포 zip에 포함하지 않는다.
 * 루프 1의 driveDom 모듈 초안과 같은 API로 작성해, 오버레이·새 탭 양쪽에서 검증한다.
 *
 * fileId 출처 (v5 결과):
 *   - 새 탭(/file/d/{id}/view): URL
 *   - 오버레이: 툴바 [role="heading"] 파일명 → 그리드 항목 [data-id] 매칭 (유일할 때만)
 *
 * 사용법: PDF 미리보기를 연 상태로 DevTools 콘솔에 파일 전체를 붙여넣는다.
 *   __probe.state()    { fileId, fileIdSource, page, pageCount, scroller }
 *   __probe.watch()    상태가 바뀔 때마다 로그 (__probe.unwatch()로 중지)
 *   __probe.jump(n)    n페이지로 이동 후 결과 로그
 */
(() => {
  const FILE_URL_RE = /\/file\/d\/([\w-]{10,})/;
  const MIN_PAGE_HEIGHT = 100;

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const isScrollable = (el) => el.scrollHeight - el.clientHeight > 20 && /(auto|scroll)/.test(getComputedStyle(el).overflowY);

  // 보이는 [role="document"] 중 페이지 요소를 가진 것 (오버레이는 dialog 안, 새 탭은 dialog 없이)
  function getViewer() {
    for (const docEl of document.querySelectorAll('[role="document"]')) {
      if (!isVisible(docEl)) continue;
      const pages = [...docEl.children].filter((c) => c.getBoundingClientRect().height > MIN_PAGE_HEIGHT);
      if (!pages.length) continue;
      let scroller = docEl;
      while (scroller && !isScrollable(scroller)) scroller = scroller.parentElement;
      if (scroller) return { docEl, pages, scroller };
    }
    return null;
  }

  function getFileId() {
    const fromUrl = location.pathname.match(FILE_URL_RE)?.[1];
    if (fromUrl) return { id: fromUrl, source: 'url' };
    const gridItems = [...document.querySelectorAll('[data-id]')].filter((el) => el.closest('[role="grid"], [role="treegrid"]'));
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
      if (ids.size === 1) return { id: [...ids][0], source: `name:${name}` };
      if (ids.size > 1) return { id: null, source: `ambiguous:${name}` };
    }
    return { id: null, source: names.length ? `no-grid-match:${names.join('|').slice(0, 60)}` : 'no-heading' };
  }

  // 스크롤 영역 세로 1/3 지점을 덮는 페이지 = 현재 페이지
  function getCurrentPage(v = getViewer()) {
    if (!v) return null;
    const r = v.scroller.getBoundingClientRect();
    const line = r.top + r.height / 3;
    const i = v.pages.findIndex((p) => p.getBoundingClientRect().bottom > line);
    return i < 0 ? v.pages.length : i + 1;
  }

  function jumpTo(n, v = getViewer()) {
    const page = v?.pages[n - 1];
    if (!page) return false;
    v.scroller.scrollTop += page.getBoundingClientRect().top - v.scroller.getBoundingClientRect().top;
    return true;
  }

  function state() {
    const v = getViewer();
    const f = getFileId();
    return {
      fileId: f.id,
      fileIdSource: f.source,
      page: getCurrentPage(v),
      pageCount: v ? v.pages.length : null,
      scroller: v ? `${v.scroller.tagName.toLowerCase()}.${[...v.scroller.classList].slice(0, 2).join('.')}` : null,
      inDialog: v ? !!v.docEl.closest('[role="dialog"]') : null,
    };
  }

  const timers = { stop: null };

  function watch() {
    unwatch();
    let last = '';
    const log = () => {
      const key = JSON.stringify(state());
      if (key !== last) { last = key; console.log(`[probe ${new Date().toISOString().slice(17, 23)}]`, key); }
    };
    const iv = setInterval(log, 300); // 파일 전환 중 과도 상태도 보이도록 짧게
    timers.stop = () => clearInterval(iv);
    console.log('[probe] watch 시작. 스크롤·파일 전환·미리보기 닫기를 해 보세요. 중지: __probe.unwatch()');
    log();
  }

  function unwatch() {
    timers.stop?.();
    timers.stop = null;
  }

  function jump(n) {
    console.log('[probe] 이동 전', JSON.stringify(state()), '| jumpTo 결과:', jumpTo(n));
    setTimeout(() => console.log('[probe] 이동 1초 후', JSON.stringify(state())), 1000);
  }

  window.__probe = { state, watch, unwatch, jump };
  console.log('%c[probe v6] 준비 완료: state() / watch() / jump(n)', 'color:green;font-weight:bold');
})();
