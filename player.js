// YouTube の埋め込みプレーヤーを postMessage で直接操作する（DESIGN.md 2-6）
// 公式の IFrame Player API（iframe_api）が内部で使っているやり取りを、自分で書いている。
// YouTube 側の仕様が変わったときは、このファイルだけを直す。

const YT_ORIGIN = 'https://www.youtube.com';

// container の中にプレーヤーの iframe を作る。
// コールバック:
//   onReady()               プレーヤーの準備ができた
//   onInfo(info, changed)   状態が届いた（info は届いた分をすべてまとめたもの、changed は今回届いた分）
//   onStateChange(state)    再生状態が変わった（-1 未開始, 0 終了, 1 再生中, 2 一時停止, 3 読み込み中, 5 頭出し済み）
//   onError(code)           エラー（2 パラメータ不正, 5 HTML5 エラー, 100 見つからない, 101/150 埋め込み禁止）
export function createPlayer(container, { playlistId, onReady, onInfo, onStateChange, onError }) {
  const params = new URLSearchParams({
    list: playlistId,
    listType: 'playlist',
    enablejsapi: '1',
    autoplay: '1',
    mute: '1',
    controls: '0',
    cc_load_policy: '0', // 字幕を最初から出さない（ミュート時の自動字幕には効かないので hideCaptions も使う）
    origin: location.origin,
    newtabbg: '1', // 目印。rules.json がこれを見て Referer を付ける（DESIGN.md 1-3）
  });

  const iframe = document.createElement('iframe');
  iframe.src = `${YT_ORIGIN}/embed/videoseries?${params}`;
  iframe.allow = 'autoplay; encrypted-media';
  container.appendChild(iframe);

  const info = {};
  let connected = false;
  let listenTimer;

  function post(data) {
    iframe.contentWindow?.postMessage(JSON.stringify({ ...data, id: 1, channel: 'widget' }), YT_ORIGIN);
  }

  function command(func, ...args) {
    post({ event: 'command', func, args });
  }

  // 読み込みが終わったら、返事が来るまで「聞いています」と送り続ける（公式の API と同じ手順）
  iframe.addEventListener('load', () => {
    connected = false;
    clearInterval(listenTimer);
    post({ event: 'listening' });
    listenTimer = setInterval(() => post({ event: 'listening' }), 250);
  });

  window.addEventListener('message', (e) => {
    if (e.origin !== YT_ORIGIN || e.source !== iframe.contentWindow) return;
    let data;
    try {
      data = JSON.parse(e.data);
    } catch {
      return;
    }

    if (!connected) {
      connected = true;
      clearInterval(listenTimer);
      command('addEventListener', 'onStateChange');
      command('addEventListener', 'onError');
    }

    switch (data.event) {
      case 'onReady':
        onReady?.();
        break;
      case 'initialDelivery':
      case 'infoDelivery':
        Object.assign(info, data.info);
        onInfo?.(info, data.info);
        break;
      case 'onStateChange':
        onStateChange?.(data.info);
        break;
      case 'onError':
        onError?.(data.info);
        break;
    }
  });

  return {
    iframe,
    info,
    command,
    play: () => command('playVideo'),
    pause: () => command('pauseVideo'),
    mute: () => command('mute'),
    unMute: () => command('unMute'),
    setVolume: (volume) => command('setVolume', volume),
    setShuffle: (shuffle) => command('setShuffle', shuffle),
    setLoop: (loop) => command('setLoop', loop),
    playVideoAt: (index) => command('playVideoAt', index),
    nextVideo: () => command('nextVideo'),
    seekTo: (seconds) => command('seekTo', seconds, true),
    // ミュートで再生すると YouTube が字幕を自動で出すので、字幕の機能ごと外す（公式の API にはない命令）
    hideCaptions: () => command('unloadModule', 'captions'),
  };
}
