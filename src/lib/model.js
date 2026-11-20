export const SCHEMA_VERSION = 1;

export const uid = () => {
  const b = new Uint8Array(9);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 14);
};

export const TIPOS_ETAPA = {
  bimestre: { nome: 'Bimestre', plural: 'bimestres', letra: 'B', padrao: 4 },
  trimestre: { nome: 'Trimestre', plural: 'trimestres', letra: 'T', padrao: 3 },
  semestre: { nome: 'Semestre', plural: 'semestres', letra: 'S', padrao: 2 },
  etapa: { nome: 'Etapa', plural: 'etapas', letra: 'E', padrao: 3 },
  unidade: { nome: 'Unidade', plural: 'unidades', letra: 'U', padrao: 4 },
  modulo: { nome: 'Módulo', plural: 'módulos', letra: 'M', padrao: 4 },
};
export const MAX_ETAPAS = 24;

export const etapaCodigo = (tipo, i) => `${(TIPOS_ETAPA[tipo] || TIPOS_ETAPA.etapa).letra}${i + 1}`;
export const etapaNome = (tipo, i) => `${i + 1}º ${(TIPOS_ETAPA[tipo] || TIPOS_ETAPA.etapa).nome.toLowerCase()}`;

export const CORES = [
  { id: 'azul', claro: '#2a78d6', escuro: '#5b9cf0' },
  { id: 'laranja', claro: '#eb6834', escuro: '#ef8457' },
  { id: 'agua', claro: '#1baf7a', escuro: '#33c08d' },
  { id: 'amarelo', claro: '#e09800', escuro: '#e3ad2b' },
  { id: 'rosa', claro: '#e0699a', escuro: '#e57ea8' },
  { id: 'verde', claro: '#2f8a2f', escuro: '#5db35d' },
  { id: 'violeta', claro: '#6250d6', escuro: '#9085e9' },
  { id: 'vermelho', claro: '#e34948', escuro: '#ec6d6c' },
  { id: 'marrom', claro: '#9a6a3a', escuro: '#c49565' },
  { id: 'cinza', claro: '#66707f', escuro: '#9aa4b2' },
];
export const corDe = (id, escuro) => {
  const c = CORES.find((x) => x.id === id) || CORES[0];
  return escuro ? c.escuro : c.claro;
};

export const MATERIAS_SUGERIDAS = [
  'Matemática', 'Português', 'Redação', 'Literatura', 'História', 'Geografia', 'Física', 'Química',
  'Biologia', 'Inglês', 'Espanhol', 'Filosofia', 'Sociologia', 'Artes', 'Educação Física', 'Ciências',
];

export const TIPOS_NOTA = {
  avaliacao: { nome: 'Avaliação' },
  bonus: { nome: 'Bônus' },
  oficial: { nome: 'Média da escola' },
};

export const TIPOS_EVENTO = {
  prova: { nome: 'Prova' },
  trabalho: { nome: 'Trabalho' },
  tarefa: { nome: 'Tarefa' },
  lembrete: { nome: 'Lembrete' },
  evento: { nome: 'Evento' },
  feriado: { nome: 'Feriado ou sem aula' },
};

export const AVISOS = [
  { min: null, nome: 'Sem aviso' },
  { min: 0, nome: 'Na hora' },
  { min: 10, nome: '10 minutos antes' },
  { min: 30, nome: '30 minutos antes' },
  { min: 60, nome: '1 hora antes' },
  { min: 180, nome: '3 horas antes' },
  { min: 1440, nome: '1 dia antes' },
  { min: 2880, nome: '2 dias antes' },
  { min: 10080, nome: '1 semana antes' },
];

export const DEFAULT_SETTINGS = {
  theme: 'auto', // auto | caderno | lousa
  casas: 1,
  autoLockMin: 10, // 0 = nunca
  avisos: true,
  avisoDetalhes: true,
  avisoAulas: false,
  avisoAulasMin: 5,
  protegerCaptura: false,
  segundoPlano: true,
  dicaPin: true,
  periodoAtualId: null,
};

