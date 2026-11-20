import { useEffect, useState } from 'react';
import { Plus, Bell, UserX, ShieldAlert, CircleCheck, Clock, CalendarDays, Target, Grid3x3 } from 'lucide-react';
import { materiasDo, corDe } from '../lib/model.js';
import { etapaResult, etapaAtual, mediaGeral, finalResult } from '../lib/grades.js';
import { aulasDo, agoraEProxima, frequencia } from '../lib/schedule.js';
import { proximos, estaFeito } from '../lib/events.js';
import { fmtNota, hojeISO, fmtDataLonga, saudacao, minutos, fmtDuracao, fmtDataHora, plural } from '../lib/format.js';
import { textoPrecisa } from './Notas.jsx';
import { EventoLinha } from './Calendario.jsx';

function useAgora() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Inicio({ ctx }) {
  const { data, periodo, abrir, go, escuro, resumo, limparResumo, api, update } = ctx;
  const now = useAgora();
  const [pin, setPin] = useState(null);
  useEffect(() => {
    if (data.settings.dicaPin) api.pinStatus().then((r) => r && r.ok && setPin(r));
  }, [api, data.settings.dicaPin]);
  const dicaPin = data.settings.dicaPin && pin && pin.disponivel && !pin.ativo && !(resumo && resumo.falhasDesde > 0);
  const fecharDica = () => update((d) => { d.settings.dicaPin = false; });
  const hoje = hojeISO();
  const casas = data.settings.casas;
  const nome = (data.profile.nome || '').trim().split(/\s+/)[0];

  const materias = periodo ? materiasDo(data, periodo.id) : [];
  const mat = (id) => data.materias.find((m) => m.id === id);
  const aulas = periodo ? aulasDo(data, periodo.id).filter((a) => mat(a.materiaId)) : [];
  const { agora, proxima, hoje: aulasHoje, minutoAtual } = agoraEProxima(aulas, now);
  const etapa = periodo ? etapaAtual(data, periodo, hoje) : null;
  const geral = periodo ? mediaGeral(data, periodo, materias) : null;
  const algumaParcial = periodo ? materias.some((m) => finalResult(data, periodo, m).parcial) : false;

  const atencao = [];
  if (periodo && etapa) {
    for (const m of materias) {
      const r = etapaResult(data, periodo, m, etapa);
      if (r.valor !== null && r.valor + 1e-9 < periodo.mediaMinima) atencao.push({ m, tipo: 'nota', r });
      const f = frequencia(data, periodo, m);
      if (f.podeFaltar !== null && f.podeFaltar <= 2) atencao.push({ m, tipo: 'falta', f });
    }
  }
  const eventos = proximos(data.eventos, hoje, 7).filter((e) => !estaFeito(e, e.ocorrencia) || e.ocorrencia === hoje);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="hello hand">{saudacao(now)}{nome ? `, ${nome}` : ''}</h1>
          <div className="sub">{fmtDataLonga(hoje).replace(/^./, (c) => c.toUpperCase())}{etapa ? `. Você está no ${etapa.nome} de ${periodo.nome}.` : ''}</div>
        </div>
        <div className="actions quick">
          <button type="button" className="btn" onClick={() => abrir('falta')} disabled={!materias.length}><UserX /> Falta</button>
          <button type="button" className="btn" onClick={() => abrir('evento', { tipo: 'lembrete' })}><Bell /> Lembrete</button>
          <button type="button" className="btn primary" onClick={() => abrir('nota', { etapaId: etapa ? etapa.id : undefined })} disabled={!materias.length}><Plus /> Nota</button>
        </div>
      </div>

      {resumo && resumo.falhasDesde > 0 && (
        <div className="banner warn" role="alert">
          <ShieldAlert />
          <div style={{ flex: 1 }}>
            <div className="t">Alguém errou a senha ou o PIN desta conta {plural(resumo.falhasDesde, 'vez', 'vezes')} desde o seu último acesso</div>
            <div className="small">
              {resumo.ultimaFalha ? `A última tentativa foi em ${fmtDataHora(resumo.ultimaFalha)}. ` : ''}Se não foi você, troque a senha (e o PIN) em Ajustes.
            </div>
          </div>
          <button type="button" className="btn small" onClick={() => { limparResumo(); go('ajustes'); }}>Trocar senha</button>
          <button type="button" className="btn ghost small" onClick={limparResumo}>Fui eu</button>
        </div>
      )}

      {dicaPin && (
        <div className="banner info">
          <Grid3x3 />
          <div style={{ flex: 1 }}>
            <div className="t">Cansou de digitar a senha inteira?</div>
            <div className="small">Crie um PIN de 6 números para entrar rápido neste computador. A senha continua valendo.</div>
          </div>
          <button type="button" className="btn small" onClick={() => { fecharDica(); go('ajustes'); }}>Criar PIN</button>
          <button type="button" className="btn ghost small" onClick={fecharDica}>Agora não</button>
        </div>
      )}

      <div className="home-grid">
        <div className="stack">
          <div className="sheet">
            <div className="sheet-head">
              <h2>Aulas de hoje</h2>
              <span className="spacer" />
              {agora ? (
                <span className="small muted">Agora: <strong>{mat(agora.materiaId).nome}</strong>, até {agora.fim}</span>
              ) : proxima ? (
                <span className="small muted">Próxima em {fmtDuracao(minutos(proxima.inicio) - minutoAtual)}</span>
              ) : null}
            </div>
            {aulasHoje.length === 0 ? (
              <div className="empty" style={{ padding: '22px 16px' }}>
                <Clock />
                <p style={{ margin: '0 auto 10px' }}>{aulas.length ? 'Sem aulas hoje.' : 'Monte seu horário para ver aqui as aulas do dia.'}</p>
                {!aulas.length && <button type="button" className="btn small" onClick={() => go('horario')}>Montar horário</button>}
              </div>
            ) : (
              <ul className="list">
                {aulasHoje.map((a) => {
                  const m = mat(a.materiaId);
                  const passou = minutos(a.fim) <= minutoAtual;
                  return (
                    <li key={a.id} className={`${agora && agora.id === a.id ? 'now' : ''} ${passou ? 'past' : ''}`}>
                      <span className="time">{a.inicio}–{a.fim}</span>
                      <span className="dot" style={{ background: corDe(m.cor, escuro) }} />
                      <span className="grow">
                        <span className="t1" style={{ display: 'block' }}>{m.nome}</span>
                        {(a.sala || m.professor) && <span className="t2">{[a.sala && `Sala ${a.sala}`, m.professor].filter(Boolean).join(', ')}</span>}
                      </span>
                      {agora && agora.id === a.id && <span className="small" style={{ fontWeight: 650 }}>agora</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="sheet">
            <div className="sheet-head"><h2>Precisa de atenção</h2>{etapa && <span className="muted small">no {etapa.nome}</span>}</div>
            {atencao.length === 0 ? (
              <div className="inline" style={{ padding: '14px 18px', color: 'var(--ok)' }}>
                <CircleCheck size={18} />
                <span>{materias.length ? 'Nenhuma matéria abaixo da média nem perto do limite de faltas.' : 'Cadastre as matérias para acompanhar aqui.'}</span>
              </div>
            ) : (
              <ul className="list">
                {atencao.map(({ m, tipo, r, f }) => {
                  const precisa = r ? textoPrecisa(r, periodo, casas) : null;
                  return (
                    <li key={m.id + tipo} style={{ alignItems: 'flex-start' }}>
                      <span className="dot" style={{ background: corDe(m.cor, escuro), marginTop: 6 }} />
                      <span className="grow">
                        <span className="t1" style={{ display: 'block' }}>{m.nome}</span>
                        <span className="t2" style={{ display: 'block' }}>
                          {tipo === 'nota'
                            ? `Média ${fmtNota(r.valor, casas)}${r.parcial ? ' até agora' : ''}, abaixo de ${fmtNota(periodo.mediaMinima, casas)}. ${precisa ? precisa.texto : ''}`
                            : f.podeFaltar < 0 ? `Passou ${plural(-f.podeFaltar, 'falta', 'faltas')} do limite de frequência.` : f.podeFaltar === 0 ? 'Não pode faltar mais nenhuma aula.' : `Só pode faltar mais ${plural(f.podeFaltar, 'aula', 'aulas')}.`}
                        </span>
                      </span>
                      {tipo === 'nota' ? <Target size={16} style={{ color: 'var(--red)', marginTop: 3 }} /> : <UserX size={16} style={{ color: 'var(--warn)', marginTop: 3 }} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="stack">
          {periodo && (
            <div className="sheet">
              <div className="stat-row">
                <div className="stat">
                  <div className="l">Média geral{algumaParcial ? ' até agora' : ''}</div>
                  <div className={`v ${geral !== null && geral + 1e-9 < periodo.mediaMinima ? 'low' : ''}`}>{fmtNota(geral, casas)}</div>
                  <div className="d">{periodo.nome}</div>
                </div>
                <div className="stat">
                  <div className="l">Matérias</div>
                  <div className="v">{materias.length}</div>
                  <div className="d">{plural(aulas.length, 'aula', 'aulas')} por semana</div>
                </div>
                <div className="stat">
                  <div className="l">Abaixo da média</div>
                  <div className={`v ${atencao.some((a) => a.tipo === 'nota') ? 'low' : ''}`}>{atencao.filter((a) => a.tipo === 'nota').length}</div>
                  <div className="d">{etapa ? `no ${etapa.codigo}` : ''}</div>
                </div>
              </div>
            </div>
          )}
          <div className="sheet">
            <div className="sheet-head">
              <h2>Próximos 7 dias</h2>
              <span className="spacer" />
              <button type="button" className="btn ghost small" onClick={() => go('calendario')}><CalendarDays /> Calendário</button>
            </div>
            {eventos.length === 0 ? (
              <div className="muted small" style={{ padding: '14px 18px' }}>Nada marcado. Que tal anotar a próxima prova?</div>
            ) : (
              eventos.slice(0, 8).map((e) => <EventoLinha key={e.chave} ctx={ctx} e={e} mostrarData />)
            )}
          </div>
        </div>
      </div>
    </>
  );
}
