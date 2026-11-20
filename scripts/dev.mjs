// dev: vite + electron (pasta "Caderneta (dev)")
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const server = await createServer();
await server.listen();
const url = server.resolvedUrls.local[0];
console.log(`Vite rodando em ${url}`);

const child = spawn(electronPath, ['.'], { stdio: 'inherit', env: { ...process.env, VITE_DEV_SERVER_URL: url } });
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
