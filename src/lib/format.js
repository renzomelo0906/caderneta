export function fmtNota(v, casas = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

// "7,5" / "7.5" -> 7.5 | vazio = null | invalido = NaN
export function parseNum(text) {
  const s = String(text ?? '').trim().replace(/\s/g, '');
  if (!s) return null;
  if (!/^[-+]?\d*([.,]\d+)?$/.test(s) || /^[-+]?$/.test(s)) return NaN;
  return parseFloat(s.replace(',', '.'));
}

const p2 = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const fromISO = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const hojeISO = () => toISO(new Date());
export const addDays = (iso, n) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);

export const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const fmtData = (iso) => {
  if (!iso) return '';
  const d = fromISO(iso);
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
};
export const fmtDataCurta = (iso) => {
  if (!iso) return '';
  const d = fromISO(iso);
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`;
};
export const fmtDataLonga = (iso) => {
  const d = fromISO(iso);
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
};

// hoje, amanhã, quinta-feira, 12/11
export function quando(iso, hoje = hojeISO()) {
  const n = diffDays(hoje, iso);
  if (n === 0) return 'Hoje';
  if (n === 1) return 'Amanhã';
  if (n === -1) return 'Ontem';
  if (n > 1 && n < 7) return DIAS[fromISO(iso).getDay()].replace(/^./, (c) => c.toUpperCase());
  return fmtDataCurta(iso);
}

export const minutos = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
};
export const hhmm = (min) => `${p2(Math.floor(min / 60) % 24)}:${p2(min % 60)}`;

export function fmtDuracao(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const fmtDataHora = (isoDateTime) => {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return '';
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} às ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

export function saudacao(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
