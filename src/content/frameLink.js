// 최상위 프레임 ↔ 미리보기 iframe 사이의 fileId 전달 규약 (ADR-007). DOM·chrome API 없음.
// 오버레이 미리보기는 drive.google.com/viewer/ iframe 안에 그려지고, fileId를 알 수 있는 그리드는 최상위 프레임에 있다.
// 최상위 프레임이 폴링마다 fileId를 보내고(하트비트), iframe은 일정 시간 안에 받은 값만 유효로 본다.
const frameLink = (() => {
  const MSG_TYPE = 'rr:fileId';
  const NAMES_TYPE = 'rr:names';
  const MAX_NAMES = 200;
  const MAX_NAME_LEN = 255;
  const STALE_MS = 2000; // 하트비트(폴링 500ms)가 이 시간 이상 끊기면 미리보기가 닫힌 것으로 본다
  const FILE_ID_RE = /^[\w-]{10,}$/;

  const makeMessage = (fileId) => ({ type: MSG_TYPE, fileId });

  // 우리 메시지가 아니거나 형식이 틀리면 undefined, 파일을 못 찾은 호스트는 null, 아니면 fileId
  function parseMessage(data) {
    if (!data || typeof data !== 'object' || data.type !== MSG_TYPE) return undefined;
    if (data.fileId === null) return null;
    return typeof data.fileId === 'string' && FILE_ID_RE.test(data.fileId) ? data.fileId : undefined;
  }

  // iframe → 최상위: 뷰어 화면의 텍스트 후보. 파일명 툴바가 iframe 문서 안에 있어 최상위에서는 보이지 않는다.
  const makeNamesMessage = (names) => ({ type: NAMES_TYPE, names });

  function parseNamesMessage(data) {
    if (!data || typeof data !== 'object' || data.type !== NAMES_TYPE || !Array.isArray(data.names)) return undefined;
    return data.names.filter((n) => typeof n === 'string' && n && n.length <= MAX_NAME_LEN).slice(0, MAX_NAMES);
  }

  function createNamesStore(now = Date.now) {
    let names = [];
    let at = 0;
    return {
      set(list) {
        names = list;
        at = now();
      },
      get() {
        return now() - at <= STALE_MS ? names : [];
      },
    };
  }

  function createHostIdStore(now = Date.now) {
    let id = null;
    let at = 0;
    return {
      set(fileId) {
        id = fileId;
        at = now();
      },
      get() {
        return id && now() - at <= STALE_MS ? id : null;
      },
    };
  }

  return { makeMessage, parseMessage, makeNamesMessage, parseNamesMessage, createNamesStore, createHostIdStore, STALE_MS };
})();

if (typeof module !== 'undefined') module.exports = frameLink;
