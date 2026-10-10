import { createPlayer } from './player.js';
import { loadSettings, saveSettings, onSettingsChanged } from './settings.js';

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

// ---- ぼかしと暗さ（DESIGN.md 4-4） ----
function applyLook({ blur, dim }) {
  if (blur !== undefined) document.documentElement.style.setProperty('--blur', `${blur}px`);
  if (dim !== undefined) document.documentElement.style.setProperty('--dim', dim);
}

// ---- 動画の表示（DESIGN.md 4-3） ----
// YouTube は、再生が始まるたび（開いたとき・次の動画・裏から戻ったとき）に約 4〜5 秒、
// 画面の中央に操作ボタンを出す。消せないので、その間は動画を隠し、消えてからふわっと出す
const BUTTONS_SHOWN_MS = 5000;
// 動画の終わりは、この秒数前からふわっと暗くする（暗くなるのにかかる時間は newtab.html の transition）
const FADE_OUT_BEFORE_END_S = 2;

let showTimer = null;

function hideVideo() {
  clearTimeout(showTimer);
  showTimer = null;
  document.body.classList.remove('video-visible');
}

function showVideoLater() {
  if (showTimer || document.body.classList.contains('video-visible')) return;
  showTimer = setTimeout(() => {
    showTimer = null;
    document.body.classList.add('video-visible');
  }, BUTTONS_SHOWN_MS);
}

// ---- プレーヤー ----
function startPlayer({ playlistId, shuffle, volume }) {
  let started = false;

  // 連打しても古い状態で判断しないよう、YouTube から届くのを待たずに手元で先に書き換える
  const sound = { muted: true, volume };
  $('volume').value = volume;

  const player = createPlayer($('player'), {
    playlistId,
    onReady: () => log('onReady'),
    onInfo: (info, changed) => {
      showInfo(info);
      if (changed.videoData) showVideo(changed.videoData);
      if ('muted' in changed) sound.muted = changed.muted;
      if ('volume' in changed) sound.volume = changed.volume;
      if ('muted' in changed || 'volume' in changed) showMuted(sound);
      // つまみを動かしている最中は、届いた値で上書きしない
      if ('volume' in changed && document.activeElement !== $('volume')) $('volume').value = changed.volume;

      if ('currentTime' in changed && info.duration && info.duration - changed.currentTime <= FADE_OUT_BEFORE_END_S) {
        hideVideo();
      }

      if ('playlist' in changed) log(`プレイリスト ${changed.playlist?.length ?? 0} 本`);
      if (changed.videoData?.title) log(`動画名: ${changed.videoData.title}`);

      // プレイリストの本数が分かったら、シャッフルを設定してランダムな位置から始める（DESIGN.md 2-2, 2-3）
      if (!started && info.playlist?.length) {
        started = true;
        player.setShuffle(shuffle);
        player.setLoop(true); // 最後まで行ったら最初に戻る
        player.setVolume(volume); // 保存した音量で始める（ミュートのまま）
        const index = Math.floor(Math.random() * info.playlist.length);
        player.playVideoAt(index);
        log(`シャッフル=${shuffle}、${index + 1} 本目から再生`);
      }
    },
    onStateChange: (state) => {
      log(`onStateChange: ${state}`);
      if (state === 1) {
        errorCount = 0;
        player.hideCaptions(); // 字幕は動画ごとに読み込まれるので、再生が始まるたびに外す
        showVideoLater();
      } else if (state !== 3) {
        // 未開始・終了・一時停止・頭出し。読み込み中（3）は、再生の途中でも起きるので隠さない
        hideVideo();
      }
      // 裏で開かれたときや、隠れた直後に次の動画が始まったときも止める
      if (state === 1 && document.hidden) player.pause();
    },
    onError: (code) => {
      log(`onError: ${code}`);
      skipBrokenVideo();
    },
  });

  // 埋め込み禁止・非公開・削除済みなどの動画は飛ばす（DESIGN.md 2-5）。
  // 全部再生できないときに飛ばし続けないよう、続けて失敗した回数を数える
  let errorCount = 0;

  function skipBrokenVideo() {
    errorCount++;
    if (errorCount >= (player.info.playlist?.length ?? 1)) {
      log('再生できる動画がないため停止');
      return;
    }
    player.nextVideo();
  }

  // 裏に回ったら一時停止し、表示されたら続きから再生する（DESIGN.md 2-4）
  document.addEventListener('visibilitychange', () => {
    document.hidden ? player.pause() : player.play();
  });

  $('mute').addEventListener('click', () => {
    if (sound.volume === 0) return; // 解除すると YouTube が音量を 5 にしてしまうので、何もしない
    sound.muted = !sound.muted;
    sound.muted ? player.mute() : player.unMute();
    showMuted(sound);
  });
  $('next').addEventListener('click', () => player.nextVideo());
  $('last').addEventListener('click', () => player.playVideoAt(player.info.playlist.length - 1));
  $('near-end').addEventListener('click', () => player.seekTo(player.info.duration - 5));
  $('volume').addEventListener('input', (e) => {
    sound.volume = Number(e.target.value);
    player.setVolume(sound.volume);
    // 次に開く新しいタブのために保存する。開いている他のタブには反映しない
    saveSettings({ volume: sound.volume });
    // 0 のまま解除すると YouTube が音量を 5 にしてしまうので、0 より大きいときだけ
    if (sound.muted && sound.volume > 0) {
      sound.muted = false;
      player.unMute();
    }
    showMuted(sound);
  });

  return player;
}

// ---- 設定を読み込んで始める（DESIGN.md 5-3） ----
const settings = await loadSettings();
applyLook(settings);

// プレイリストが未登録なら、案内を出す（DESIGN.md 4-5）
const player = settings.playlistId ? startPlayer(settings) : null;
$('empty').hidden = Boolean(player);

// ポップアップで設定を変えたら、開いている新しいタブにもその場で反映する
onSettingsChanged((changed) => {
  if ('playlistId' in changed) {
    location.reload(); // プレイリストが変わったら、最初から読み込み直す
    return;
  }
  applyLook(changed);
  if ('shuffle' in changed) player?.setShuffle(changed.shuffle);
});
