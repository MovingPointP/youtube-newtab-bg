import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, chromium, expect } from '@playwright/test';

const extensionPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 拡張を読み込んだ Chromium で、新しいタブを開いた状態から始める
export const test = base.extend({
  context: async ({ viewport }, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', // 拡張を読み込めるのは Playwright の Chromium だけ（Chrome 本体は不可）
      viewport,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await page.goto('chrome://newtab/');
    await use(page);
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