export function emptyData(nome = '') {
  return {
    version: SCHEMA_VERSION,
    profile: { nome, escola: '' },
    settings: { ...DEFAULT_SETTINGS },
    onboarded: false,
    periodos: [],
    materias: [],
    notas: [],
    aulas: [],
    eventos: [],
    faltas: [],
  };
}

export function makeEtapas(tipo, quantidade, anteriores = []) {
  const n = Math.max(1, Math.min(MAX_ETAPAS, Math.round(quantidade) || 1));
  return Array.from({ length: n }, (_, i) => {
    const old = anteriores[i];
    const nomeAntigoEraPadrao = old && Object.keys(TIPOS_ETAPA).some((t) => old.nome === etapaNome(t, i));
    return {
      id: old ? old.id : uid(),
      nome: old && !nomeAntigoEraPadrao ? old.nome : etapaNome(tipo, i),
      codigo: etapaCodigo(tipo, i),
      formula: old ? old.formula : 'MEDIA',
      inicio: old ? old.inicio : '',
      fim: old ? old.fim : '',
    };
  });
}

export function makePeriodo({ nome, tipo = 'trimestre', quantidade, notaMaxima = 10, mediaMinima = 6, frequenciaMinima = 75, inicio = '', fim = '' } = {}) {
  const t = TIPOS_ETAPA[tipo] ? tipo : 'trimestre';
  return {
    id: uid(),
    nome: nome || String(new Date().getFullYear()),
    tipo: t,
    etapas: makeEtapas(t, quantidade ?? TIPOS_ETAPA[t].padrao),
    formulaFinal: 'MEDIA',
    notaMaxima,
    mediaMinima,
    frequenciaMinima,
    inicio,
    fim,
    concluido: false,
    criadoEm: new Date().toISOString(),
  };
}

export function makeMateria(periodoId, nome, cor) {
  return { id: uid(), periodoId, nome, cor: cor || CORES[0].id, professor: '', sala: '', formulaEtapa: '', formulasEtapa: {}, formulaFinal: '', totalAulas: null, foraDaMedia: false };
}

export function nextColor(materias) {
  const used = materias.map((m) => m.cor);
  for (const c of CORES) if (!used.includes(c.id)) return c.id;
  return CORES[materias.length % CORES.length].id;
}

// "Prova 1" -> P1, "Trabalho" -> TRAB
const STOP = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM', 'NA', 'NO', 'A', 'O']);
// [prefixo, sigla, numera?]
const SIGLAS_CONHECIDAS = [
  ['PROVA', 'P', true], ['TESTE', 'TESTE', true], ['ATIVIDADE', 'ATIV', true], ['LISTA', 'LISTA', true],
  ['RECUP', 'REC', false], ['TRABALHO', 'TRAB', false], ['SIMULADO', 'SIM', false], ['SEMINARIO', 'SEM', false],
  ['PARTICIPA', 'PART', false], ['EXAME', 'EXAME', false], ['PROJETO', 'PROJ', false],
];
export function suggestSigla(nome, existentes = []) {
  const clean = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').trim();
  const words = clean.split(/\s+/).filter((w) => w && !STOP.has(w));
  let base;
  let numerar = false;
  if (!words.length) {
    base = 'N';
    numerar = true;
  } else if (words.length === 1 && !/\d/.test(words[0])) {
    const w = words[0];
    const conhecida = SIGLAS_CONHECIDAS.find(([prefixo]) => w.startsWith(prefixo));
    if (conhecida) [, base, numerar] = conhecida;
    else base = w.slice(0, 4);
  } else base = words.map((w) => (/^\d+$/.test(w) ? w : w[0])).join('');
  if (/^\d/.test(base)) base = 'N' + base;
  const taken = new Set(existentes.map((s) => String(s).toUpperCase()));
  if (numerar || taken.has(base)) {
    for (let i = 1; i < 1000; i++) {
      const cand = /\d$/.test(base) ? `${base}_${i}` : `${base}${i}`;
      if (!taken.has(cand)) return cand;
    }
  }
  return base;
}

