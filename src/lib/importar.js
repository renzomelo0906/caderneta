// importar a resposta (json) da IA. o app n chama IA nenhuma
import { uid, makeMateria, nextColor, suggestSigla, SIGLA_RE, TIPOS_ETAPA, materiasDo } from './model.js';
import { FINAL, tipoDe } from './grades.js';
import { FUNCTION_NAMES } from './formula.js';
import { parseNum, fmtNota, minutos, hhmm } from './format.js';

export class ImportError extends Error {}

// "Matemática I" -> "MATEMATICA I"
export const norm = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

const p2 = (n) => String(n).padStart(2, '0');
const semZeros = (v) => fmtNota(v, 2).replace(/,?0+$/, '');

// prompt
export function promptNotas(data, periodo) {
  const tipo = TIPOS_ETAPA[periodo.tipo];
  const materias = materiasDo(data, periodo.id).map((m) => m.nome);
  const m1 = materias[0] || 'Matemática';
  const e1 = periodo.etapas[0].codigo;
  const nmax = periodo.notaMaxima;
  const exemplo = {
    caderneta: 'notas',
    notas: [
      { materia: m1, parte: e1, avaliacao: 'Prova 1', nota: Math.min(8.5, nmax) },
      { materia: m1, parte: e1, avaliacao: 'Trabalho', nota: Math.min(1.5, nmax), vale: Math.min(2, nmax) },
    ],
    medias: [{ materia: m1, parte: e1, media: Math.min(7.8, nmax) }],
    bonus: [{ materia: m1, parte: e1, motivo: 'Participação', pontos: 0.5 }],
  };
  const partes = periodo.etapas.length <= 12
    ? periodo.etapas.map((e) => `${e.codigo} para o ${e.nome}`).join(', ')
    : `${periodo.etapas[0].codigo} a ${periodo.etapas[periodo.etapas.length - 1].codigo} (${tipo.plural})`;
  return [
    'Vou te mandar prints do meu boletim escolar. Leia as notas e transforme em dados para o app Caderneta.',
    '',
    'Responda SOMENTE com um bloco de código JSON, sem nenhum texto antes ou depois, exatamente neste formato:',
    '',
    '```json',
    JSON.stringify(exemplo, null, 2),
    '```',
    '',
    'Regras:',
    `- "materia": o nome da matéria como aparece no print.${materias.length ? ` Se for uma destas, escreva igual: ${materias.join(', ')}.` : ''}`,
    `- "parte": ${partes}. Recuperação final, exame ou nota do ano todo: use "FINAL".`,
    '- "avaliacao": o nome da avaliação (Prova 1, Trabalho, Simulado...). Se o print não mostra o nome, use "Nota 1", "Nota 2" e assim por diante, na ordem em que aparecem.',
    '- "nota": número com ponto decimal, como 8.5. Se a avaliação ainda não tem nota, use null.',
    `- "vale": só quando o print mostrar que a avaliação vale menos que ${semZeros(nmax)} (ex.: um trabalho de 2 pontos). Se não, não coloque o campo.`,
    '- "medias": a média que a escola mostra para cada matéria em cada parte, se aparecer. Se o print só tem as médias, sem as avaliações, deixe "notas" vazio.',
    '- "bonus": pontos extras (ou descontos, com número negativo) que aparecem separados das avaliações. Se não houver, deixe vazio.',
    `- As notas vão de 0 a ${semZeros(nmax)}. Copie como está no print, sem arredondar nem converter.`,
    '- Não invente nada. Se algo estiver cortado ou ilegível, deixe de fora.',
    '- Coloque todas as notas de todos os prints, até o fim, sem resumir.',
  ].join('\n');
}

