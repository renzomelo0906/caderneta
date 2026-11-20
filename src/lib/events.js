import { fromISO, toISO, addDays, diffDays, minutos, hhmm } from './format.js';
import { TIPOS_EVENTO } from './model.js';
import { aulasDoDia } from './schedule.js';

const HORA_DIA_INTEIRO = 8 * 60; // sem hora = 8h

function addMonthsClamp(iso, n, diaOriginal) {
  const d = fromISO(iso);
  const alvo = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const ultimo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(diaOriginal, ultimo));
  return toISO(alvo);
}

// datas das ocorrencias entre de e ate (inclusive)
export function ocorrencias(evento, de, ate) {
  const dur = evento.fim && evento.fim > evento.data ? diffDays(evento.data, evento.fim) : 0;
  const limite = evento.repetir && evento.repetir !== 'nao' && evento.ate ? evento.ate : null;
  const out = [];
  if (!evento.repetir || evento.repetir === 'nao') {
    if (addDays(evento.data, dur) >= de && evento.data <= ate) out.push(evento.data);
    return out;
  }
  const diaOriginal = fromISO(evento.data).getDate();
  let d = evento.data;
  for (let i = 0; i < 1000; i++) {
    if (d > ate || (limite && d > limite)) break;
    if (addDays(d, dur) >= de) out.push(d);
    d = evento.repetir === 'semanal' ? addDays(evento.data, 7 * (i + 1)) : addMonthsClamp(evento.data, i + 1, diaOriginal);
  }
  return out;
}

export function eventosDoDia(eventos, iso) {
  const out = [];
  for (const e of eventos) {
    for (const ini of ocorrencias(e, iso, iso)) out.push({ ...e, ocorrencia: ini, chave: `${e.id}:${ini}` });
  }
  return out.sort((a, b) => (a.hora || '').localeCompare(b.hora || '') || a.titulo.localeCompare(b.titulo));
}

export function eventosNoIntervalo(eventos, de, ate) {
  const map = new Map();
  for (const e of eventos) {
    const dur = e.fim && e.fim > e.data ? diffDays(e.data, e.fim) : 0;
    for (const ini of ocorrencias(e, de, ate)) {
      for (let k = 0; k <= dur; k++) {
        const dia = addDays(ini, k);
        if (dia < de || dia > ate) continue;
        if (!map.has(dia)) map.set(dia, []);
        map.get(dia).push({ ...e, ocorrencia: ini, chave: `${e.id}:${ini}`, continuacao: k > 0 });
      }
    }
  }
  for (const list of map.values()) list.sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99') || a.titulo.localeCompare(b.titulo));
  return map;
}

// repetido: feito por ocorrência
export const estaFeito = (e, ocorrencia) => (e.repetir && e.repetir !== 'nao' ? (e.feitos || []).includes(ocorrencia) : Boolean(e.feito));

export function proximos(eventos, hoje, dias = 14) {
  const out = [];
  const fim = addDays(hoje, dias);
  for (const e of eventos) {
    for (const ini of ocorrencias(e, hoje, fim)) {
      if (ini < hoje && !(e.fim && e.fim >= hoje)) continue;
      out.push({ ...e, ocorrencia: ini, chave: `${e.id}:${ini}` });
    }
  }
  return out.sort((a, b) => a.ocorrencia.localeCompare(b.ocorrencia) || (a.hora || '99').localeCompare(b.hora || '99'));
}

const dataHoraMs = (iso, min) => {
  const d = fromISO(iso);
  d.setHours(0, min, 0, 0);
  return d.getTime();
};

// avisos p/ o main -> {id, at, title, body}
export function agendaDeAvisos(data, now = new Date(), horizonteDias = 8) {
  const s = data.settings;
  if (!s.avisos) return [];
  const out = [];
  const hoje = toISO(now);
  const fim = addDays(hoje, horizonteDias);
  const nowMs = now.getTime();
  const materia = (id) => data.materias.find((m) => m.id === id);

  for (const e of data.eventos) {
    if (e.aviso === null || e.aviso === undefined) continue;
    for (const ini of ocorrencias(e, addDays(hoje, -1), addDays(fim, Math.ceil(e.aviso / 1440)))) {
      if (estaFeito(e, ini)) continue;
      const min = minutos(e.hora) ?? HORA_DIA_INTEIRO;
      const at = dataHoraMs(ini, min) - e.aviso * 60000;
      if (at < nowMs - 60000 || at > dataHoraMs(fim, 24 * 60)) continue;
      const tipo = (TIPOS_EVENTO[e.tipo] || TIPOS_EVENTO.lembrete).nome;
      const m = materia(e.materiaId);
      const quandoTxt = e.aviso === 0 ? 'agora' : textoAntes(e.aviso);
      out.push({
        id: `ev:${e.id}:${ini}:${e.aviso}`,
        at,
        title: s.avisoDetalhes ? `${tipo}: ${e.titulo}` : 'Caderneta',
        body: s.avisoDetalhes
          ? [m ? m.nome : '', e.hora ? `${quandoTxt === 'agora' ? 'Agora' : 'Começa ' + quandoTxt}, às ${e.hora}` : quandoTxt === 'agora' ? 'É hoje' : `É ${quandoTxt}`].filter(Boolean).join('. ')
          : 'Você tem um lembrete. Abra a Caderneta para ver.',
      });
    }
  }

  if (s.avisoAulas) {
    const periodo = data.periodos.find((p) => p.id === s.periodoAtualId);
    const aulas = periodo ? data.aulas.filter((a) => a.periodoId === periodo.id) : [];
    for (let k = 0; k < 2; k++) {
      const iso = addDays(hoje, k);
      for (const a of aulasDoDia(aulas, fromISO(iso).getDay())) {
        const ini = minutos(a.inicio);
        if (ini === null) continue;
        const at = dataHoraMs(iso, ini) - (s.avisoAulasMin || 0) * 60000;
        if (at < nowMs - 60000) continue;
        const m = materia(a.materiaId);
        out.push({
          id: `aula:${a.id}:${iso}`,
          at,
          title: s.avisoDetalhes ? `Próxima aula: ${m ? m.nome : 'Aula'}` : 'Caderneta',
          body: s.avisoDetalhes ? `Às ${a.inicio}${a.sala ? `, sala ${a.sala}` : ''}` : 'Sua próxima aula começa em breve.',
        });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 200);
}

function textoAntes(min) {
  if (min < 60) return `em ${min} minutos`;
  if (min < 1440) return min === 60 ? 'em 1 hora' : `em ${Math.round(min / 60)} horas`;
  const d = Math.round(min / 1440);
  if (d === 1) return 'amanhã';
  if (d === 7) return 'daqui a 1 semana';
  return `daqui a ${d} dias`;
}

export { hhmm };