export const SIGLA_RE = /^[A-Za-z_][A-Za-z0-9_]{0,11}$/;

// conserta dados velhos/quebrados
const arr = (x) => (Array.isArray(x) ? x : []);
const str = (x, d = '') => (typeof x === 'string' ? x : d);
const num = (x, d = null) => (typeof x === 'number' && Number.isFinite(x) ? x : d);

export function normalize(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const base = emptyData(str(d.profile && d.profile.nome));
  const out = {
    ...base,
    version: SCHEMA_VERSION,
    profile: { ...base.profile, ...(d.profile || {}) },
    settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) },
    onboarded: Boolean(d.onboarded),
    periodos: arr(d.periodos).filter((p) => p && p.id).map((p) => {
      const tipo = TIPOS_ETAPA[p.tipo] ? p.tipo : 'etapa';
      const etapas = arr(p.etapas).slice(0, MAX_ETAPAS).map((e, i) => ({
        id: str(e.id) || uid(),
        nome: str(e.nome) || etapaNome(tipo, i),
        codigo: etapaCodigo(tipo, i),
        formula: str(e.formula, 'MEDIA'),
        inicio: str(e.inicio),
        fim: str(e.fim),
      }));
      return {
        ...p,
        nome: str(p.nome) || 'Período',
        tipo,
        etapas: etapas.length ? etapas : makeEtapas(tipo, 1),
        formulaFinal: str(p.formulaFinal, 'MEDIA'),
        notaMaxima: num(p.notaMaxima, 10) > 0 ? num(p.notaMaxima, 10) : 10,
        mediaMinima: num(p.mediaMinima, 6),
        frequenciaMinima: num(p.frequenciaMinima, 75),
        inicio: str(p.inicio),
        fim: str(p.fim),
        concluido: Boolean(p.concluido),
      };
    }),
    materias: arr(d.materias).filter((m) => m && m.id && m.periodoId).map((m) => ({
      ...m,
      nome: str(m.nome) || 'Matéria',
      cor: CORES.some((c) => c.id === m.cor) ? m.cor : CORES[0].id,
      professor: str(m.professor),
      sala: str(m.sala),
      formulaEtapa: str(m.formulaEtapa),
      formulasEtapa: m.formulasEtapa && typeof m.formulasEtapa === 'object' && !Array.isArray(m.formulasEtapa)
        ? Object.fromEntries(Object.entries(m.formulasEtapa).filter(([, v]) => typeof v === 'string' && v.trim()))
        : {},
      formulaFinal: str(m.formulaFinal),
      totalAulas: num(m.totalAulas),
      foraDaMedia: Boolean(m.foraDaMedia),
    })),
    notas: arr(d.notas).filter((n) => n && n.id && n.materiaId && n.etapaId).map((n) => ({
      ...n,
      tipo: TIPOS_NOTA[n.tipo] ? n.tipo : 'avaliacao',
      nome: str(n.nome),
      sigla: str(n.sigla) || 'N',
      valor: num(n.valor),
      vale: num(n.vale),
      peso: num(n.peso, 1) > 0 ? num(n.peso, 1) : 1,
      data: str(n.data),
    })),
    aulas: arr(d.aulas).filter((a) => a && a.id && a.materiaId && Number.isInteger(a.dia)),
    eventos: arr(d.eventos).filter((e) => e && e.id && /^\d{4}-\d{2}-\d{2}$/.test(e.data || '')),
    faltas: arr(d.faltas).filter((f) => f && f.id && f.materiaId),
  };
  if (!out.periodos.some((p) => p.id === out.settings.periodoAtualId)) {
    out.settings.periodoAtualId = out.periodos.length ? out.periodos[out.periodos.length - 1].id : null;
  }
  return out;
}

export const periodoAtual = (data) => data.periodos.find((p) => p.id === data.settings.periodoAtualId) || data.periodos[data.periodos.length - 1] || null;
export const materiasDo = (data, periodoId) => data.materias.filter((m) => m.periodoId === periodoId);
