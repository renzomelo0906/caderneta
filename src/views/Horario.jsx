import { useEffect, useState } from 'react';
import { Plus, Clock, Trash2, TriangleAlert, UserX, Table2, Sparkles } from 'lucide-react';
import { Modal, Field, Empty } from '../components/ui.jsx';
import { GradeRapidaModal } from './GradeRapida.jsx';
import { materiasDo, corDe, uid } from '../lib/model.js';
import { aulasDo, aulasDoDia, contagemPorDia, contagemIntervalo, porMateria, conflitos, agoraEProxima, frequencia } from '../lib/schedule.js';
import { DIAS, DIAS_CURTO, minutos, hhmm, fmtDuracao, plural } from '../lib/format.js';

const PX_MIN = 1.15; // px por minuto

function useAgora() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Horario({ ctx }) {
  const { data, periodo, escuro, abrir: abrirGlobal } = ctx;
  const [modal, setModal] = useState(null);
  const [de, setDe] = useState(1);
  const [ate, setAte] = useState(5);
  const now = useAgora();

  if (!periodo) return <><Head /><div className="sheet"><Empty icon={Clock} title="Crie um período primeiro" action={<button type="button" className="btn primary" onClick={() => abrirGlobal('periodo')}><Plus /> Criar período</button>} /></div></>;

  const materias = materiasDo(data, periodo.id);
  const aulas = aulasDo(data, periodo.id).filter((a) => materias.some((m) => m.id === a.materiaId));
  const mat = (id) => materias.find((m) => m.id === id);
  const porDia = contagemPorDia(aulas);
  const total = aulas.length;
  const minutosSemana = [...porMateria(aulas).values()].reduce((s, x) => s + x.minutos, 0);

  const nova = (extra = {}) => setModal({ dia: extra.dia ?? 1, inicio: extra.inicio });

  return (
    <>
      <Head>
        <button type="button" className="btn" onClick={() => abrirGlobal('importar', { tipo: 'horario' })} title="Trazer o horário de um print, com a ajuda de uma IA"><Sparkles /> Importar</button>
        <button type="button" className="btn" onClick={() => setModal({ grade: true })} disabled={!materias.length} title="Montar ou mudar a semana toda numa tabela"><Table2 /> Mudar a semana</button>
        <button type="button" className="btn primary" onClick={() => nova()} disabled={!materias.length}><Plus /> Aula</button>
      </Head>
      {!materias.length ? (
        <div className="sheet">
          <Empty
            icon={Clock}
            title="Cadastre as matérias antes"
            action={
              <div className="inline" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn primary" onClick={() => ctx.go('notas')}>Ir para Notas</button>
                <button type="button" className="btn" onClick={() => abrirGlobal('importar', { tipo: 'horario' })}><Sparkles /> Importar de um print</button>
              </div>
            }
          >
            As aulas do horário são das matérias do período {periodo.nome}. Importando de um print, as matérias que faltam são criadas sozinhas.
          </Empty>
        </div>
      ) : (
        <div className="horario-layout">
          <div className="sheet" style={{ overflow: 'hidden' }}>
            {total === 0 ? (
              <Empty
                icon={Clock}
                title="Monte seu horário"
                action={
                  <div className="inline" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="btn primary" onClick={() => setModal({ grade: true })}><Table2 /> Montar a semana toda</button>
                    <button type="button" className="btn" onClick={() => abrirGlobal('importar', { tipo: 'horario' })}><Sparkles /> Importar de um print</button>
                  </div>
                }
              >
                Numa tabela só: diga a que horas começa cada aula e escolha a matéria de cada dia. Ou importe de um print do horário da escola.
              </Empty>
            ) : (
              <Semana aulas={aulas} mat={mat} escuro={escuro} now={now} porDia={porDia} onAula={(a) => setModal({ aulaId: a.id })} onVazio={(dia, inicio) => nova({ dia, inicio })} />
            )}
          </div>

          <div className="stack">
            <Hoje aulas={aulas} mat={mat} escuro={escuro} now={now} />
            <div className="sheet">
              <div className="sheet-head"><h2>Aulas na semana</h2><span className="spacer" /><span className="muted small">{plural(total, 'aula', 'aulas')}, {fmtDuracao(minutosSemana)}</span></div>
              <div className="sheet-body stack" style={{ gap: 12 }}>
                <div className="day-counts">
                  {[1, 2, 3, 4, 5, 6, 0].filter((d) => d <= 5 && d >= 1 || porDia[d]).map((d) => (
                    <span key={d} className="status andamento" title={`${DIAS[d]}: ${plural(porDia[d], 'aula', 'aulas')}`}>{DIAS_CURTO[d]} <strong className="num">{porDia[d]}</strong></span>
                  ))}
                </div>
                <div className="inline" style={{ flexWrap: 'wrap', gap: 6 }}>
                  <span>De</span>
                  <select className="select" style={{ width: 'auto', height: 32 }} value={de} onChange={(e) => setDe(Number(e.target.value))} aria-label="Do dia">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DIAS_CURTO[d]}</option>)}
                  </select>
                  <span>a</span>
                  <select className="select" style={{ width: 'auto', height: 32 }} value={ate} onChange={(e) => setAte(Number(e.target.value))} aria-label="Até o dia">
                    {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DIAS_CURTO[d]}</option>)}
                  </select>
                  <strong className="num">= {plural(contagemIntervalo(aulas, de, ate), 'aula', 'aulas')}</strong>
                </div>
              </div>
              <ul className="list" style={{ borderTop: '1px solid var(--rule)' }}>
                {[...porMateria(aulas).entries()].sort((a, b) => b[1].aulas - a[1].aulas).map(([id, x]) => (
                  <li key={id} style={{ minHeight: 40, padding: '7px 16px' }}>
                    <span className="dot" style={{ background: corDe(mat(id).cor, escuro) }} />
                    <span className="grow t1">{mat(id).nome}</span>
                    <span className="small muted num">{plural(x.aulas, 'aula', 'aulas')}, {fmtDuracao(x.minutos)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Frequencia ctx={ctx} materias={materias} />
          </div>
        </div>
      )}
      {modal && modal.grade && <GradeRapidaModal ctx={ctx} onClose={() => setModal(null)} />}
      {modal && !modal.grade && <AulaModal ctx={ctx} {...modal} onClose={() => setModal(null)} />}
    </>
  );
}

