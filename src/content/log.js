// 개발 중 동작 확인용 로그. 출시 전(루프 5)에 DEBUG를 false로 바꾼다.
const DEBUG = true;

function log(...args) {
  if (DEBUG) console.debug('[PDF Pick Up]', ...args);
}
