// 미리보기 진입 감지 → 조회 → (기록 있으면) 이동 → 기록 시작 (FR-2~4, ADR-001)
const POLL_MS = 500;
const JUMP_TIMEOUT_MS = 5000;
const JUMP_RETRY_MS = 300;

let session = null;   // { fileId, viewer, token, teardown }
let candidate = null; // 직전 폴링에서 본 { fileId, scroller } — 2회 연속 같을 때만 진입

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isCurrent = (token) => session?.token === token;

// 목표 페이지가 준비될 때까지 재시도하고, 타임아웃 시 조용히 포기한다 (ADR-001 규칙 4, R-03)
async function jumpTo(viewer, page, token) {
  const deadline = Date.now() + JUMP_TIMEOUT_MS;
  while (Date.now() < deadline && isCurrent(token) && driveDom.isAlive(viewer)) {
    if (driveDom.getCurrentPage(viewer) === page) return true;
    driveDom.scrollToPage(viewer, page);
    await sleep(JUMP_RETRY_MS);
  }
  return false;
}

async function onViewerOpen(fileId, viewer, token) {
  const saved = await bookmarkStore.open(fileId);
  if (!isCurrent(token)) return;
  if (saved) {
    const ok = await jumpTo(viewer, saved, token);
    log(ok ? '이동 성공' : '이동 포기', fileId, saved);
  }
  if (!isCurrent(token)) return;
  session.teardown = startTracking(fileId, viewer);
}

function beginSession(fileId, viewer) {
  const token = Symbol(fileId);
  session = { fileId, viewer, token, teardown: null };
  log('미리보기 진입', fileId);
  onViewerOpen(fileId, viewer, token).catch((e) => log('진입 처리 실패', e));
}

// 미리보기 닫힘 / fileId 변경 시 이전 추적기를 정리한다 (ADR-001 규칙 5, R-05)
function endSession() {
  session.teardown?.();
  session = null;
}

function poll() {
  const viewer = driveDom.getViewer();
  const fileId = viewer ? driveDom.getFileId() : null;

  if (session && (session.fileId !== fileId || session.viewer.scroller !== viewer?.scroller)) {
    endSession();
  }
  if (session || !fileId) {
    candidate = null;
    return;
  }
  if (candidate?.fileId === fileId && candidate.scroller === viewer.scroller) {
    candidate = null;
    beginSession(fileId, viewer);
  } else {
    candidate = { fileId, scroller: viewer.scroller };
  }
}

setInterval(poll, POLL_MS);
