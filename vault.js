// cofre: contas/<id>/ cofre.cad, cofre.bak, copias/, acesso.json, pin.dat
// AES-256-GCM, chave embrulhada pela senha e pelo codigo (scrypt)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FORMATO = 'caderneta-cofre';
const VERSAO = 1;
const KDF_PADRAO = { alg: 'scrypt', N: 2 ** 17, r: 8, p: 1 };
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I
const MAX_DADOS = 30 * 1024 * 1024;
const MAX_COPIAS = 30;
const ID_RE = /^[a-f0-9]{16}$/;

class VaultError extends Error {
  constructor(codigo, message) {
    super(message || codigo);
    this.codigo = codigo;
  }
}

const b64 = (buf) => buf.toString('base64');
const unb64 = (s) => Buffer.from(String(s || ''), 'base64');
const aad = (id, parte) => Buffer.from(`caderneta|${id}|${parte}`, 'utf8');

function validarKdf(k) {
  // limita os parametros (arquivo importado)
  if (!k || k.alg !== 'scrypt') throw new VaultError('formato', 'Arquivo de conta inválido.');
  const okN = Number.isInteger(k.N) && k.N >= 2 ** 14 && k.N <= 2 ** 20 && (k.N & (k.N - 1)) === 0;
  const okR = Number.isInteger(k.r) && k.r >= 1 && k.r <= 16;
  const okP = Number.isInteger(k.p) && k.p >= 1 && k.p <= 4;
  if (!okN || !okR || !okP) throw new VaultError('formato', 'Arquivo de conta inválido.');
  return k;
}

function derivar(segredo, sal, kdf) {
  validarKdf(kdf);
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(segredo).normalize('NFC'), sal, 32, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: 256 * kdf.N * kdf.r * kdf.p }, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

function selar(chave, conteudo, extra) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chave, iv);
  c.setAAD(extra);
  const ct = Buffer.concat([c.update(conteudo), c.final()]);
  return { iv: b64(iv), ct: b64(ct), tag: b64(c.getAuthTag()) };
}

// null = chave errada ou arquivo mexido
function abrir(chave, caixa, extra) {
  try {
    const iv = unb64(caixa.iv);
    const tag = unb64(caixa.tag);
    if (iv.length !== 12 || tag.length !== 16) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', chave, iv);
    d.setAAD(extra);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(unb64(caixa.ct)), d.final()]);
  } catch (_) {
    return null;
  }
}

function gerarCodigo() {
  const bytes = crypto.randomBytes(20);
  let s = '';
  for (const b of bytes) s += ALFABETO[b & 31];
  return s.match(/.{5}/g).join('-'); // 100 bits
}
const normalizarCodigo = (codigo) => String(codigo || '').toUpperCase().replace(/[^A-Z2-9]/g, '');

const contasDir = (root) => path.join(root, 'contas');
function contaDir(root, id) {
  if (!ID_RE.test(String(id))) throw new VaultError('id', 'Conta inválida.');
  return path.join(contasDir(root), id);
}
const cofreFile = (root, id) => path.join(contaDir(root, id), 'cofre.cad');

function gravarAtomico(file, conteudo) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, conteudo, typeof conteudo === 'string' ? 'utf8' : undefined);
  fs.renameSync(tmp, file);
}

function validarCabecalho(h) {
  if (!h || h.formato !== FORMATO || typeof h.versao !== 'number') throw new VaultError('formato', 'Esse arquivo não é uma conta da Caderneta.');
  if (h.versao > VERSAO) throw new VaultError('versao', 'Essa cópia foi feita numa versão mais nova da Caderneta. Atualize o app para abrir.');
  if (!ID_RE.test(String(h.id)) || !h.chaves || !h.chaves.senha || !h.chaves.recuperacao) throw new VaultError('formato', 'Arquivo de conta inválido.');
  validarKdf(h.kdf);
  return h;
}

