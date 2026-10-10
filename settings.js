// 設定の保存と読み込み（DESIGN.md 5-3）。新しいタブとポップアップの両方から使う

export const DEFAULTS = {
  playlistId: null,
  playlistTitle: null,
  shuffle: true, // false で連続再生（DESIGN.md 2-2）
  blur: 6, // px（DESIGN.md 4-4）
  dim: 0.5, // 0〜1
  volume: 50, // 0〜100。新しいタブを開いたときの音量（DESIGN.md 3）
};

export async function loadSettings() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(Object.keys(DEFAULTS))) };
}

export function saveSettings(changes) {
  return chrome.storage.local.set(changes);
}

// 変わった項目だけを { 名前: 新しい値 } で渡す
export function onSettingsChanged(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const changed = {};
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (key in DEFAULTS) changed[key] = newValue ?? DEFAULTS[key];
    }
    if (Object.keys(changed).length) callback(changed);
  });
}

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'];

const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,}$/;

// プレイリストの URL（watch?v=...&list=... も含む）か ID そのものから、ID を取り出す。取り出せなければ null
export function parsePlaylistId(text) {
  text = text.trim();
  let url;
  try {
    url = new URL(text);
  } catch {
    return PLAYLIST_ID.test(text) ? text : null;
  }
  if (!YOUTUBE_HOSTS.includes(url.hostname)) return null;
  const id = url.searchParams.get('list');
  return id && PLAYLIST_ID.test(id) ? id : null;
}

// YouTube の公開情報（oEmbed）からプレイリスト名を取る。
// 見つからない（削除・非公開）ときは null、通信できないときは例外
export async function fetchPlaylistTitle(playlistId) {
  const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(playlistUrl)}`);
  if (!res.ok) return null;
  return (await res.json()).title ?? null;
}
