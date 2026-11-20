import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Check, Bell, Repeat, CalendarDays } from 'lucide-react';
import { TIPOS_EVENTO, AVISOS, corDe } from '../lib/model.js';
import { eventosNoIntervalo, eventosDoDia, proximos, estaFeito } from '../lib/events.js';
import { aulasDoDia } from '../lib/schedule.js';
import { toISO, fromISO, hojeISO, addDays, MESES, DIAS_CURTO, fmtDataLonga, quando, fmtDataCurta } from '../lib/format.js';
import { COR_TIPO } from './EventoModal.jsx';

export default function Calendario({ ctx }) {
  const { data, abrir } = ctx;
  const hoje = hojeISO();
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(hoje);

  const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const inicioGrade = addDays(toISO(primeiro), -primeiro.getDay());
  const semanas = Math.ceil((primeiro.getDay() + new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()) / 7);
  const dias = Array.from({ length: semanas * 7 }, (_, i) => addDays(inicioGrade, i));
  const mapa = eventosNoIntervalo(data.eventos, dias[0], dias[dias.length - 1]);

  const mudarMes = (n) => setMes((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const irHoje = () => {
    const d = new Date();
    setMes(new Date(d.getFullYear(), d.getMonth(), 1));
    setSel(hoje);
  };
  const escolher = (iso) => {
    setSel(iso);
    const d = fromISO(iso);
    if (d.getMonth() !== mes.getMonth()) setMes(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="hand">Calendário</h1>
          <div className="sub">Provas, trabalhos, lembretes e feriados. Os avisos saem no canto da tela.</div>
        </div>
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => abrir('evento', { data: sel })}><Plus /> Adicionar</button>
        </div>
      </div>
      <div className="cal-layout">
        <div className="sheet" style={{ overflow: 'hidden' }}>
          <div className="sheet-head">
            <div className="cal-nav">
              <button type="button" className="btn ghost icon small" onClick={() => mudarMes(-1)} aria-label="Mês anterior" title="Mês anterior"><ChevronLeft /></button>
              <span className="mes hand" aria-live="polite">{MESES[mes.getMonth()].replace(/^./, (c) => c.toUpperCase())} de {mes.getFullYear()}</span>
              <button type="button" className="btn ghost icon small" onClick={() => mudarMes(1)} aria-label="Próximo mês" title="Próximo mês"><ChevronRight /></button>
            </div>
            <span className="spacer" />
            <button type="button" className="btn small" onClick={irHoje}>Hoje</button>
          </div>
          <div className="month" role="grid" aria-label="Dias do mês">
            {DIAS_CURTO.map((d) => <div key={d} className="dow" role="columnheader">{d}</div>)}
            {dias.map((iso) => {
              const evs = mapa.get(iso) || [];
              const fora = fromISO(iso).getMonth() !== mes.getMonth();
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  className={`day ${fora ? 'out' : ''} ${iso === hoje ? 'today' : ''} ${iso === sel ? 'sel' : ''}`}
                  onClick={() => escolher(iso)}
                  onDoubleClick={() => abrir('evento', { data: iso })}
                  aria-label={`${fmtDataLonga(iso)}${evs.length ? `, ${evs.length} ${evs.length === 1 ? 'evento' : 'eventos'}` : ''}`}
                  aria-selected={iso === sel}
                >
                  <span className="n">{fromISO(iso).getDate()}</span>
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.chave + iso} className={`pill ${estaFeito(e, e.ocorrencia) ? 'done' : ''}`} style={{ '--c': COR_TIPO[e.tipo] || COR_TIPO.lembrete }} title={`${TIPOS_EVENTO[e.tipo]?.nome}: ${e.titulo}`}>
                      <span>{e.titulo}</span>
                    </span>
                  ))}
                  {evs.length > 3 && <span className="more">mais {evs.length - 3}</span>}
                </button>
              );
            })}
          </div>
          <div className="inline small muted" style={{ padding: '10px 16px', borderTop: '1px solid var(--rule)', flexWrap: 'wrap', gap: 14 }}>
            {Object.entries(TIPOS_EVENTO).map(([k, t]) => (
              <span key={k} className="inline" style={{ gap: 6 }}><span className="dot" style={{ background: COR_TIPO[k], width: 8, height: 8 }} />{t.nome}</span>
            ))}
          </div>
        </div>

        <div className="stack">
          <Dia ctx={ctx} iso={sel} />
          <Proximos ctx={ctx} onPick={escolher} />
        </div>
      </div>
    </>
  );
}

export function marcarFeito(update, e) {
  update((d) => {
    const ev = d.eventos.find((x) => x.id === e.id);
    if (!ev) return;
    if (ev.repetir && ev.repetir !== 'nao') {
      const set = new Set(ev.feitos || []);
      if (set.has(e.ocorrencia)) set.delete(e.ocorrencia);
      else set.add(e.ocorrencia);
      ev.feitos = [...set];
    } else ev.feito = !ev.feito;
  });
}

