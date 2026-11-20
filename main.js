const { app, BrowserWindow, Menu, Notification, Tray, ipcMain, dialog, shell, nativeTheme, powerMonitor, clipboard, session, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const vault = require('./vault');

const APP_ID = 'com.renzo.caderneta';
app.setAppUserModelId(APP_ID); // notificacoes

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const TESTE = Boolean(process.env.CADERNETA_USER_DATA);

// pasta de dados (teste e dev usam outra)
if (TESTE) app.setPath('userData', process.env.CADERNETA_USER_DATA);
else app.setPath('userData', path.join(app.getPath('appData'), app.isPackaged ? 'Caderneta' : 'Caderneta (dev)'));

const root = () => app.getPath('userData');
const janelaFile = () => path.join(root(), 'janela.json');

function lerJanela() {
  try {
    const s = JSON.parse(fs.readFileSync(janelaFile(), 'utf8'));
    return s && typeof s === 'object' ? s : {};
  } catch (_) {
    return {};
  }
}
function gravarJanela(patch) {
  try {
    fs.mkdirSync(root(), { recursive: true });
    fs.writeFileSync(janelaFile(), JSON.stringify({ ...lerJanela(), ...patch }), 'utf8');
  } catch (_) { /* ignora */ }
}

let sessao = null; // {id, chave, nome}
let mainWin = null;
let tray = null;
let saindo = false;

function travar(motivo) {
  if (!sessao) return false;
  sessao.chave.fill(0);
  sessao = null;
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.setContentProtection(false);
    mainWin.webContents.reload();
  }
  if (process.env.CADERNETA_DEBUG) console.log('travado:', motivo);
  return true;
}

function abrirSessao(id, chave, nome) {
  if (sessao) sessao.chave.fill(0);
  sessao = { id, chave, nome };
}

// so aceita da propria pagina
function confiavel(e) {
  const url = (e.senderFrame && e.senderFrame.url) || '';
  if (DEV_URL) return url.startsWith(DEV_URL);
  return url.startsWith('file://') && url.includes('/dist/index.html');
}
function handle(canal, fn) {
  ipcMain.handle(canal, async (e, ...args) => {
    if (!confiavel(e)) return { ok: false, erro: 'Origem não autorizada.' };
    try {
      return await fn(e, ...args);
    } catch (err) {
      if (err instanceof vault.VaultError) return { ok: false, erro: err.message, codigo: err.codigo };
      console.error(canal, err);
      return { ok: false, erro: 'Algo deu errado. Tente de novo.' };
    }
  });
}
const exigirSessao = () => {
  if (!sessao) throw new vault.VaultError('travado', 'A conta está travada. Entre de novo.');
  return sessao;
};
const texto = (x, max = 200) => (typeof x === 'string' ? x.slice(0, max) : '');

// dpapi: pin.dat so abre nesse pc/usuario
const protetor = {
  disponivel: () => safeStorage.isAsyncEncryptionAvailable(),
  fechar: (t) => safeStorage.encryptStringAsync(t),
  abrir: async (buf) => {
    const r = await safeStorage.decryptStringAsync(buf);
    return { texto: r.result, renovar: Boolean(r.shouldReEncrypt) };
  },
};

// uma tentativa por vez
let tentando = false;
async function umaPorVez(fn) {
  if (tentando) return { ok: false, erro: 'Espere a tentativa anterior terminar.' };
  tentando = true;
  try {
    return await fn();
  } finally {
    tentando = false;
  }
}

handle('contas:listar', async () => ({
  ok: true,
  contas: await Promise.all(vault.listar(root()).map(async (c) => ({ ...c, ...vault.bloqueio(root(), c.id), pin: await vault.statusPin(root(), c.id, protetor) }))),
}));

handle('contas:criar', async (_e, { nome, senha, cor } = {}) => {
  const r = await vault.criar(root(), { nome: texto(nome, 60), senha: texto(senha, 500), cor });
  abrirSessao(r.id, r.chave, texto(nome, 60));
  vault.registrarSucesso(root(), r.id, 'criacao');
  return { ok: true, id: r.id, codigo: r.codigo, json: null };
});