function lerCabecalhoDe(file) {
  const st = fs.statSync(file);
  if (st.size > MAX_DADOS * 1.5) throw new VaultError('formato', 'Arquivo grande demais para ser uma conta.');
  let h;
  try {
    h = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    throw new VaultError('corrompido', 'O arquivo da conta está danificado.');
  }
  return validarCabecalho(h);
}

function lerCabecalho(root, id) {
  const file = cofreFile(root, id);
  if (!fs.existsSync(file)) throw new VaultError('inexistente', 'Essa conta não existe mais.');
  try {
    return lerCabecalhoDe(file);
  } catch (e) {
    // tenta o .bak
    const bak = path.join(contaDir(root, id), 'cofre.bak');
    if (e.codigo === 'corrompido' && fs.existsSync(bak)) return lerCabecalhoDe(bak);
    throw e;
  }
}

const hoje = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function gravarCabecalho(root, h) {
  const dir = contaDir(root, h.id);
  const file = cofreFile(root, h.id);
  const texto = JSON.stringify(h);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(file)) fs.copyFileSync(file, path.join(dir, 'cofre.bak'));
  gravarAtomico(file, texto);
  try {
    const copias = path.join(dir, 'copias');
    fs.mkdirSync(copias, { recursive: true });
    fs.writeFileSync(path.join(copias, `cofre-${hoje()}.cad`), texto, 'utf8');
    const lista = fs.readdirSync(copias).filter((f) => /^cofre-\d{4}-\d{2}-\d{2}\.cad$/.test(f)).sort();
    lista.slice(0, Math.max(0, lista.length - MAX_COPIAS)).forEach((f) => fs.rmSync(path.join(copias, f), { force: true }));
  } catch (_) {
  }
}

function listar(root) {
  const dir = contasDir(root);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const id of fs.readdirSync(dir)) {
    if (!ID_RE.test(id)) continue;
    try {
      const h = lerCabecalho(root, id);
      out.push({ id: h.id, nome: h.nome, cor: h.cor || 0, criadoEm: h.criadoEm, atualizadoEm: h.atualizadoEm });
    } catch (_) {
      /* ignora */
    }
  }
  return out.sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)));
}

async function criar(root, { nome, senha, cor = 0 }, kdf = KDF_PADRAO) {
  const n = String(nome || '').trim().slice(0, 60);
  if (!n) throw new VaultError('nome', 'Digite seu nome.');
  if (String(senha || '').length < 8) throw new VaultError('senha', 'A senha precisa ter pelo menos 8 caracteres.');
  const id = crypto.randomBytes(8).toString('hex');
  const chave = crypto.randomBytes(32);
  const codigo = gerarCodigo();
  const salSenha = crypto.randomBytes(16);
  const salRec = crypto.randomBytes(16);
  const [kSenha, kRec] = await Promise.all([derivar(senha, salSenha, kdf), derivar(normalizarCodigo(codigo), salRec, kdf)]);
  const agora = new Date().toISOString();
  const h = {
    formato: FORMATO,
    versao: VERSAO,
    id,
    nome: n,
    cor: Number.isInteger(cor) ? cor : 0,
    criadoEm: agora,
    atualizadoEm: agora,
    kdf,
    chaves: {
      senha: { sal: b64(salSenha), ...selar(kSenha, chave, aad(id, 'senha')) },
      recuperacao: { sal: b64(salRec), ...selar(kRec, chave, aad(id, 'recuperacao')) },
    },
    dados: null,
  };
  gravarCabecalho(root, h);
  return { id, chave, codigo };
}

async function desembrulhar(h, via, segredo) {
  const caixa = via === 'recuperacao' ? h.chaves.recuperacao : h.chaves.senha;
  const k = await derivar(via === 'recuperacao' ? normalizarCodigo(segredo) : segredo, unb64(caixa.sal), h.kdf);
  const chave = abrir(k, caixa, aad(h.id, via));
  return chave && chave.length === 32 ? chave : null;
}

function lerDados(h, chave) {
  if (!h.dados) return null;
  const buf = abrir(chave, h.dados, aad(h.id, 'dados'));
  if (!buf) throw new VaultError('corrompido', 'Os dados da conta foram alterados ou estão danificados.');
  return buf.toString('utf8');
}