export function promptHorario(data, periodo) {
  const materias = materiasDo(data, periodo.id).map((m) => m.nome);
  const m1 = materias[0] || 'Matemática';
  const exemplo = {
    caderneta: 'horario',
    aulas: [
      { dia: 'segunda', inicio: '07:00', fim: '07:50', materia: m1, sala: '12', professor: 'Carla' },
      { dia: 'segunda', inicio: '07:50', fim: '08:40', materia: m1 },
    ],
  };
  return [
    'Vou te mandar um print do meu horário de aulas. Transforme em dados para o app Caderneta.',
    '',
    'Responda SOMENTE com um bloco de código JSON, sem nenhum texto antes ou depois, exatamente neste formato:',
    '',
    '```json',
    JSON.stringify(exemplo, null, 2),
    '```',
    '',
    'Regras:',
    '- Uma linha para cada aula de cada dia. Aula dupla vira duas linhas (ou uma linha do início da primeira até o fim da segunda).',
    '- "dia": domingo, segunda, terça, quarta, quinta, sexta ou sábado.',
    '- "inicio" e "fim": hora de 24 horas no formato HH:MM. Se o print não mostra o fim, use o início da aula seguinte do mesmo dia; na última aula do dia, some 50 minutos.',
    `- "materia": o nome da matéria como aparece no print.${materias.length ? ` Se for uma destas, escreva igual: ${materias.join(', ')}.` : ''}`,
    '- "sala" e "professor": só se aparecerem no print. Se não, não coloque os campos.',
    '- Intervalo, recreio e almoço não entram.',
    '- Não invente nada. Se algo estiver cortado ou ilegível, deixe de fora.',
  ].join('\n');
}

// parse
function consertar(s) {
  let t = s
    .replace(/[“”„‟″]/g, '"') // aspas curvas
    .replace(/[‘’‚‛]/g, "'")
    .replace(/,\s*([}\]])/g, '$1') // virgula sobrando
    .replace(/\b(NaN|undefined)\b/g, 'null')
    .replace(/:\s*(-?\d+),(\d+)(\s*[,}\]\n])/g, ': $1.$2$3'); // 8,5 -> 8.5
  if (!t.includes('"')) t = t.replace(/'/g, '"'); // aspas simples
  return t;
}

// acha o json no meio do texto (```json etc)
export function extrairJSON(texto) {
  let s = String(texto ?? '').replace(/^﻿/, '').trim();
  if (!s) throw new ImportError('Cole a resposta da IA (ou abra o arquivo) primeiro.');
  if (s.length > 2000000) throw new ImportError('Esse texto é grande demais para ser uma resposta da IA.');
  const bloco = s.match(/```[a-zA-Z]*\s*([\s\S]*?)```/);
  if (bloco && /[[{]/.test(bloco[1])) s = bloco[1].trim();
  const i = s.search(/[[{]/);
  if (i < 0) throw new ImportError('Não achei os dados nesse texto. Confira se copiou a resposta inteira da IA.');
  const fim = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (fim <= i) throw new ImportError('A resposta parece cortada no meio. Peça para a IA mandar de novo, completa.');
  s = s.slice(i, fim + 1);
  for (const tentativa of [s, consertar(s)]) {
    try {
      return JSON.parse(tentativa);
    } catch (_) {
      /* prox */
    }
  }
  throw new ImportError('A resposta não está no formato que o app entende. Peça para a IA responder só com o bloco de código JSON e cole de novo.');
}

// "matéria" -> MATERIA, "hora início" -> HORA_INICIO
const chaves = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).map(([k, v]) => [norm(k).replace(/ /g, '_'), v])) : {});
function campo(o, nomes) {
  for (const n of nomes) if (o[n] !== undefined && o[n] !== null && o[n] !== '') return o[n];
  return undefined;
}
const texto = (v, max = 60) => (v === undefined || v === null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, max));

const C_MATERIA = ['MATERIA', 'DISCIPLINA', 'COMPONENTE', 'COMPONENTE_CURRICULAR', 'SUBJECT', 'CURSO'];
const C_PARTE = ['PARTE', 'ETAPA', 'TRIMESTRE', 'BIMESTRE', 'SEMESTRE', 'UNIDADE', 'MODULO', 'PERIODO', 'TERM'];

