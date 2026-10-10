import { test, expect, waitForPlaying, NASA_PLAYLIST } from './fixtures.js';

// 未登録・エラー時の案内（DESIGN.md 4-5）。未登録は popup.spec.js で確かめている

test.describe('オフライン', () => {
  test('オフラインなら案内を出し、つながったら再生を始める', async ({ context, extensionId, setSettings }) => {
    await setSettings({ playlistId: NASA_PLAYLIST.id, playlistTitle: NASA_PLAYLIST.title });
    const page = context.pages()[0];
    await context.setOffline(true);
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    await expect(page.locator('#empty')).toBeVisible();
    await expect(page.locator('#empty')).toContainText('オフラインです');
    await expect(page.locator('#player iframe')).toHaveCount(0);

    await context.setOffline(false);
    await waitForPlaying(page);
    await expect(page.locator('#empty')).toBeHidden();
  });
});

test.describe('再生できないプレイリスト', () => {
  test.use({ playlist: { id: 'PLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', title: null } });

  test('削除・非公開のプレイリストなら案内を出す', async ({ page }) => {
    await expect(page.locator('#empty')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#empty')).toContainText('プレイリストを再生できません');
    await expect(page.locator('#panel')).toBeHidden();
  });
});