handle('contas:entrar', (_e, { id, senha } = {}) => umaPorVez(async () => {
  const b = vault.bloqueio(root(), id);
  if (b.bloqueado) return { ok: false, bloqueio: b };
  const r = await vault.desbloquear(root(), id, texto(senha, 500));
  if (!r.ok) return { ok: false, bloqueio: vault.registrarFalha(root(), id, 'senha') };
  const resumo = vault.registrarSucesso(root(), id, 'senha');
  abrirSessao(id, r.chave, r.nome);
  return { ok: true, json: r.json, resumo };
}));

handle('contas:entrarPin', (_e, { id, pin } = {}) => umaPorVez(async () => {
  const r = await vault.entrarComPin(root(), id, texto(pin, 12), protetor);
  if (!r.ok) return { ok: false, codigo: r.codigo, restantes: r.restantes };
  const resumo = vault.registrarSucesso(root(), id, 'pin');
  abrirSessao(id, r.chave, r.nome);
  return { ok: true, json: r.json, resumo };
}));

handle('contas:recuperar', (_e, { id, codigo, novaSenha } = {}) => umaPorVez(async () => {
  const b = vault.bloqueio(root(), id);
  if (b.bloqueado) return { ok: false, bloqueio: b };
  const r = await vault.recuperar(root(), id, texto(codigo, 100), texto(novaSenha, 500));
  if (!r.ok) return { ok: false, bloqueio: vault.registrarFalha(root(), id, 'recuperacao') };
  const resumo = vault.registrarSucesso(root(), id, 'recuperacao');
  abrirSessao(id, r.chave, r.nome);
  return { ok: true, json: r.json, codigo: r.codigo, resumo };
}));

handle('contas:travar', () => ({ ok: travar('pedido') }));

// importar: escolhe o arquivo -> senha
const importacoes = new Map();
handle('contas:importarEscolher', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Abrir cópia da Caderneta',
    defaultPath: app.getPath('documents'),
    filters: [{ name: 'Cópia da Caderneta', extensions: ['cad'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths[0]) return { ok: false, cancelado: true };
  const h = vault.lerCopia(filePaths[0]);
  const token = crypto.randomBytes(12).toString('hex');
  importacoes.clear();
  importacoes.set(token, h);
  const existe = vault.listar(root()).some((c) => c.id === h.id);
  return { ok: true, token, nome: h.nome, atualizadoEm: h.atualizadoEm, existe };
});

handle('contas:importarConcluir', async (_e, { token, segredo, via, substituir } = {}) => {
  const h = importacoes.get(token);
  if (!h) return { ok: false, erro: 'Escolha o arquivo de novo.' };
  const r = await vault.importar(root(), h, texto(segredo, 500), via === 'recuperacao' ? 'recuperacao' : 'senha', Boolean(substituir));
  if (r.ok) importacoes.delete(token);
  return r;
});

handle('dados:salvar', (_e, json, nome) => {
  const s = exigirSessao();
  const r = vault.salvar(root(), s.id, s.chave, json, typeof nome === 'string' ? nome : undefined);
  if (typeof nome === 'string' && nome.trim()) s.nome = nome.trim();
  return r;
});

handle('conta:trocarSenha', async (_e, { atual, nova } = {}) => {
  const s = exigirSessao();
  return vault.trocarSenha(root(), s.id, s.chave, texto(atual, 500), texto(nova, 500));
});

handle('conta:novoCodigo', async (_e, { senha } = {}) => {
  const s = exigirSessao();
  return vault.novoCodigo(root(), s.id, s.chave, texto(senha, 500));
});

handle('conta:apagar', async (_e, { senha } = {}) => {
  const s = exigirSessao();
  const r = await vault.apagar(root(), s.id, s.chave, texto(senha, 500));
  if (r.ok) {
    agenda = [];
    travar('conta apagada');
  }
  return r;
});

handle('conta:pinStatus', async () => {
  const s = exigirSessao();
  return { ok: true, disponivel: await protetor.disponivel(), ...(await vault.statusPin(root(), s.id, protetor)) };
});

handle('conta:pinDefinir', (_e, { senha, pin } = {}) => umaPorVez(async () => {
  const s = exigirSessao();
  return vault.definirPin(root(), s.id, s.chave, texto(senha, 500), texto(pin, 20), protetor);
}));

handle('conta:pinRemover', () => {
  const s = exigirSessao();
  vault.removerPin(root(), s.id);
  return { ok: true };
});

handle('conta:historico', () => {
  const s = exigirSessao();
  return { ok: true, historico: vault.historico(root(), s.id) };
});

const carimbo = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const nomeArquivo = (s) => String(s || 'conta').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'conta';

handle('conta:exportar', async (e) => {
  const s = exigirSessao();
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Salvar cópia de segurança',
    defaultPath: path.join(app.getPath('documents'), `caderneta-${nomeArquivo(s.nome)}-${carimbo()}.cad`),
    filters: [{ name: 'Cópia da Caderneta', extensions: ['cad'] }],
  });
  if (canceled || !filePath) return { ok: false, cancelado: true };
  vault.exportar(root(), s.id, filePath);
  return { ok: true, arquivo: filePath };
});