async function desbloquear(root, id, senha) {
  const h = lerCabecalho(root, id);
  const chave = await desembrulhar(h, 'senha', senha);
  if (!chave) return { ok: false };
  return { ok: true, chave, json: lerDados(h, chave), nome: h.nome };
}

// recuperar: o codigo abre, define senha nova e troca o codigo
async function recuperar(root, id, codigo, novaSenha) {
  if (String(novaSenha || '').length < 8) throw new VaultError('senha', 'A senha nova precisa ter pelo menos 8 caracteres.');
  const h = lerCabecalho(root, id);
  const chave = await desembrulhar(h, 'recuperacao', codigo);
  if (!chave) return { ok: false };
  const json = lerDados(h, chave);
  const novoCodigo = await reembrulhar(h, chave, novaSenha, true);
  gravarCabecalho(root, h);
  return { ok: true, chave, json, nome: h.nome, codigo: novoCodigo };
}

async function reembrulhar(h, chave, novaSenha, trocarCodigo) {
  if (novaSenha !== null) {
    const sal = crypto.randomBytes(16);
    h.chaves.senha = { sal: b64(sal), ...selar(await derivar(novaSenha, sal, h.kdf), chave, aad(h.id, 'senha')) };
  }
  let codigo = null;
  if (trocarCodigo) {
    codigo = gerarCodigo();
    const sal = crypto.randomBytes(16);
    h.chaves.recuperacao = { sal: b64(sal), ...selar(await derivar(normalizarCodigo(codigo), sal, h.kdf), chave, aad(h.id, 'recuperacao')) };
  }
  h.atualizadoEm = new Date().toISOString();
  return codigo;
}

async function conferirSenha(h, chave, senha) {
  const c = await desembrulhar(h, 'senha', senha);
  return Boolean(c && crypto.timingSafeEqual(c, chave));
}

async function trocarSenha(root, id, chave, atual, nova) {
  if (String(nova || '').length < 8) throw new VaultError('senha', 'A senha nova precisa ter pelo menos 8 caracteres.');
  const h = lerCabecalho(root, id);
  if (!(await conferirSenha(h, chave, atual))) return { ok: false };
  await reembrulhar(h, chave, nova, false);
  gravarCabecalho(root, h);
  return { ok: true };
}

async function novoCodigo(root, id, chave, senha) {
  const h = lerCabecalho(root, id);
  if (!(await conferirSenha(h, chave, senha))) return { ok: false };
  const codigo = await reembrulhar(h, chave, null, true);
  gravarCabecalho(root, h);
  return { ok: true, codigo };
}

function salvar(root, id, chave, json, nome) {
  if (typeof json !== 'string' || json.length > MAX_DADOS) throw new VaultError('dados', 'Dados grandes demais.');
  JSON.parse(json); // so json valido
  const h = lerCabecalho(root, id);
  h.dados = selar(chave, Buffer.from(json, 'utf8'), aad(id, 'dados'));
  if (typeof nome === 'string' && nome.trim()) h.nome = nome.trim().slice(0, 60);
  h.atualizadoEm = new Date().toISOString();
  gravarCabecalho(root, h);
  return { ok: true, em: h.atualizadoEm };
}

async function apagar(root, id, chave, senha) {
  const h = lerCabecalho(root, id);
  if (!(await conferirSenha(h, chave, senha))) return { ok: false };
  fs.rmSync(contaDir(root, id), { recursive: true, force: true });
  return { ok: true };
}

function exportar(root, id, destino) {
  lerCabecalho(root, id);
  fs.copyFileSync(cofreFile(root, id), destino);
}

function lerCopia(file) {
  const h = lerCabecalhoDe(file);
  return h;
}