function Head({ children }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="hand">Horário</h1>
        <div className="sub">Suas aulas da semana. Clique numa aula para mudar.</div>
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}

function Semana({ aulas, mat, escuro, now, porDia, onAula, onVazio }) {
  const dias = [1, 2, 3, 4, 5];
  if (porDia[6]) dias.push(6);
  if (porDia[0]) dias.push(0);
  const ini = Math.floor(Math.min(...aulas.map((a) => minutos(a.inicio))) / 60) * 60;
  const fim = Math.ceil(Math.max(...aulas.map((a) => minutos(a.fim))) / 60) * 60;
  const altura = (fim - ini) * PX_MIN;
  const horas = [];
  for (let h = ini; h <= fim; h += 60) horas.push(h);
  const hoje = now.getDay();
  const mAgora = now.getHours() * 60 + now.getMinutes();
  const conflitantes = new Set(aulas.filter((a) => conflitos(aulas, a).length).map((a) => a.id));

  const clicarVazio = (dia) => (e) => {
    if (e.target !== e.currentTarget) return;
    const y = e.nativeEvent.offsetY;
    const m = Math.round((ini + y / PX_MIN) / 5) * 5;
    onVazio(dia, hhmm(Math.max(0, Math.min(23 * 60 + 55, m))));
  };

  return (
    <div className="week" style={{ gridTemplateColumns: `54px repeat(${dias.length}, minmax(0, 1fr))` }}>
      <div className="week-head">
        <div style={{ borderBottom: '1px solid var(--rule-strong)' }} />
        {dias.map((d) => (
          <div key={d} className={d === hoje ? 'today' : ''}>
            <span>{DIAS_CURTO[d]}</span>
            <span className="cnt">{plural(porDia[d], 'aula', 'aulas')}</span>
          </div>
        ))}
      </div>
      <div className="week-times" style={{ height: altura + 16, paddingTop: 8 }}>
        {horas.map((h) => <span key={h} style={{ top: (h - ini) * PX_MIN + 8 }}>{hhmm(h)}</span>)}
      </div>
      {dias.map((d) => (
        <div key={d} className="week-body" style={{ height: altura + 16, paddingTop: 8 }}>
          <div style={{ position: 'absolute', inset: '8px 0 8px 0', cursor: 'copy' }} onClick={clicarVazio(d)} role="presentation">
            {horas.map((h) => <div key={h} className="hour-line" style={{ top: (h - ini) * PX_MIN }} />)}
            {d === hoje && mAgora >= ini && mAgora <= fim && <div className="now-line" style={{ top: (mAgora - ini) * PX_MIN }} aria-hidden="true" />}
            {aulasDoDia(aulas, d).map((a) => {
              const m = mat(a.materiaId);
              const top = (minutos(a.inicio) - ini) * PX_MIN;
              const h = Math.max(22, (minutos(a.fim) - minutos(a.inicio)) * PX_MIN - 3);
              const agora = d === hoje && minutos(a.inicio) <= mAgora && mAgora < minutos(a.fim);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`aula ${agora ? 'agora' : ''} ${conflitantes.has(a.id) ? 'conflito' : ''}`}
                  style={{ top, height: h, '--c': corDe(m.cor, escuro) }}
                  onClick={() => onAula(a)}
                  title={`${m.nome}, ${a.inicio} às ${a.fim}${a.sala ? `, sala ${a.sala}` : ''}${conflitantes.has(a.id) ? '. Bate com outra aula.' : ''}`}
                >
                  <span className="an">{m.nome}</span>
                  {h > 34 && <span className="at">{a.inicio}–{a.fim}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Hoje({ aulas, mat, escuro, now }) {
  const { agora, proxima, hoje } = agoraEProxima(aulas, now);
  const m = now.getHours() * 60 + now.getMinutes();
  let titulo;
  let corpo;
  let cor = 'var(--rule-strong)';
  if (agora) {
    const x = mat(agora.materiaId);
    cor = corDe(x.cor, escuro);
    titulo = `Agora, até ${agora.fim}`;
    corpo = x.nome;
  } else if (proxima) {
    const x = mat(proxima.materiaId);
    cor = corDe(x.cor, escuro);
    titulo = `Próxima aula, em ${fmtDuracao(minutos(proxima.inicio) - m)}`;
    corpo = `${x.nome} às ${proxima.inicio}`;
  } else {
    titulo = 'Hoje';
    corpo = hoje.length ? 'As aulas de hoje acabaram' : 'Sem aulas hoje';
  }
  return (
    <div className="sheet now-card">
      <span className="bar-v" style={{ background: cor }} />
      <div>
        <div className="when">{titulo}</div>
        <div className="what hand">{corpo}</div>
        {(agora || proxima) && (agora || proxima).sala && <div className="small muted">Sala {(agora || proxima).sala}</div>}
      </div>
    </div>
  );
}

function Frequencia({ ctx, materias }) {
  const { data, periodo, abrir, escuro } = ctx;
  const linhas = materias.map((m) => ({ m, f: frequencia(data, periodo, m) }));
  const semTotal = linhas.some((l) => l.f.total === null);
  return (
    <div className="sheet">
      <div className="sheet-head">
        <h2>Frequência</h2>
        <span className="spacer" />
        <button type="button" className="btn small" onClick={() => abrir('falta')}><UserX /> Falta</button>
      </div>
      {linhas.map(({ m, f }) => {
        const pct = f.percentual;
        const nivel = f.podeFaltar === null ? '' : f.podeFaltar < 0 ? 'bad' : f.podeFaltar <= 2 ? 'warn' : '';
        return (
          <div key={m.id} className="freq-row">
            <div className="top">
              <span className="dot" style={{ background: corDe(m.cor, escuro) }} />
              <span className="grow t1" style={{ fontWeight: 620, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</span>
              <button type="button" className="link small" onClick={() => abrir('falta', { materiaId: m.id })}>{plural(f.faltas, 'falta', 'faltas')}</button>
            </div>
            {f.total ? (
              <>
                <div className={`meter ${nivel}`} role="img" aria-label={`Frequência ${Math.round(pct)}%`}><div style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
                <div className="small" style={{ marginTop: 4, color: nivel === 'bad' ? 'var(--red)' : nivel === 'warn' ? 'var(--warn)' : 'var(--ink-3)', fontWeight: nivel ? 620 : 400 }}>
                  {nivel === 'bad' && <TriangleAlert size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />}
                  {Math.round(pct)}% de presença.{' '}
                  {f.podeFaltar >= 0 ? `Pode faltar mais ${plural(f.podeFaltar, 'aula', 'aulas')}` : `Passou ${plural(-f.podeFaltar, 'falta', 'faltas')} do limite`}
                  {f.estimado ? ` (de ${f.total}, pela grade)` : ` (de ${f.total})`}
                </div>
              </>
            ) : null}
          </div>
        );
      })}
      {semTotal && <div className="small faint" style={{ padding: '10px 16px', borderTop: '1px solid var(--rule)' }}>Para calcular quantas faltas ainda pode ter, coloque as datas de início e fim do período (no menu do período) ou o total de aulas na matéria.</div>}
    </div>
  );
}

function AulaModal({ ctx, onClose, aulaId, dia, inicio }) {
  const { data, update, periodo } = ctx;
  const original = aulaId ? data.aulas.find((a) => a.id === aulaId) : null;
  const materias = materiasDo(data, periodo.id);
  const aulas = aulasDo(data, periodo.id);
  const sugestao = () => {
    const doDia = aulasDoDia(aulas, dia ?? 1);
    const ultima = doDia[doDia.length - 1];
    const dur = ultima ? minutos(ultima.fim) - minutos(ultima.inicio) : 50;
    const ini = inicio ? minutos(inicio) : ultima ? minutos(ultima.fim) : 7 * 60;
    return { inicio: hhmm(ini), fim: hhmm(Math.min(23 * 60 + 59, ini + dur)) };
  };
  const [f, setF] = useState(() =>
    original
      ? { materiaId: original.materiaId, dias: [original.dia], inicio: original.inicio, fim: original.fim, sala: original.sala || '' }
      : { materiaId: materias[0] ? materias[0].id : '', dias: [dia ?? 1], ...sugestao(), sala: '' }
  );
  const [erro, setErro] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const mudarInicio = (v) => {
    const dur = minutos(f.fim) - minutos(f.inicio);
    const ni = minutos(v);
    setF((x) => ({ ...x, inicio: v, fim: ni !== null && dur > 0 ? hhmm(Math.min(23 * 60 + 59, ni + dur)) : x.fim }));
  };
  const toggleDia = (d) => setF((x) => ({ ...x, dias: original ? [d] : x.dias.includes(d) ? x.dias.filter((y) => y !== d) : [...x.dias, d] }));

  const batem = f.dias.flatMap((d) => conflitos(aulas, { id: original ? original.id : 'novo', dia: d, inicio: f.inicio, fim: f.fim }));

  const salvar = () => {
    if (!f.materiaId) return setErro('Escolha a matéria.');
    if (!f.dias.length) return setErro('Escolha pelo menos um dia.');
    const a = minutos(f.inicio);
    const b = minutos(f.fim);
    if (a === null || b === null) return setErro('Preencha o horário de início e de fim.');
    if (b <= a) return setErro('A aula precisa terminar depois de começar.');
    update((d) => {
      if (original) Object.assign(d.aulas.find((x) => x.id === original.id), { materiaId: f.materiaId, dia: f.dias[0], inicio: f.inicio, fim: f.fim, sala: f.sala.trim() });
      else for (const dia of f.dias) d.aulas.push({ id: uid(), periodoId: periodo.id, materiaId: f.materiaId, dia, inicio: f.inicio, fim: f.fim, sala: f.sala.trim() });
    }, { msg: original ? 'Aula salva.' : f.dias.length > 1 ? `${f.dias.length} aulas adicionadas.` : 'Aula adicionada.' });
    onClose();
  };
  const apagar = () => {
    update((d) => { d.aulas = d.aulas.filter((x) => x.id !== original.id); }, { undo: 'Aula apagada.' });
    onClose();
  };

  return (
    <Modal
      title={original ? 'Editar aula' : 'Adicionar aula'}
      onClose={onClose}
      footer={<>{original && <button type="button" className="btn danger" onClick={apagar}><Trash2 /> Apagar</button>}<span className="spacer" /><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn primary" onClick={salvar}>Salvar</button></>}
    >
      <form className="stack" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <Field label="Matéria" id="a-mat">
          <select id="a-mat" className="select" value={f.materiaId} onChange={(e) => set('materiaId')(e.target.value)}>
            {materias.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </Field>
        <div className="field">
          <span className="label">{original ? 'Dia' : 'Dias (pode escolher vários)'}</span>
          <div className="toggle-chips" role="group" aria-label="Dias da semana">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => <button key={d} type="button" aria-pressed={f.dias.includes(d)} onClick={() => toggleDia(d)}>{DIAS_CURTO[d]}</button>)}
          </div>
        </div>
        <div className="grid3">
          <Field label="Começa" id="a-ini"><input id="a-ini" className="input" type="time" value={f.inicio} onChange={(e) => mudarInicio(e.target.value)} /></Field>
          <Field label="Termina" id="a-fim" hint={minutos(f.fim) > minutos(f.inicio) ? fmtDuracao(minutos(f.fim) - minutos(f.inicio)) : null}><input id="a-fim" className="input" type="time" value={f.fim} onChange={(e) => set('fim')(e.target.value)} /></Field>
          <Field label="Sala (opcional)" id="a-sala"><input id="a-sala" className="input" value={f.sala} onChange={(e) => set('sala')(e.target.value)} maxLength={20} /></Field>
        </div>
        {batem.length > 0 && (
          <div className="banner warn" style={{ margin: 0 }}>
            <TriangleAlert />
            <span>Bate com {batem.map((a) => `${materias.find((m) => m.id === a.materiaId)?.nome} (${DIAS_CURTO[a.dia]}, ${a.inicio}–${a.fim})`).join('; ')}. Dá para salvar assim mesmo.</span>
          </div>
        )}
        {erro && <div className="err" role="alert" style={{ color: 'var(--red)', fontWeight: 560 }}>{erro}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