function listas(obj) {
  const out = { notas: [], medias: [], bonus: [], aulas: [] };
  const classificar = (item, herdado = {}) => {
    const o = { ...herdado, ...chaves(item) };
    if (o.DIA !== undefined || o.DIA_DA_SEMANA !== undefined || o.INICIO !== undefined || o.HORA_INICIO !== undefined) out.aulas.push(o);
    else if (o.PONTOS !== undefined || o.MOTIVO !== undefined) out.bonus.push(o);
    else if ((o.MEDIA !== undefined || o.MEDIA_FINAL !== undefined) && o.NOTA === undefined && o.AVALIACAO === undefined) out.medias.push(o);
    else out.notas.push(o);
  };
  const lista = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
  if (Array.isArray(obj)) {
    lista(obj).forEach((x) => classificar(x));
    return out;
  }
  const o = chaves(obj);
  lista(o.NOTAS || o.AVALIACOES).forEach((x) => out.notas.push(chaves(x)));
  lista(o.MEDIAS).forEach((x) => out.medias.push(chaves(x)));
  lista(o.BONUS || o.BONIFICACOES || o.BONUS_E_DESCONTOS).forEach((x) => out.bonus.push(chaves(x)));
  lista(o.AULAS || o.HORARIO || o.HORARIOS || o.GRADE).forEach((x) => out.aulas.push(chaves(x)));
  // {materias: [{nome, notas, medias}]}
  for (const m of lista(o.MATERIAS || o.DISCIPLINAS)) {
    const mm = chaves(m);
    const herdado = { MATERIA: campo(mm, ['MATERIA', 'NOME', 'DISCIPLINA']) };
    lista(mm.NOTAS || mm.AVALIACOES).forEach((x) => out.notas.push({ ...herdado, ...chaves(x) }));
    lista(mm.MEDIAS).forEach((x) => out.medias.push({ ...herdado, ...chaves(x) }));
    lista(mm.BONUS).forEach((x) => out.bonus.push({ ...herdado, ...chaves(x) }));
  }
  return out;
}

const APELIDOS = {
  MAT: 'MATEMATICA', MATEMATICAS: 'MATEMATICA',
  PORT: 'PORTUGUES', LP: 'PORTUGUES', LPL: 'PORTUGUES', 'LINGUA PORTUGUESA': 'PORTUGUES', 'LINGUA PORTUGUESA E LITERATURA': 'PORTUGUES', 'LINGUA PORTUGUESA E LITERATURA BRASILEIRA': 'PORTUGUES',
  RED: 'REDACAO', LIT: 'LITERATURA', 'LITERATURA BRASILEIRA': 'LITERATURA',
  HIST: 'HISTORIA', HIS: 'HISTORIA', GEO: 'GEOGRAFIA', GEOG: 'GEOGRAFIA',
  FIS: 'FISICA', QUIM: 'QUIMICA', QUI: 'QUIMICA', BIO: 'BIOLOGIA', BIOL: 'BIOLOGIA',
  ING: 'INGLES', 'LINGUA INGLESA': 'INGLES', 'LINGUA ESTRANGEIRA INGLES': 'INGLES', 'LEM INGLES': 'INGLES',
  ESP: 'ESPANHOL', 'LINGUA ESPANHOLA': 'ESPANHOL', 'LINGUA ESTRANGEIRA ESPANHOL': 'ESPANHOL',
  FILO: 'FILOSOFIA', FIL: 'FILOSOFIA', SOC: 'SOCIOLOGIA', SOCIO: 'SOCIOLOGIA',
  ART: 'ARTES', ARTE: 'ARTES', 'EDUCACAO ARTISTICA': 'ARTES',
  EF: 'EDUCACAO FISICA', EDF: 'EDUCACAO FISICA', 'ED FISICA': 'EDUCACAO FISICA', 'EDUC FISICA': 'EDUCACAO FISICA',
  CIE: 'CIENCIAS', CIEN: 'CIENCIAS',
};
const chaveMateria = (s) => {
  const k = norm(s);
  return (APELIDOS[k] || k).replace(/S\b/g, ''); // ARTES = ARTE
};

