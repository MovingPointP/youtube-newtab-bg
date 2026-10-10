import { loadSettings, saveSettings, parsePlaylistId, fetchPlaylistTitle } from './settings.js';

const $ = (id) => document.getElementById(id);

function showMessage(text, type) {
  $('message').textContent = text;
  $('message').className = type;
}

function showCurrent({ playlistId, playlistTitle }) {
  $('current-title').textContent = playlistId ? (playlistTitle ?? playlistId) : '未登録';
}

async function register(playlistId) {
  showMessage('確認しています…', '');
  let title;
  try {
    title = await fetchPlaylistTitle(playlistId);
  } catch {
    // 通信できないときは名前なしで登録する。名前の代わりに ID を表示する
    title = undefined;
  }
  if (title === null) {
    showMessage('プレイリストが見つかりません。削除されたか、非公開の可能性があります', 'error');
    return;
  }
  const settings = { playlistId, playlistTitle: title ?? null };
  await saveSettings(settings);
  showCurrent(settings);
  showMessage('登録しました', 'ok');
}

// ---- プレイリスト（DESIGN.md 5-2） ----
$('url-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = parsePlaylistId($('url').value);
  if (!id) {
    showMessage('プレイリストの URL ではありません（list= を含む YouTube の URL を貼り付けてください）', 'error');
    return;
  }
  register(id).then(() => ($('url').value = ''));
});

// 開いているタブが YouTube のプレイリストなら、ボタン 1 つで登録できるようにする
let tabPlaylistId = null;
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  tabPlaylistId = tab?.url ? parsePlaylistId(tab.url) : null;
  $('use-tab').disabled = !tabPlaylistId;
  $('use-tab-note').hidden = Boolean(tabPlaylistId);
});
$('use-tab').addEventListener('click', () => register(tabPlaylistId));

// ---- 再生順（DESIGN.md 2-2） ----
$('order').addEventListener('change', (e) => saveSettings({ shuffle: e.target.value === 'shuffle' }));

// ---- ぼかしと暗さ（DESIGN.md 4-4）。動かしている間も新しいタブに反映する ----
function showSliderValues() {
  $('blur-value').textContent = $('blur').value;
  $('dim-value').textContent = `${$('dim').value}%`;
}
$('blur').addEventListener('input', () => {
  showSliderValues();
  saveSettings({ blur: Number($('blur').value) });
});
$('dim').addEventListener('input', () => {
  showSliderValues();
  saveSettings({ dim: Number($('dim').value) / 100 });
});

// ---- 保存されている設定を表示する ----
const settings = await loadSettings();
showCurrent(settings);
// fieldset.elements の名前引きは、form と違ってラジオボタンのグループを返さないので、直接選ぶ
document.querySelector(`input[name="order"][value="${settings.shuffle ? 'shuffle' : 'sequential'}"]`).checked = true;
$('blur').value = settings.blur;
$('dim').value = Math.round(settings.dim * 100);
showSliderValues();
