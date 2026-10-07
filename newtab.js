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
  scrollTitleIfLong();
}

const SCROLL_SPEED = 40; // px/秒

function scrollTitleIfLong() {
  const title = $('title');
  title.classList.remove('scrolling');
  const overflow = title.scrollWidth - $('title-box').clientWidth;
  if (overflow <= 0) return;
  title.style.setProperty('--shift', `${-overflow}px`);
  // 動いている時間は全体の 70%（前後 15% ずつ止まる）。少しだけはみ出すときも、止まる時間を確保する
  title.style.setProperty('--duration', `${Math.max(overflow / SCROLL_SPEED / 0.7, 5)}s`);
  void title.offsetWidth; // 動画が変わったとき、最初から流し直す
  title.classList.add('scrolling');
}

function showMuted({ muted, volume }) {
  const silent = muted || volume === 0;
  // SVG 要素には hidden プロパティがないので、属性を直接切り替える
  $('icon-muted').toggleAttribute('hidden', !silent);
  $('icon-sound').toggleAttribute('hidden', silent);
  $('mute').setAttribute('aria-label', muted ? 'ミュート解除' : 'ミュート');
}

// ---- プレーヤー ----
let started = false;

// 連打しても古い状態で判断しないよう、YouTube から届くのを待たずに手元で先に書き換える
const sound = { muted: true, volume: undefined };

const player = createPlayer($('player'), {
  playlistId: PLAYLIST_ID,
  onReady: () => log('onReady'),
  onInfo: (info, changed) => {
    showInfo(info);
    if (changed.videoData) showVideo(changed.videoData);
    if ('muted' in changed) sound.muted = changed.muted;
    if ('volume' in changed) sound.volume = changed.volume;
    if ('muted' in changed || 'volume' in changed) showMuted(sound);
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

$('mute').addEventListener('click', () => {
  if (sound.volume === 0) return; // 解除すると YouTube が音量を 5 にしてしまうので、何もしない
  sound.muted = !sound.muted;
  sound.muted ? player.mute() : player.unMute();
  showMuted(sound);
});
$('next').addEventListener('click', () => player.nextVideo());
$('volume').addEventListener('input', (e) => {
  sound.volume = Number(e.target.value);
  player.setVolume(sound.volume);
  // 0 のまま解除すると YouTube が音量を 5 にしてしまうので、0 より大きいときだけ
  if (sound.muted && sound.volume > 0) {
    sound.muted = false;
    player.unMute();
  }
  showMuted(sound);
});