export function casarMateria(nome, materias) {
  const k = chaveMateria(nome);
  if (!k) return null;
  const cands = materias.map((m) => ({ m, k: chaveMateria(m.nome) }));
  const um = (xs) => (xs.length === 1 ? xs[0].m.id : null);
  const exato = cands.filter((c) => c.k === k);
  if (exato.length) return exato[0].m.id;
  // "PORTUGUES E LITERATURA" tem "PORTUGUES"
  const palavras = k.split(' ');
  const contem = cands.filter((c) => ` ${k} `.includes(` ${c.k} `) || ` ${c.k} `.includes(` ${k} `) || (c.k.length >= 4 && !c.k.includes(' ') && palavras.some((w) => w.startsWith(c.k))));
  if (contem.length) return um(contem);
  const prefixo = cands.filter((c) => k.length >= 3 && (c.k.startsWith(k) || k.startsWith(c.k)));
  return um(prefixo);
}

const ROMANOS = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
const ORDINAIS = ['PRIMEIR', 'SEGUND', 'TERCEIR', 'QUART', 'QUINT', 'SEXT', 'SETIM', 'OITAV', 'NON', 'DECIM'];

// "1º trimestre", "T1", "Trimestre I", "2" -> id da etapa
export function casarParte(valor, periodo) {
  if (valor === undefined || valor === null || valor === '') return periodo.etapas.length === 1 ? periodo.etapas[0].id : null;
  const t = norm(valor);
  if (!t) return null;
  if (/\b(FINAL|EXAME|ANUAL|RF)\b/.test(t) || /^(ANO|ANO TODO|ANO LETIVO|PERIODO TODO|RESULTADO)$/.test(t)) return FINAL;
  const junto = t.replace(/ /g, '');
  const porCodigo = periodo.etapas.find((e) => e.codigo === junto);
  if (porCodigo) return porCodigo.id;
  const porNome = periodo.etapas.find((e) => norm(e.nome) === t);
  if (porNome) return porNome.id;
  let n = null;
  const dig = t.match(/\d+/);
  if (dig) n = Number(dig[0]);
  else {
    const rom = t.split(' ').find((w) => ROMANOS[w]);
    if (rom) n = ROMANOS[rom];
    else {
      const i = ORDINAIS.findIndex((o) => t.split(' ').some((w) => w.startsWith(o)));
      if (i >= 0) n = i + 1;
    }
  }
  if (n !== null && n >= 1 && n <= periodo.etapas.length) return periodo.etapas[n - 1].id;
  return null;
}

// 8.5, "8,5", "8,5 pts" | "-", "a fazer" = null | lixo = NaN
export function lerNumero(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  const s = v.trim();
  if (!s || /^(-+|—|–|\*+|null|nenhuma?|sem nota|a fazer|pendente|n\/?a|nd|nc)$/i.test(s)) return null;
  return parseNum(s.replace(/\s*(pts?|pontos?)\.?$/i, '').replace(/\s/g, ''));
}

export function lerData(v) {
  const s = texto(v, 30);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let y;
  let mo;
  let d;
  if (m) [, y, mo, d] = m.map(Number);
  else {
    m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (!m) return '';
    d = Number(m[1]);
    mo = Number(m[2]);
    y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : new Date().getFullYear();
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return `${y}-${p2(mo)}-${p2(d)}`;
}

// 0 = domingo. aceita "seg", "2ª feira", "Monday", 1..7
export function lerDia(v) {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 7 ? v % 7 : null;
  const bruto = texto(v, 30).toLowerCase();
  const br = bruto.match(/^([1-7])\s*(ª|a|º|o)?\s*(-?\s*feira)?$/);
  if (br && (br[2] || br[3])) return (Number(br[1]) + 6) % 7;
  if (/^[0-7]$/.test(bruto)) return Number(bruto) % 7;
  const t = norm(v);
  const NOMES = [['DOM', 'SUN'], ['SEG', 'MON'], ['TER', 'TUE'], ['QUA', 'WED'], ['QUI', 'THU'], ['SEX', 'FRI'], ['SAB', 'SAT']];
  const i = NOMES.findIndex((ns) => ns.some((n) => t.startsWith(n)));
  return i >= 0 ? i : null;
}

// "7:00", "07h00", "7h", "7.30", 7 -> "07:00"
export function lerHora(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v < 24 ? `${p2(v)}:00` : null;
  const s = String(v).trim().toLowerCase().replace(/\s/g, '');
  const m = s.match(/^(\d{1,2})(?:[:h.](\d{2}))?(?:h|min|hs)?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2] || 0);
  if (h > 23 || mi > 59) return null;
  return `${p2(h)}:${p2(mi)}`;
}

