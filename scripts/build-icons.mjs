// Renderiza o símbolo vetorial do cabeçalho, sem fontes, rede ou bibliotecas de arte.
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const root = new URL('../', import.meta.url);
const svg = await readFile(new URL('assets/app/icon.svg', root), 'utf8');
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage();
  for (const size of [180, 192, 512]) {
    const png = await page.evaluate(async ({ svg, size }) => {
      const img = new Image(); img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      return canvas.toDataURL('image/png').split(',')[1];
    }, { svg, size });
    await writeFile(new URL(`assets/app/icon-${size}.png`, root), Buffer.from(png, 'base64'));
  }
} finally { await browser.close(); }