let limparCopiaTimer = null;
handle('app:copiar', (_e, valor, segundos) => {
  const t = texto(valor, 20000);
  clipboard.writeText(t);
  clearTimeout(limparCopiaTimer);
  if (segundos > 0) {
    // limpa o clipboard dps de um tempo
    limparCopiaTimer = setTimeout(() => {
      if (clipboard.readText() === t) clipboard.clear();
    }, Math.min(600, segundos) * 1000);
  }
  return { ok: true };
});

handle('app:salvarTexto', async (e, { nome, conteudo } = {}) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Salvar',
    defaultPath: path.join(app.getPath('documents'), texto(nome, 80) || 'caderneta.txt'),
    filters: [{ name: 'Texto', extensions: ['txt'] }],
  });
  if (canceled || !filePath) return { ok: false, cancelado: true };
  fs.writeFileSync(filePath, texto(conteudo, 5000), 'utf8');
  return { ok: true, arquivo: filePath };
});

// ---- pdf ----
async function htmlParaPdf(html) {
  const tmp = path.join(os.tmpdir(), `caderneta-${crypto.randomBytes(6).toString('hex')}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  const pdfWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await pdfWin.loadFile(tmp);
    return await pdfWin.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'default' } });
  } finally {
    pdfWin.destroy();
    fs.rmSync(tmp, { force: true });
  }
}

handle('export:pdf', async (e, { nome, html, arquivo } = {}) => {
  exigirSessao();
  if (typeof html !== 'string' || html.length > 5 * 1024 * 1024) return { ok: false, erro: 'Relatório inválido.' };
  let destino = TESTE && typeof arquivo === 'string' ? arquivo : null; // so nos testes
  if (!destino) {
    const win = BrowserWindow.fromWebContents(e.sender);
    const r = await dialog.showSaveDialog(win, {
      title: 'Salvar PDF',
      defaultPath: path.join(app.getPath('documents'), texto(nome, 80) || 'caderneta.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (r.canceled || !r.filePath) return { ok: false, cancelado: true };
    destino = r.filePath;
  }
  fs.writeFileSync(destino, await htmlParaPdf(html));
  return { ok: true, arquivo: destino };
});

handle('app:abrirPasta', () => {
  shell.openPath(root());
  return { ok: true };
});
handle('app:info', () => ({ ok: true, versao: app.getVersion(), pasta: root(), empacotado: app.isPackaged }));

const TEMAS = { auto: 'system', caderno: 'light', lousa: 'dark' };
const FUNDO = { claro: '#EEF2F7', escuro: '#101715' };
const fundo = () => (nativeTheme.shouldUseDarkColors ? FUNDO.escuro : FUNDO.claro);

handle('ui:tema', (e, tema) => {
  if (!TEMAS[tema]) return { ok: false };
  nativeTheme.themeSource = TEMAS[tema];
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.setBackgroundColor(fundo());
  gravarJanela({ tema });
  return { ok: true };
});

handle('ui:protegerCaptura', (e, ligado) => {
  exigirSessao();
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && !TESTE) win.setContentProtection(Boolean(ligado));
  return { ok: true };
});

handle('ui:segundoPlano', (_e, ligado) => {
  gravarJanela({ segundoPlano: Boolean(ligado) });
  return { ok: true };
});

// avisos
let agenda = [];
const disparados = new Set();

handle('avisos:agenda', (_e, lista) => {
  exigirSessao();
  if (!Array.isArray(lista)) return { ok: false };
  agenda = lista.slice(0, 300).filter((a) => a && typeof a.at === 'number' && typeof a.id === 'string').map((a) => ({
    id: texto(a.id, 120), at: a.at, title: texto(a.title, 120) || 'Caderneta', body: texto(a.body, 240),
  }));
  return { ok: true, total: agenda.length };
});

function mostrarAviso(title, body) {
  if (TESTE) {
    fs.appendFileSync(path.join(root(), 'avisos-teste.log'), `${title}\n${body}\n---\n`, 'utf8');
    return true;
  }
  if (!Notification.isSupported()) return false;
  const n = new Notification({ title, body, icon: path.join(__dirname, 'build', 'icon.png') });
  n.on('click', mostrarJanela);
  n.show();
  return true;
}

handle('avisos:testar', () => ({ ok: mostrarAviso('Caderneta', 'Os avisos estão funcionando. Eles aparecem assim, no canto da tela.') }));

function conferirAgenda() {
  const agora = Date.now();
  for (const a of agenda) {
    if (disparados.has(a.id)) continue;
    // passou de 15min: n avisa
    if (a.at <= agora && agora - a.at < 15 * 60 * 1000) {
      disparados.add(a.id);
      mostrarAviso(a.title, a.body);
    }
  }
  if (disparados.size > 2000) disparados.clear();
}

function mostrarJanela() {
  if (!mainWin || mainWin.isDestroyed()) return createWindow();
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
}

function criarBandeja() {
  if (tray || TESTE) return;
  tray = new Tray(path.join(__dirname, 'build', 'icon.png'));
  tray.setToolTip('Caderneta');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir a Caderneta', click: mostrarJanela },
    { label: 'Travar agora', click: () => travar('bandeja') },
    { type: 'separator' },
    { label: 'Sair (para de avisar)', click: () => { saindo = true; app.quit(); } },
  ]));
  tray.on('click', mostrarJanela);
}

function createWindow() {
  Menu.setApplicationMenu(null);
  const st = lerJanela();
  nativeTheme.themeSource = TEMAS[st.tema] || 'system';
  const bounds = st.width >= 900 && st.height >= 600 ? { x: st.x, y: st.y, width: st.width, height: st.height } : { width: 1280, height: 840 };

  mainWin = new BrowserWindow({
    ...bounds,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: fundo(),
    title: 'Caderneta',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webviewTag: false,
      devTools: !app.isPackaged,
    },
  });
  const win = mainWin;
  if (st.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());

  win.on('close', (e) => {
    const b = win.getNormalBounds();
    gravarJanela({ ...b, maximized: win.isMaximized() });
    // X = vai pra bandeja (se ativado)
    const paraBandeja = !saindo && !TESTE && lerJanela().segundoPlano !== false && agenda.length > 0;
    if (!paraBandeja) {
      saindo = true;
    } else {
      e.preventDefault();
      travar('fechou a janela');
      win.hide();
      criarBandeja();
      if (!lerJanela().avisouBandeja) {
        gravarJanela({ avisouBandeja: true });
        mostrarAviso('A Caderneta continua aberta', 'Ela fica perto do relógio para te avisar dos lembretes. Para fechar de vez, clique com o botão direito no ícone e escolha Sair.');
      }
    }
  });
  win.on('closed', () => { mainWin = null; });

  // bloqueia navegacao e janela nova
  win.webContents.on('will-navigate', (e, url) => {
    if (!DEV_URL || !url.startsWith(DEV_URL)) e.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-attach-webview', (e) => e.preventDefault());

  if (process.env.CADERNETA_DEBUG) {
    win.webContents.on('console-message', (e) => console.log(`[tela:${e.level}] ${e.message}`));
  }

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

// single instance
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', mostrarJanela);
  app.whenReady().then(() => {
    // nega todas as permissoes
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    session.defaultSession.setPermissionCheckHandler(() => false);

    createWindow();
    setInterval(conferirAgenda, 20 * 1000);

    // win+L / suspender = trava
    powerMonitor.on('lock-screen', () => travar('windows travado'));
    powerMonitor.on('suspend', () => travar('suspensão'));

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('before-quit', () => {
    saindo = true;
    if (sessao) sessao.chave.fill(0);
    sessao = null;
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && (saindo || !tray)) app.quit();
  });
}