// mapa: {chave: id | 'nova' | 'ignorar'}
function resolverMaterias(nomes, materias, mapa = {}) {
  const lidas = new Map();
  for (const nome of nomes) {
    const chave = norm(nome);
    if (!chave) continue;
    if (lidas.has(chave)) {
      lidas.get(chave).qtd++;
      continue;
    }
    const auto = casarMateria(nome, materias);
    const escolhida = mapa[chave];
    const destino = escolhida === 'nova' || escolhida === 'ignorar' || materias.some((m) => m.id === escolhida) ? escolhida : auto || 'nova';
    lidas.set(chave, { chave, nome: texto(nome, 50), auto, destino, qtd: 1 });
  }
  return lidas;
}

const RESERVADAS = new Set(['MEDIA', 'SOMA', 'BONUS', 'ESCOLA', ...FUNCTION_NAMES]);

// previa: nova, atualiza, igual, repetida ou erro
export function analisarNotas(obj, data, periodo, mapas = {}) {
  const { notas, medias, bonus, aulas } = listas(obj);
  if (!notas.length && !medias.length && !bonus.length) {
    throw new ImportError(aulas.length ? 'Isso parece um horário de aulas. Para importar, use a opção Horário.' : 'Não achei nenhuma nota nessa resposta.');
  }
  const materias = materiasDo(data, periodo.id);
  const nmax = periodo.notaMaxima;
  const brutas = [
    ...notas.map((o) => ({ tipo: 'avaliacao', o })),
    ...medias.map((o) => ({ tipo: 'oficial', o })),
    ...bonus.map((o) => ({ tipo: 'bonus', o })),
  ].slice(0, 2000);
  const lidas = resolverMaterias(brutas.map(({ o }) => texto(campo(o, C_MATERIA), 50)), materias, mapas.materias);
  const partes = new Map();
  const siglas = new Map(); // materia|etapa -> siglas usadas
  const vistas = new Set();
  const nomesAuto = new Map();

  const linhas = brutas.map(({ tipo, o }, i) => {
    const materiaNome = texto(campo(o, C_MATERIA), 50);
    const parteBruta = campo(o, C_PARTE);
    const l = { i, tipo, materiaNome, materiaChave: norm(materiaNome), parteTexto: texto(parteBruta, 40), status: 'nova', erro: null, sel: true };
    const mat = lidas.get(l.materiaChave);
    l.materiaId = mat ? mat.destino : null;

    const parteChave = norm(parteBruta);
    const escolhida = mapas.partes && mapas.partes[parteChave];
    l.etapaId = escolhida !== undefined ? escolhida : casarParte(parteBruta, periodo);
    if (escolhida === undefined && l.etapaId === null) {
      const p = partes.get(parteChave) || { chave: parteChave, texto: l.parteTexto, qtd: 0 };
      p.qtd++;
      partes.set(parteChave, p);
    }

    if (tipo === 'oficial') {
      l.nome = 'Média da escola';
      l.sigla = 'ESCOLA';
      l.valor = lerNumero(campo(o, ['MEDIA', 'MEDIA_FINAL', 'NOTA', 'VALOR', 'RESULTADO']));
    } else if (tipo === 'bonus') {
      l.nome = texto(campo(o, ['MOTIVO', 'DESCRICAO', 'NOME', 'AVALIACAO']), 60) || 'Bônus';
      l.valor = lerNumero(campo(o, ['PONTOS', 'BONUS', 'VALOR', 'NOTA']));
    } else {
      l.nome = texto(campo(o, ['AVALIACAO', 'NOME', 'ATIVIDADE', 'DESCRICAO', 'INSTRUMENTO', 'TITULO']), 60);
      l.valor = lerNumero(campo(o, ['NOTA', 'VALOR', 'RESULTADO', 'GRADE', 'PONTOS']));
      const vale = lerNumero(campo(o, ['VALE', 'MAXIMO', 'NOTA_MAXIMA', 'VALOR_MAXIMO', 'MAX', 'TOTAL']));
      l.vale = typeof vale === 'number' && vale > 0 && Math.abs(vale - nmax) > 1e-9 ? vale : null;
      const peso = lerNumero(campo(o, ['PESO']));
      l.peso = typeof peso === 'number' && peso > 0 ? peso : 1;
      l.data = lerData(campo(o, ['DATA']));
      l.siglaDada = texto(campo(o, ['SIGLA']), 12).replace(/\s/g, '');
    }
    l.data = l.data || '';

    const falha = (msg) => {
      l.status = 'erro';
      l.erro = msg;
      l.sel = false;
      return l;
    };
    if (!materiaNome) return falha('Sem o nome da matéria.');
    if (Number.isNaN(l.valor)) return falha('O valor não é um número.');
    if (tipo === 'oficial') {
      if (l.valor === null) return falha('Sem o valor da média.');
      if (l.valor < 0 || l.valor > nmax + 1e-9) return falha(`A média passa de ${semZeros(nmax)}.`);
    } else if (tipo === 'bonus') {
      if (!l.valor) return falha('Sem os pontos do bônus.');
      if (Math.abs(l.valor) > nmax + 1e-9) return falha(`Bônus maior que ${semZeros(nmax)} pontos.`);
    } else {
      const teto = l.vale ?? nmax;
      if (l.valor !== null && (l.valor < 0 || l.valor > teto + 1e-9)) return falha(`A nota passa de ${semZeros(teto)}${l.vale ? ', o quanto a avaliação vale' : ', a nota máxima do período'}.`);
    }
    if (l.materiaId === 'ignorar') {
      l.status = 'ignorada';
      l.sel = false;
      return l;
    }
    if (l.etapaId === 'ignorar') {
      l.status = 'ignorada';
      l.sel = false;
      return l;
    }
    if (!l.etapaId) return falha(l.parteTexto ? `Não sei em que parte entra "${l.parteTexto}".` : 'Sem a parte (trimestre, bimestre...).');

    // repetida
    const grupo = `${l.materiaId === 'nova' ? `nova:${l.materiaChave}` : l.materiaId}|${l.etapaId}`;
    if (tipo === 'avaliacao' && !l.nome) {
      const k = (nomesAuto.get(grupo) || 0) + 1;
      nomesAuto.set(grupo, k);
      l.nome = `Nota ${k}`;
    }
    const assinatura = `${grupo}|${tipo}|${norm(l.nome)}|${l.valor}`;
    if (vistas.has(assinatura)) {
      l.status = 'repetida';
      l.sel = false;
      return l;
    }
    vistas.add(assinatura);

    const existentes = l.materiaId === 'nova' ? [] : data.notas.filter((n) => n.materiaId === l.materiaId && n.etapaId === l.etapaId);
    let ex = null;
    if (tipo === 'oficial') ex = existentes.find((n) => tipoDe(n) === 'oficial');
    else if (tipo === 'bonus') ex = existentes.find((n) => tipoDe(n) === 'bonus' && norm(n.nome) === norm(l.nome));
    else {
      const alvo = norm(l.nome);
      ex = existentes.find((n) => tipoDe(n) === 'avaliacao' && (norm(n.nome) === alvo || norm(n.sigla) === alvo || (l.siglaDada && norm(n.sigla) === norm(l.siglaDada))));
    }
    if (ex) {
      l.notaId = ex.id;
      l.sigla = ex.sigla;
      l.antes = ex.valor;
      const igual = (ex.valor === null && l.valor === null) || (ex.valor !== null && l.valor !== null && Math.abs(ex.valor - l.valor) < 1e-9);
      if (igual && (tipo !== 'avaliacao' || (ex.vale || null) === (l.vale || null))) {
        l.status = 'igual';
        l.sel = false;
      } else l.status = 'atualiza';
      return l;
    }

    if (!siglas.has(grupo)) siglas.set(grupo, new Set(existentes.map((n) => n.sigla.toUpperCase())));
    const usadas = siglas.get(grupo);
    if (tipo !== 'oficial') {
      const dada = l.siglaDada && SIGLA_RE.test(l.siglaDada) && !RESERVADAS.has(norm(l.siglaDada)) && !usadas.has(l.siglaDada.toUpperCase()) ? l.siglaDada.toUpperCase() : null;
      let s = dada || suggestSigla(l.nome, [...usadas]);
      if (RESERVADAS.has(s) || (l.etapaId === FINAL && periodo.etapas.some((e) => e.codigo === s))) s = suggestSigla(`${s} X`, [...usadas]);
      l.sigla = s;
      usadas.add(s.toUpperCase());
    }
    return l;
  });

  const conta = (st) => linhas.filter((l) => l.status === st).length;
  return {
    linhas,
    materias: [...lidas.values()],
    partesDesconhecidas: [...partes.values()],
    resumo: { novas: conta('nova'), atualiza: conta('atualiza'), iguais: conta('igual'), repetidas: conta('repetida'), erros: conta('erro'), ignoradas: conta('ignorada') },
  };
}

