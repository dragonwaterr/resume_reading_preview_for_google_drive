// 웹스토어 제출용 zip을 만든다: node scripts/build.js
// - 허용 목록(INCLUDE)에 있는 파일만 담는다 (spike/·tests/·docs/·assets/ 제외)
// - 복사본에서만 manifest의 개발용 "key"를 빼고 log.js의 DEBUG를 끈다. 원본은 건드리지 않는다.
// - zip 루트에 manifest.json이 오도록 만든다 (PLAN 8장)
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const INCLUDE = ['manifest.json', '_locales', 'icons', 'src'];

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const stage = path.join(ROOT, 'dist', 'stage');
const zipPath = path.join(ROOT, 'dist', `resume-preview-${manifest.version}.zip`);

fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.mkdirSync(stage, { recursive: true });
for (const entry of INCLUDE) {
  fs.cpSync(path.join(ROOT, entry), path.join(stage, entry), { recursive: true });
}

delete manifest.key;
fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const logPath = path.join(stage, 'src/content/log.js');
const logSrc = fs.readFileSync(logPath, 'utf8');
if (!logSrc.includes('const DEBUG = true;')) throw new Error('log.js에서 DEBUG 선언을 찾지 못했습니다');
fs.writeFileSync(logPath, logSrc.replace('const DEBUG = true;', 'const DEBUG = false;'));

// manifest가 참조하는 파일이 모두 들어갔는지 확인
const referenced = [
  ...Object.values(manifest.icons || {}),
  manifest.options_ui?.page,
  ...manifest.content_scripts.flatMap((cs) => cs.js),
].filter(Boolean);
const missing = referenced.filter((file) => !fs.existsSync(path.join(stage, file)));
if (missing.length) throw new Error(`zip에 없는 파일: ${missing.join(', ')}`);

execFileSync('zip', ['-r', '-X', '-q', zipPath, '.', '-x', '.DS_Store', '*/.DS_Store'], { cwd: stage });
fs.rmSync(stage, { recursive: true, force: true });
console.log(`생성: ${path.relative(ROOT, zipPath)}`);
