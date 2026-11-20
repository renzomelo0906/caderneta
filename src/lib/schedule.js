import { minutos, fromISO, toISO } from './format.js';

export const aulasDo = (data, periodoId) => data.aulas.filter((a) => a.periodoId === periodoId);

export const ordenarAulas = (aulas) =>
  [...aulas].sort((a, b) => a.dia - b.dia || minutos(a.inicio) - minutos(b.inicio));

export const aulasDoDia = (aulas, dia) => ordenarAulas(aulas.filter((a) => a.dia === dia));

export function contagemPorDia(aulas) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const a of aulas) c[a.dia]++;
  return c;
}

// seg -> sex (da a volta se precisar)
export function contagemIntervalo(aulas, de, ate) {
  const c = contagemPorDia(aulas);
  let total = 0;
  let d = de;
  for (let i = 0; i < 7; i++) {
    total += c[d];
    if (d === ate) break;
    d = (d + 1) % 7;
  }
  return total;
}

export function porMateria(aulas) {
  const m = new Map();
  for (const a of aulas) {
    const cur = m.get(a.materiaId) || { aulas: 0, minutos: 0 };
    cur.aulas++;
    cur.minutos += Math.max(0, (minutos(a.fim) ?? 0) - (minutos(a.inicio) ?? 0));
    m.set(a.materiaId, cur);
  }
  return m;
}

export function conflitos(aulas, nova) {
  const ini = minutos(nova.inicio);
  const fim = minutos(nova.fim);
  if (ini === null || fim === null) return [];
  return aulas.filter((a) => a.id !== nova.id && a.dia === nova.dia && minutos(a.inicio) < fim && ini < minutos(a.fim));
}

export function agoraEProxima(aulas, now = new Date()) {
  const dia = now.getDay();
  const m = now.getHours() * 60 + now.getMinutes();
  const hoje = aulasDoDia(aulas, dia);
  const agora = hoje.find((a) => minutos(a.inicio) <= m && m < minutos(a.fim)) || null;
  const proxima = hoje.find((a) => minutos(a.inicio) > m) || null;
  return { agora, proxima, hoje, minutoAtual: m };
}

export function diasSemAula(data) {
  const set = new Set();
  for (const e of data.eventos) {
    if (e.tipo !== 'feriado') continue;
    const fim = e.fim && e.fim >= e.data ? e.fim : e.data;
    let d = fromISO(e.data);
    for (let i = 0; i < 400 && toISO(d) <= fim; i++) {
      set.add(toISO(d));
      d.setDate(d.getDate() + 1);
    }
  }
  return set;
}

// total de aulas: o digitado ou aulas/semana * semanas - feriados
export function totalAulas(data, periodo, materia) {
  if (materia.totalAulas > 0) return { total: materia.totalAulas, estimado: false };
  if (!periodo.inicio || !periodo.fim || periodo.fim < periodo.inicio) return { total: null, estimado: true };
  const minhas = data.aulas.filter((a) => a.materiaId === materia.id);
  if (!minhas.length) return { total: null, estimado: true };
  const porDia = contagemPorDia(minhas);
  const folgas = diasSemAula(data);
  let total = 0;
  const d = fromISO(periodo.inicio);
  const fim = periodo.fim;
  for (let i = 0; i < 800 && toISO(d) <= fim; i++) {
    if (!folgas.has(toISO(d))) total += porDia[d.getDay()];
    d.setDate(d.getDate() + 1);
  }
  return { total, estimado: true };
}

export function frequencia(data, periodo, materia) {
  const faltas = data.faltas.filter((f) => f.materiaId === materia.id).reduce((s, f) => s + (f.quantidade || 1), 0);
  const { total, estimado } = totalAulas(data, periodo, materia);
  if (!total) return { faltas, total: null, estimado, percentual: null, podeFaltar: null, limite: null };
  const limite = Math.floor(total * (1 - periodo.frequenciaMinima / 100) + 1e-9);
  return {
    faltas,
    total,
    estimado,
    limite,
    percentual: Math.max(0, ((total - faltas) / total) * 100),
    podeFaltar: limite - faltas,
  };
}