// marcadas = Set de i
export function aplicarNotas(d, analise, periodoId, marcadas) {
  const criadas = new Map();
  let novas = 0;
  let atualizadas = 0;
  for (const l of analise.linhas) {
    if (!marcadas.has(l.i) || (l.status !== 'nova' && l.status !== 'atualiza')) continue;
    let mid = l.materiaId;
    if (mid === 'nova') {
      if (!criadas.has(l.materiaChave)) {
        const m = makeMateria(periodoId, l.materiaNome, nextColor(materiasDo(d, periodoId)));
        d.materias.push(m);
        criadas.set(l.materiaChave, m.id);
      }
      mid = criadas.get(l.materiaChave);
    }
    if (l.notaId) {
      const n = d.notas.find((x) => x.id === l.notaId);
      if (n) {
        n.valor = l.valor;
        if (l.tipo === 'avaliacao' && l.vale) n.vale = l.vale;
        atualizadas++;
        continue;
      }
    }
    d.notas.push({
      id: uid(), tipo: l.tipo, materiaId: mid, etapaId: l.etapaId, nome: l.nome, sigla: l.sigla,
      valor: l.valor, vale: l.tipo === 'avaliacao' ? l.vale || null : null, peso: l.peso || 1, data: l.data || '', criadoEm: new Date().toISOString(),
    });
    novas++;
  }
  return { novas, atualizadas, materiasNovas: criadas.size };
}

