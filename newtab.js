import { createPlayer } from './player.js';

// 試作用の値（後でポップアップの設定に置き換える）
// テストには公開プレイリストを使う（DESIGN.md 6-2）: NASA Video「NASA Ultra High Definition Video UHD」
const PLAYLIST_ID = 'PLiuUQ9asub3RaYzGhx3Bsxi1NPOnuBm_T';
const SHUFFLE = true; // false で連続再生

const $ = (id) => document.getElementById(id);

// ---- 確認用パネル（試作が終わったら消す） ----
function log(message) {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()} ${message}`;
  $('log').prepend(li);
  while ($('log').children.length > 12) $('log').lastChild.remove();
}

function showInfo(info) {
  $('index').textContent =
    info.playlist ? `${(info.playlistIndex ?? 0) + 1} / ${info.playlist.length}` : '-';
  $('muted').textContent = info.muted === undefined ? '-' : info.muted ? 'ミュート中' : '音あり';
  $('volume-value').textContent = info.volume ?? '-';
}

// ---- パネル（DESIGN.md 4-1a） ----
function showVideo({ video_id, title }) {
  if (!title) return;
  $('title').textContent = title;
  $('title').href = `https://www.youtube.com/watch?v=${video_id}`;
  $('panel').hidden = false;
}

function showMuted(muted) {
  // SVG 要素には hidden プロパティがないので、属性を直接切り替える
  $('icon-muted').toggleAttribute('hidden', !muted);
  $('icon-sound').toggleAttribute('hidden', muted);
  $('mute').setAttribute('aria-label', muted ? 'ミュート解除' : 'ミュート');
}

// ---- プレーヤー ----
let started = false;

const player = createPlayer($('player'), {
  playlistId: PLAYLIST_ID,
  onReady: () => log('onReady'),
  onInfo: (info, changed) => {
    showInfo(info);
    if (changed.videoData) showVideo(changed.videoData);
    if ('muted' in changed) showMuted(changed.muted);
    // つまみを動かしている最中は、届いた値で上書きしない
    if ('volume' in changed && document.activeElement !== $('volume')) $('volume').value = changed.volume;

    if ('playlist' in changed) log(`プレイリスト ${changed.playlist?.length ?? 0} 本`);
    if (changed.videoData?.title) log(`動画名: ${changed.videoData.title}`);

    // プレイリストの本数が分かったら、シャッフルを設定してランダムな位置から始める（DESIGN.md 2-2, 2-3）
    if (!started && info.playlist?.length) {
      started = true;
      player.setShuffle(SHUFFLE);
      const index = Math.floor(Math.random() * info.playlist.length);
      player.playVideoAt(index);
      log(`シャッフル=${SHUFFLE}、${index + 1} 本目から再生`);
    }
  },
  onStateChange: (state) => log(`onStateChange: ${state}`),
  onError: (code) => log(`onError: ${code}`),
});

$('mute').addEventListener('click', () => (player.info.muted ? player.unMute() : player.mute()));
$('next').addEventListener('click', () => player.nextVideo());
$('volume').addEventListener('input', (e) => {
  player.setVolume(Number(e.target.value));
  if (player.info.muted) player.unMute();
});