async function importar(root, h, segredo, via = 'senha', substituir = false) {
  validarCabecalho(h);
  const chave = await desembrulhar(h, via, segredo);
  if (!chave) return { ok: false };
  lerDados(h, chave);
  const dir = contaDir(root, h.id);
  const existe = fs.existsSync(path.join(dir, 'cofre.cad'));
  if (existe && !substituir) return { ok: false, existe: true };
  if (existe) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(path.join(dir, 'cofre.cad'), path.join(dir, `antes-de-importar-${stamp}.cad`));
  }
  gravarCabecalho(root, h);
  chave.fill(0);
  return { ok: true, id: h.id };
}

const acessoFile = (root, id) => path.join(contaDir(root, id), 'acesso.json');
function lerAcesso(root, id) {
  const file = acessoFile(root, id);
  try {
    const a = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { falhas: 0, bloqueadoAte: 0, falhasDesde: 0, ultimaFalha: null, ultimoAcesso: null, historico: [], ...a };
  } catch (_) {
    return { falhas: 0, bloqueadoAte: 0, falhasDesde: 0, ultimaFalha: null, ultimoAcesso: null, historico: [] };
  }
}
const gravarAcesso = (root, id, a) => {
  try {
    gravarAtomico(acessoFile(root, id), JSON.stringify(a));
  } catch (_) { /* sem permissão, segue */ }
};

const TENTATIVAS_LIVRES = 5;
const ESPERA_INICIAL = 30 * 1000;
const ESPERA_MAXIMA = 15 * 60 * 1000;

function bloqueio(root, id, agora = Date.now()) {
  const a = lerAcesso(root, id);
  const restante = Math.max(0, (a.bloqueadoAte || 0) - agora);
  return { bloqueado: restante > 0, restanteMs: restante, falhas: a.falhas, livres: Math.max(0, TENTATIVAS_LIVRES - a.falhas) };
}

function registrarFalha(root, id, via, agora = Date.now()) {
  const a = lerAcesso(root, id);
  a.falhas = (a.falhas || 0) + 1;
  a.falhasDesde = (a.falhasDesde || 0) + 1;
  a.ultimaFalha = new Date(agora).toISOString();
  if (a.falhas >= TENTATIVAS_LIVRES) a.bloqueadoAte = agora + Math.min(ESPERA_MAXIMA, ESPERA_INICIAL * 2 ** (a.falhas - TENTATIVAS_LIVRES));
  a.historico = [{ em: a.ultimaFalha, ok: false, via }, ...(a.historico || [])].slice(0, 30);
  gravarAcesso(root, id, a);
  return bloqueio(root, id, agora);
}

function registrarSucesso(root, id, via, agora = Date.now()) {
  const a = lerAcesso(root, id);
  const resumo = { falhasDesde: a.falhasDesde || 0, ultimaFalha: a.ultimaFalha, ultimoAcesso: a.ultimoAcesso };
  a.falhas = 0;
  a.bloqueadoAte = 0;
  a.falhasDesde = 0;
  a.pinFalhas = 0;
  a.ultimoAcesso = new Date(agora).toISOString();
  if (via !== 'pin') a.ultimaSenha = a.ultimoAcesso;
  a.historico = [{ em: a.ultimoAcesso, ok: true, via }, ...(a.historico || [])].slice(0, 30);
  gravarAcesso(root, id, a);
  return resumo;
}

const historico = (root, id) => lerAcesso(root, id).historico || [];

// PIN: pin.dat trancado c/ dpapi, 5 erros apaga, pede a senha a cada 30d, n vai nos backups
// protetor: disponivel(), fechar(txt), abrir(buf)
const PIN_RE = /^\d{6,12}$/;
const PIN_TENTATIVAS = 5;
const PIN_VALIDADE = 30 * 24 * 60 * 60 * 1000;
const pinFile = (root, id) => path.join(contaDir(root, id), 'pin.dat');
async function protetorOk(p) {
  try {
    return Boolean(p && (await p.disponivel()));
  } catch (_) {
    return false;
  }
}

