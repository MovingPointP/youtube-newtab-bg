// icons/icon.svg から、拡張で使う大きさの PNG を作る: node scripts/build-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const SIZES = [16, 32, 48, 128];
const svg = readFileSync(new URL('../icons/icon.svg', import.meta.url), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  // 透明な背景の上に、指定の大きさで描く
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg.replace('width="128" height="128"', `width="${size}" height="${size}"`)}`);
  await page.screenshot({ path: `icons/icon${size}.png`, omitBackground: true });
}
await browser.close();
console.log(`icons/icon{${SIZES.join(',')}}.png を作りました`);
