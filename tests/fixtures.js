import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, chromium, expect } from '@playwright/test';

const extensionPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// テストには公開プレイリストを使う（DESIGN.md 6-2）
export const NASA_PLAYLIST = {
  id: 'PLiuUQ9asub3RaYzGhx3Bsxi1NPOnuBm_T',
  title: 'NASA Ultra High Definition Video UHD',
};

export const test = base.extend({
  // 新しいタブを開く前に登録しておくプレイリスト。null なら未登録のまま
  playlist: [NASA_PLAYLIST, { option: true }],

  context: async ({ viewport }, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', // 拡張を読み込めるのは Playwright の Chromium だけ（Chrome 本体は不可）
      viewport,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // 起動時に開く空のタブを使う（別に開くと、空のタブのスクリーンショットも残るため）
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('chrome://newtab/');
    const id = new URL(page.url()).host;
    // 開いたままだと、設定を書き換えたときに新しいタブが読み込み直されて、次の page.goto とぶつかる
    await page.goto('about:blank');
    await use(id);
  },

  // 拡張のページで chrome.storage を書き換える
  setSettings: async ({ context, extensionId }, use) => {
    await use(async (settings) => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await page.evaluate((s) => chrome.storage.local.set(s), settings);
      await page.close();
    });
  },

  page: async ({ context, extensionId, playlist, setSettings }, use) => {
    if (playlist) await setSettings({ playlistId: playlist.id, playlistTitle: playlist.title });
    const page = context.pages()[0];
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    await use(page);
  },

  popup: async ({ context, extensionId }, use) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await use(popup);
  },
});

export { expect };

// 確認用パネルの表示を読む
export const debug = {
  muted: (page) => page.locator('#muted'),
  volume: (page) => page.locator('#volume-value'),
  index: (page) => page.locator('#index'),
  log: (page) => page.locator('#log'),
};

export async function waitForPlaying(page) {
  await expect(debug.log(page)).toContainText('onStateChange: 1', { timeout: 30_000 });
  await expect(debug.volume(page)).not.toHaveText('-');
}

export function getSettings(page) {
  return page.evaluate(() => chrome.storage.local.get(null));
}
