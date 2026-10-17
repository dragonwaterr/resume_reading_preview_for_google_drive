// 개발 중 동작 확인용 로그. 배포 zip(scripts/build.js)에서는 DEBUG가 false로 바뀐다.
const DEBUG = true;

function log(...args) {
  if (DEBUG) console.debug('[Resume Reading]', ...args);
}