export function EventoLinha({ ctx, e, mostrarData }) {
  const { data, update, abrir } = ctx;
  const m = e.materiaId ? data.materias.find((x) => x.id === e.materiaId) : null;
  const feito = estaFeito(e, e.ocorrencia);
  const aviso = AVISOS.find((a) => a.min === e.aviso);
  const detalhes = [
    mostrarData ? quando(e.ocorrencia) : null,
    e.hora || (e.fim ? `até ${fmtDataCurta(e.fim)}` : 'Dia todo'),
    m ? m.nome : null,
  ].filter(Boolean).join(', ');
  return (
    <div className={`ev-item ${feito ? 'done' : ''}`}>
      {e.tipo !== 'feriado' && e.tipo !== 'evento' ? (
        <button type="button" className="tick" role="checkbox" aria-checked={feito} aria-label={`${feito ? 'Desmarcar' : 'Marcar'} ${e.titulo} como feito`} onClick={() => marcarFeito(update, e)}>
          {feito && <Check />}
        </button>
      ) : (
        <span className="bar-v" style={{ background: COR_TIPO[e.tipo] }} />
      )}
      <button type="button" className="grow" style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }} onClick={() => abrir('evento', { eventoId: e.id })}>
        <div className="inline" style={{ gap: 8 }}>
          <span className="t1" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.titulo}</span>
          <span className="tipo-tag" style={{ color: COR_TIPO[e.tipo] }}>{TIPOS_EVENTO[e.tipo]?.nome}</span>
        </div>
        <div className="t2 inline" style={{ gap: 8 }}>
          <span>{detalhes}</span>
          {e.aviso !== null && e.aviso !== undefined && <span className="inline" style={{ gap: 3 }} title={`Aviso: ${aviso ? aviso.nome.toLowerCase() : ''}`}><Bell size={12} /> {aviso ? aviso.nome.toLowerCase() : ''}</span>}
          {e.repetir && e.repetir !== 'nao' && <span className="inline" style={{ gap: 3 }}><Repeat size={12} /> {e.repetir === 'semanal' ? 'toda semana' : 'todo mês'}</span>}
        </div>
        {e.obs && <div className="t2" style={{ whiteSpace: 'pre-wrap' }}>{e.obs}</div>}
      </button>
    </div>
  );
}

function Dia({ ctx, iso }) {
  const { data, periodo, abrir, escuro } = ctx;
  const evs = eventosDoDia(data.eventos, iso); // inclui os de varios dias
  const aulas = periodo ? aulasDoDia(data.aulas.filter((a) => a.periodoId === periodo.id), fromISO(iso).getDay()) : [];
  const feriado = evs.some((e) => e.tipo === 'feriado');
  const mat = (id) => data.materias.find((m) => m.id === id);
  return (
    <div className="sheet">
      <div className="sheet-head">
        <div style={{ minWidth: 0 }}>
          <h2>{fmtDataLonga(iso).replace(/^./, (c) => c.toUpperCase())}</h2>
          {quando(iso) === 'Hoje' && <div className="small muted">Hoje</div>}
        </div>
        <span className="spacer" />
        <button type="button" className="btn small icon" onClick={() => abrir('evento', { data: iso })} aria-label="Adicionar neste dia" title="Adicionar neste dia"><Plus /></button>
      </div>
      {evs.length === 0 && <div className="muted small" style={{ padding: '14px 16px' }}>Nada marcado neste dia.</div>}
      {evs.map((e) => <EventoLinha key={e.chave} ctx={ctx} e={e} />)}
      {aulas.length > 0 && !feriado && (
        <div style={{ borderTop: '1px solid var(--rule)', padding: '10px 16px 12px' }}>
          <div className="small" style={{ fontWeight: 650, color: 'var(--ink-2)', marginBottom: 6 }}>Aulas do dia</div>
          <div className="chips">
            {aulas.map((a) => mat(a.materiaId) && (
              <span key={a.id} className="pill" style={{ '--c': corDe(mat(a.materiaId).cor, escuro), fontSize: 12, lineHeight: '22px' }}>
                <span className="num">{a.inicio}</span>&nbsp;<span>{mat(a.materiaId).nome}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Proximos({ ctx, onPick }) {
  const { data } = ctx;
  const hoje = hojeISO();
  const lista = proximos(data.eventos, hoje, 21).filter((e) => !estaFeito(e, e.ocorrencia)).slice(0, 8);
  return (
    <div className="sheet">
      <div className="sheet-head"><h2>Próximas 3 semanas</h2></div>
      {lista.length === 0 ? (
        <div className="empty" style={{ padding: '22px 16px' }}>
          <CalendarDays />
          <p style={{ margin: 0 }}>Nada pendente. Clique num dia do calendário para marcar uma prova ou um lembrete.</p>
        </div>
      ) : (
        <ul className="list">
          {lista.map((e) => (
            <li key={e.chave} style={{ cursor: 'pointer', minHeight: 44 }} onClick={() => onPick(e.ocorrencia)} role="button" tabIndex={0} onKeyDown={(k) => (k.key === 'Enter' || k.key === ' ') && onPick(e.ocorrencia)}>
              <span className={`daytag ${e.ocorrencia === hoje ? 'today' : ''}`}>{quando(e.ocorrencia, hoje)}</span>
              <span className="dot" style={{ background: COR_TIPO[e.tipo] }} />
              <span className="grow">
                <span className="t1" style={{ display: 'block' }}>{e.titulo}</span>
                <span className="t2">{TIPOS_EVENTO[e.tipo]?.nome}{e.hora ? `, ${e.hora}` : ''}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