async function lerPin(root, id, protetor) {
  const file = pinFile(root, id);
  if (!fs.existsSync(file) || !(await protetorOk(protetor))) return null;
  try {
    const { texto, renovar } = await protetor.abrir(fs.readFileSync(file));
    const p = JSON.parse(texto);
    if (!p || p.formato !== 'caderneta-pin' || p.id !== id) return null;
    validarKdf(p.kdf);
    if (renovar) gravarAtomico(file, await protetor.fechar(texto)); // windows trocou a chave
    return p;
  } catch (_) {
    return null;
  }
}

async function statusPin(root, id, protetor, agora = Date.now()) {
  const p = await lerPin(root, id, protetor);
  if (!p) return { ativo: false };
  const a = lerAcesso(root, id);
  const base = Date.parse(a.ultimaSenha || p.criadoEm) || 0;
  return { ativo: true, digitos: p.digitos, expirado: agora - base > PIN_VALIDADE, restantes: Math.max(0, PIN_TENTATIVAS - (a.pinFalhas || 0)) };
}

async function definirPin(root, id, chave, senha, pin, protetor, kdf = KDF_PADRAO) {
  if (!(await protetorOk(protetor))) throw new VaultError('pin', 'Este computador não deixa guardar o PIN com segurança. Continue usando a senha.');
  const p = String(pin || '');
  if (!PIN_RE.test(p)) throw new VaultError('pin', 'O PIN precisa ter de 6 a 12 números.');
  const h = lerCabecalho(root, id);
  if (!(await conferirSenha(h, chave, senha))) return { ok: false };
  const sal = crypto.randomBytes(16);
  const k = await derivar(p, sal, kdf);
  const corpo = { formato: 'caderneta-pin', versao: 1, id, kdf, digitos: p.length, criadoEm: new Date().toISOString(), sal: b64(sal), ...selar(k, chave, aad(id, 'pin')) };
  gravarAtomico(pinFile(root, id), await protetor.fechar(JSON.stringify(corpo)));
  const a = lerAcesso(root, id);
  a.pinFalhas = 0;
  a.ultimaSenha = new Date().toISOString();
  gravarAcesso(root, id, a);
  return { ok: true, digitos: p.length };
}

function removerPin(root, id) {
  fs.rmSync(pinFile(root, id), { force: true });
}

async function entrarComPin(root, id, pin, protetor, agora = Date.now()) {
  const st = await statusPin(root, id, protetor, agora);
  if (!st.ativo) return { ok: false, codigo: 'sem-pin' };
  if (st.expirado) return { ok: false, codigo: 'pin-expirado' };
  const p = await lerPin(root, id, protetor);
  if (!p) return { ok: false, codigo: 'sem-pin' };
  const h = lerCabecalho(root, id);
  const k = await derivar(String(pin || '').slice(0, 12), unb64(p.sal), p.kdf);
  const chave = abrir(k, p, aad(id, 'pin'));
  if (!chave || chave.length !== 32) {
    const a = lerAcesso(root, id);
    a.pinFalhas = (a.pinFalhas || 0) + 1;
    a.falhasDesde = (a.falhasDesde || 0) + 1;
    a.ultimaFalha = new Date(agora).toISOString();
    a.historico = [{ em: a.ultimaFalha, ok: false, via: 'pin' }, ...(a.historico || [])].slice(0, 30);
    const restantes = Math.max(0, PIN_TENTATIVAS - a.pinFalhas);
    if (!restantes) {
      removerPin(root, id);
      a.pinFalhas = 0;
    }
    gravarAcesso(root, id, a);
    return { ok: false, codigo: restantes ? 'pin-errado' : 'pin-desligado', restantes };
  }
  return { ok: true, chave, json: lerDados(h, chave), nome: h.nome };
}

module.exports = {
  VaultError, KDF_PADRAO, ID_RE,
  listar, criar, desbloquear, recuperar, trocarSenha, novoCodigo, salvar, apagar,
  exportar, lerCopia, importar,
  bloqueio, registrarFalha, registrarSucesso, historico,
  statusPin, definirPin, removerPin, entrarComPin,
  // p/ testes
  _interno: { gerarCodigo, normalizarCodigo, selar, abrir, cofreFile, contaDir, pinFile },
};