// ===== horario =====
export function analisarHorario(obj, data, periodo, mapas = {}) {
  const { aulas, notas, medias } = listas(obj);
  if (!aulas.length) throw new ImportError(notas.length || medias.length ? 'Isso parece um boletim de notas. Para importar, use a opção Notas.' : 'Não achei nenhuma aula nessa resposta.');
  const materias = materiasDo(data, periodo.id);
  const brutas = aulas.slice(0, 400);
  const lidas = resolverMaterias(brutas.map((o) => texto(campo(o, C_MATERIA), 50)), materias, mapas.materias);

  const linhas = brutas.map((o, i) => {
    const materiaNome = texto(campo(o, C_MATERIA), 50);
    const l = { i, materiaNome, materiaChave: norm(materiaNome), status: 'nova', erro: null, sel: true };
    const mat = lidas.get(l.materiaChave);
    l.materiaId = mat ? mat.destino : null;
    l.diaTexto = texto(campo(o, ['DIA', 'DIA_DA_SEMANA', 'DIA_SEMANA', 'WEEKDAY']), 20);
    l.dia = lerDia(campo(o, ['DIA', 'DIA_DA_SEMANA', 'DIA_SEMANA', 'WEEKDAY']));
    let ini = campo(o, ['INICIO', 'HORA_INICIO', 'COMECO', 'START', 'DE']);
    let fim = campo(o, ['FIM', 'HORA_FIM', 'TERMINO', 'END', 'ATE']);
    const faixa = texto(campo(o, ['HORARIO', 'HORA']), 30);
    if (ini === undefined && faixa) {
      const [a, b] = faixa.split(/\s*(?:-|–|—|às|as|a|até)\s*/i);
      ini = a;
      if (fim === undefined) fim = b;
    }
    l.inicio = lerHora(ini);
    l.fim = lerHora(fim);
    l.sala = texto(campo(o, ['SALA', 'LOCAL', 'ROOM']), 20);
    l.professor = texto(campo(o, ['PROFESSOR', 'PROFESSORA', 'PROF', 'DOCENTE', 'TEACHER']), 60);
    return l;
  });

  // sem fim: ate a prox aula ou 50min
  for (const l of linhas) {
    if (l.inicio && !l.fim && l.dia !== null) {
      const depois = linhas.filter((x) => x.dia === l.dia && x.inicio && minutos(x.inicio) > minutos(l.inicio)).map((x) => minutos(x.inicio));
      l.fim = hhmm(Math.min(23 * 60 + 59, depois.length ? Math.min(...depois) : minutos(l.inicio) + 50));
      l.fimEstimado = true;
    }
  }

  const vistas = new Set();
  for (const l of linhas) {
    const falha = (msg) => {
      l.status = 'erro';
      l.erro = msg;
      l.sel = false;
    };
    if (!l.materiaNome) falha('Sem o nome da matéria.');
    else if (l.dia === null) falha(l.diaTexto ? `Não reconheci o dia "${l.diaTexto}".` : 'Sem o dia da semana.');
    else if (!l.inicio) falha('Sem o horário de início.');
    else if (minutos(l.fim) <= minutos(l.inicio)) falha('A aula termina antes de começar.');
    else if (l.materiaId === 'ignorar') {
      l.status = 'ignorada';
      l.sel = false;
    } else {
      const k = `${l.dia}|${l.inicio}|${l.materiaChave}`;
      if (vistas.has(k)) {
        l.status = 'repetida';
        l.sel = false;
      }
      vistas.add(k);
    }
  }
  const conta = (st) => linhas.filter((l) => l.status === st).length;
  return { linhas, materias: [...lidas.values()], resumo: { novas: conta('nova'), repetidas: conta('repetida'), erros: conta('erro'), ignoradas: conta('ignorada') } };
}

