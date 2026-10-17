# 웹스토어 대시보드 "개인정보 보호" 탭 답변 (R-14, R-16)

대시보드는 영어 입력을 기준으로 한다. 각 코드 블록은 **입력란 하나**에 그대로 붙여넣는다 (입력란마다 1,000자 제한, 모두 400자 이내).

대시보드 화면 순서 ↔ 이 문서
1. 전용 목적 설명 → "단일 목적" (81자)
2. storage 사용 근거 → "storage" (337자)
3. 호스트 권한 사용 근거 → "호스트 권한" (280자)
4. 원격 코드 사용 중이신가요? → **"아니요, 원격 코드 권한을 사용하고 있지 않습니다."** (선택하면 '근거' 입력란이 사라짐)
5. 사용자 데이터 사용 9개 항목 → 모두 체크 안 함
6. "다음과 같이 밝힌 내용이 사실임을 확인합니다" 3개 → 모두 체크
7. 개인정보처리방침 URL → 맨 아래 URL

## 단일 목적 (Single purpose)
```
Automatically reopens Google Drive PDF previews at the page the user last viewed.
```

## 권한 사용 사유 (Permission justification)

**storage**
```
Stores the last viewed page number for each PDF (keyed by its Google Drive file ID) and the on/off setting for the "Moved to page N" notice. Data is kept in chrome.storage.local and chrome.storage.sync so reading positions persist and follow the user across their own Chrome browsers. Nothing is sent to the developer or any third party.
```

**호스트 권한 (https://drive.google.com/\*, content script)**
```
The content script runs only on Google Drive pages. It detects when a PDF preview is open, reads which page of the preview is currently shown, and scrolls the preview to the saved page. It does not read file contents, does not call any Google API, and does not send data anywhere.
```

## 원격 코드 (Remote code)
- 선택: **No, I am not using Remote code**
- 근거: 모든 JavaScript가 패키지에 포함되어 있고 외부 스크립트·원격 설정 로드·`eval`을 쓰지 않는다 (CLAUDE.md 권한·정책).

## 데이터 사용 (Data usage)

**수집하는 사용자 데이터 항목**: 모두 체크하지 않음
- 근거: 개발자나 제3자에게 전송되는 데이터가 없다. 파일 ID와 페이지 번호는 사용자 브라우저(`chrome.storage.local`)와 사용자 본인의 Chrome 동기화 저장소(`chrome.storage.sync`)에만 저장된다.
- 심사에서 "Website content" 또는 "User activity" 해당 여부를 문의받으면, 위 근거와 함께 기기·동기화 저장소 밖으로 나가지 않는다고 답한다. 보수적으로 체크해야 한다는 지적을 받으면 "Website content"만 체크하고 아래 세 항목 인증은 유지한다.

**인증 (세 항목 모두 체크)**
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

## 개인정보처리방침 URL
```
https://dragonwaterr.github.io/resume_reading_preview_for_google_drive/privacy.html
```
- 루프 5의 2번 작업(GitHub Pages 게시) 후 실제로 열리는지 확인한다.
