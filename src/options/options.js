// 옵션 페이지: 토스트 켜기/끄기 (FR-6). 변경 즉시 저장하며 다음 이동부터 적용된다.
document.documentElement.lang = chrome.i18n.getUILanguage();
for (const el of document.querySelectorAll('[data-i18n]')) {
  el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
}

const toastCheckbox = document.getElementById('toast');
const status = document.getElementById('status');

settingsStore.load().then((settings) => {
  toastCheckbox.checked = settings.toast;
});

toastCheckbox.addEventListener('change', async () => {
  const ok = await settingsStore.save({ toast: toastCheckbox.checked });
  status.textContent = chrome.i18n.getMessage(ok ? 'optionsSaved' : 'optionsSaveFailed');
});