export function aplicarHorario(d, analise, periodoId, marcadas, { substituir = false } = {}) {
  const antes = d.aulas.filter((a) => a.periodoId === periodoId).length;
  if (substituir) d.aulas = d.aulas.filter((a) => a.periodoId !== periodoId);
  const criadas = new Map();
  let aulas = 0;
  for (const l of analise.linhas) {
    if (!marcadas.has(l.i) || l.status !== 'nova') continue;
    let mid = l.materiaId;
    if (mid === 'nova') {
      if (!criadas.has(l.materiaChave)) {
        const m = makeMateria(periodoId, l.materiaNome, nextColor(materiasDo(d, periodoId)));
        d.materias.push(m);
        criadas.set(l.materiaChave, m.id);
      }
      mid = criadas.get(l.materiaChave);
    }
    const mat = d.materias.find((m) => m.id === mid);
    if (!mat) continue;
    if (l.professor && !mat.professor) mat.professor = l.professor;
    if (!substituir && d.aulas.some((a) => a.periodoId === periodoId && a.materiaId === mid && a.dia === l.dia && a.inicio === l.inicio)) continue;
    d.aulas.push({ id: uid(), periodoId, materiaId: mid, dia: l.dia, inicio: l.inicio, fim: l.fim, sala: l.sala || '' });
    aulas++;
  }
  return { aulas, removidas: substituir ? antes : 0, materiasNovas: criadas.size };
}
