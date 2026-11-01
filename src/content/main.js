// 미리보기 진입 감지 → 조회 → (기록 있으면) 이동 → 기록 시작 (FR-2~4, ADR-001)
// 프레임 역할 (ADR-007): 오버레이 미리보기는 /viewer/ iframe 안에 그려진다.
//  - iframe(inFrame): 뷰어를 직접 조작하되 fileId는 최상위 프레임이 보내준 값을 쓴다.
//  - 최상위 프레임: 뷰어가 직접 있으면(새 탭) 예전처럼 처리하고, 없고 미리보기 iframe만 있으면 fileId를 iframe에 보낸다.
const POLL_MS = 500;
const JUMP_TIMEOUT_MS = 5000;
const JUMP_RETRY_MS = 300;

let session = null;   // { fileId, viewer, token, teardown }
let candidate = null; // 직전 폴링에서 본 { fileId, scroller } — 2회 연속 같을 때만 진입

const inFrame = window !== window.top;
const hostFileId = frameLink.createHostIdStore();
const frameNames = frameLink.createNamesStore();
log('로드', inFrame ? 'iframe' : 'top', location.pathname);

// 진단용: 상태가 바뀔 때만 한 줄 남긴다 (폴링마다 찍지 않음)
const lastLogged = {};
function logChange(tag, state) {
  const key = JSON.stringify(state);
  if (lastLogged[tag] === key) return;
  lastLogged[tag] = key;
  log(tag, key);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isCurrent = (token) => session?.token === token;

// 목표 페이지가 준비될 때까지 재시도하고, 타임아웃 시 조용히 포기한다 (ADR-001 규칙 4, R-03)
// 반환: 'moved'(직접 이동함) | 'already'(드라이브가 이미 그 페이지를 표시 중) | 'failed'
async function jumpTo(viewer, page, token) {
  const deadline = Date.now() + JUMP_TIMEOUT_MS;
  let scrolled = false;
  while (Date.now() < deadline && isCurrent(token) && driveDom.isAlive(viewer)) {
    if (driveDom.getCurrentPage(viewer) === page) return scrolled ? 'moved' : 'already';
    driveDom.scrollToPage(viewer, page);
    scrolled = true;
    await sleep(JUMP_RETRY_MS);
  }
  return 'failed';
}

// 이동 성공 시에만, 설정에서 끄지 않았을 때 토스트를 띄운다 (FR-6)
async function notifyMoved(page) {
  if (!(await settingsStore.load()).toast) return;
  toast.show(chrome.i18n.getMessage('toastMoved', [String(page)]));
}

async function onViewerOpen(fileId, viewer, token) {
  const saved = await bookmarkStore.open(fileId);
  if (!isCurrent(token)) return;
  if (saved) {
    const result = await jumpTo(viewer, saved, token);
    log('이동 결과', result, fileId, saved);
    if (result === 'moved' && isCurrent(token)) notifyMoved(saved).catch((e) => log('토스트 실패', e));
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
  toast.hide(); // 이전 파일의 토스트가 다음 파일을 가리지 않도록
}

// 확장이 재로드·업데이트되면 이 탭의 스크립트는 확장과 연결이 끊겨 chrome API가 모두 실패한다.
// 끊긴 뒤에는 폴링을 멈춰 아무것도 하지 않는다 (새 버전은 탭을 새로고침하면 다시 주입된다).
const isContextAlive = () => !!chrome.runtime?.id;

if (inFrame) {
  window.addEventListener('message', (e) => {
    if (e.source !== window.parent || e.origin !== location.origin) return;
    const fileId = frameLink.parseMessage(e.data);
    if (fileId === undefined) return;
    logChange('host-msg', { fileId });
    hostFileId.set(fileId);
  });
}

// 최상위 프레임: iframe이 보낸 화면 텍스트 후보를 받는다 (파일명 툴바는 iframe 문서 안에 있다)
if (!inFrame) {
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== driveDom.getViewerFrame()?.contentWindow) return;
    const names = frameLink.parseNamesMessage(e.data);
    if (names !== undefined) frameNames.set(names);
  });
}

// 최상위 프레임: 미리보기 iframe이 떠 있으면 현재 파일의 fileId를 하트비트로 보낸다
function relayFileIdToViewerFrame() {
  const frame = driveDom.getViewerFrame();
  logChange('relay', { frame: !!frame });
  if (!frame) {
    frameNames.set([]); // 닫힌 미리보기의 이름이 다음 파일에 쓰이지 않도록 즉시 비운다
    return;
  }
  const fileId = driveDom.getFileId(true, frameNames.get());
  logChange('relay-fileId', { fileId, diag: driveDom.getDiag() });
  frame.contentWindow?.postMessage(frameLink.makeMessage(fileId), location.origin);
}

function poll() {
  if (!isContextAlive()) {
    clearInterval(pollTimer);
    session?.teardown?.();
    session = null;
    log('확장 연결이 끊겨 중지합니다 (탭 새로고침 필요)');
    return;
  }
  const viewer = driveDom.getViewer();
  if (!viewer && !inFrame) relayFileIdToViewerFrame();
  const fileId = !viewer ? null : inFrame ? hostFileId.get() : driveDom.getFileId();
  logChange('poll', { inFrame, viewer: !!viewer, fileId });
  if (inFrame && !viewer) hostFileId.set(null); // 닫힌 미리보기의 fileId가 다음 파일에 쓰이지 않도록 즉시 비운다
  if (inFrame && viewer) {
    const names = driveDom.getFrameTexts();
    logChange('frame-names', { count: names.length, sample: names.slice(0, 8) });
    window.parent.postMessage(frameLink.makeNamesMessage(names), location.origin);
  }

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

const pollTimer = setInterval(poll, POLL_MS);
