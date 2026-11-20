// gera build/icon.png -> npm run icon
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 32 32">
  <rect x="1" y="1" width="30" height="30" rx="8" fill="#2547C0"/>
  <rect x="7" y="6" width="19" height="21" rx="2.5" fill="#fff"/>
  <rect x="12.2" y="15.3" width="11.6" height="3.4" rx="1" fill="#FFE45E"/>
  <path d="M13.4 12.5h9.6M13.4 17h9.6M13.4 21.5h6.6" stroke="#9DB0E6" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M11 6v21" stroke="#E35B60" stroke-width="1.3"/>
</svg>`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } });
  await win.loadURL(`data:text/html,<html><body style="margin:0;background:transparent">${encodeURIComponent(SVG)}</body></html>`);
  await new Promise((r) => setTimeout(r, 400));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  const out = path.join(__dirname, '..', 'build', 'icon.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, img.resize({ width: 512, height: 512 }).toPNG());
  console.log('ícone gerado em', out);
  app.quit();
});
