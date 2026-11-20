import { useState } from 'react';
import { Plus, Sigma, BookOpen, Target, CircleCheck, CircleAlert, Pencil, Trash2, Check, CircleHelp, Sparkles } from 'lucide-react';
import { Modal, Field, Empty, Status, Switch } from '../components/ui.jsx';
import { materiasDo, makeMateria, nextColor, CORES, corDe, TIPOS_ETAPA, MATERIAS_SUGERIDAS } from '../lib/model.js';
import { etapaResult, finalResult, situacao, SITUACAO_TEXTO, etapaAtual, FINAL, valeDe, tipoDe, temFormulaPropria, formulaEtapaDe } from '../lib/grades.js';
import { compile, tryEvaluate, normalizeName } from '../lib/formula.js';
import { fmtNota, hojeISO, parseNum } from '../lib/format.js';

export default function Notas({ ctx }) {
  const { data, periodo, abrir } = ctx;
  const [tab, setTab] = useState(() => (periodo ? (etapaAtual(data, periodo, hojeISO()) || periodo.etapas[0]).id : null));
  const [modal, setModal] = useState(null);

  if (!periodo) {
    return (
      <>
        <Head />
        <div className="sheet"><Empty icon={BookOpen} title="Nenhum período ainda" action={<button type="button" className="btn primary" onClick={() => abrir('periodo')}><Plus /> Criar período</button>}>Crie o ano letivo (ou o semestre) para começar a guardar notas.</Empty></div>
      </>
    );
  }

  const materias = materiasDo(data, periodo.id);
  const etapaSel = periodo.etapas.find((e) => e.id === tab) || (tab === FINAL ? null : periodo.etapas[0]);
  const curtas = periodo.etapas.length > 6;

  const idsMaterias = new Set(materias.map((m) => m.id));
  const mediasEscola = data.notas.filter((n) => idsMaterias.has(n.materiaId) && tipoDe(n) === 'oficial');
  const excluirMedias = async () => {
    const ok = await ctx.confirm({
      title: `Excluir as médias da escola de ${periodo.nome}?`,
      message: `${mediasEscola.length === 1 ? 'Sai 1 média da escola' : `Saem ${mediasEscola.length} médias da escola`}, de todas as matérias e partes. As médias voltam a sair das suas fórmulas. As notas não mudam. Dá para desfazer logo depois.`,
      confirmLabel: 'Excluir médias',
      danger: true,
    });
    if (!ok) return;
    const ids = new Set(mediasEscola.map((n) => n.id));
    ctx.update((d) => { d.notas = d.notas.filter((n) => !ids.has(n.id)); }, { undo: `${mediasEscola.length === 1 ? 'Média da escola excluída' : `${mediasEscola.length} médias da escola excluídas`}.` });
  };

  return (
    <>
      <Head periodo={periodo}>
        <button type="button" className="btn" onClick={() => abrir('importar', { tipo: 'notas' })} title="Trazer as notas de prints do boletim, com a ajuda de uma IA"><Sparkles /> Importar</button>
        <button type="button" className="btn" onClick={() => setModal({ tipo: 'materias' })}><BookOpen /> Matérias</button>
        <button type="button" className="btn" onClick={() => setModal({ tipo: 'formulas' })}><Sigma /> Fórmulas</button>
        <button type="button" className="btn primary" onClick={() => abrir('nota', { etapaId: etapaSel ? etapaSel.id : FINAL })} disabled={!materias.length}><Plus /> Nota</button>
      </Head>

      {!materias.length ? (
        <div className="sheet">
          <Empty
            icon={BookOpen}
            title="Cadastre suas matérias"
            action={
              <div className="inline" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn primary" onClick={() => setModal({ tipo: 'materias' })}><Plus /> Adicionar matérias</button>
                <button type="button" className="btn" onClick={() => abrir('importar', { tipo: 'notas' })}><Sparkles /> Importar de um print</button>
              </div>
            }
          >
            Depois é só lançar as notas de cada uma. As médias saem sozinhas. Se as notas já estão no portal da escola, dá para importar de um print.
          </Empty>
        </div>
      ) : (
        <>
          {mediasEscola.length > 0 && (
            <div className="banner warn" role="status">
              <CircleAlert />
              <div style={{ flex: 1 }}>
                <div className="t">{mediasEscola.length === 1 ? 'Há 1 média da escola' : `Há ${mediasEscola.length} médias da escola`} no lugar das suas fórmulas</div>
                <div className="small">Onde tem a etiqueta “Escola”, a média é a que veio do boletim, e não a conta das suas fórmulas.</div>
              </div>
              <button type="button" className="btn danger small" onClick={excluirMedias}><Trash2 /> Excluir médias da escola</button>
            </div>
          )}
          <div className="tabs" role="tablist" aria-label="Parte do período">
            {periodo.etapas.map((e) => (
              <button key={e.id} type="button" role="tab" aria-selected={etapaSel && etapaSel.id === e.id} onClick={() => setTab(e.id)} title={e.nome}>
                {curtas ? e.codigo : e.nome.replace(/^./, (c) => c.toUpperCase())}
              </button>
            ))}
            <span className="tab-sep" aria-hidden="true" />
            <button type="button" role="tab" aria-selected={!etapaSel} onClick={() => setTab(FINAL)}>Período todo</button>
          </div>
          {etapaSel ? <EtapaView ctx={ctx} etapa={etapaSel} materias={materias} /> : <AnoView ctx={ctx} materias={materias} />}
        </>
      )}

      {modal && modal.tipo === 'materias' && <MateriasModal ctx={ctx} onClose={() => setModal(null)} />}
      {modal && modal.tipo === 'formulas' && <FormulasModal ctx={ctx} onClose={() => setModal(null)} onMateria={(id) => setModal({ tipo: 'materia', id })} />}
      {modal && modal.tipo === 'materia' && <MateriaModal ctx={ctx} materiaId={modal.id} abrirConta onClose={() => setModal({ tipo: 'formulas' })} />}
    </>
  );
}

function Head({ periodo, children }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="hand">Notas</h1>
        {periodo && (
          <div className="sub">
            {periodo.nome}, média para passar {fmtNota(periodo.mediaMinima, 1)} de {fmtNota(periodo.notaMaxima, 0)}
          </div>
        )}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}

const lista = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`);

export function textoPrecisa(r, periodo, casas, alvo = 'fechar') {
  if (!r.precisa) return null;
  const min = fmtNota(periodo.mediaMinima, casas);
  const verbo = alvo === 'passar' ? 'passar' : 'fechar';
  if (r.precisa.status === 'garantido') return { tipo: 'good', texto: `Mesmo tirando zero no que falta (${lista(r.faltam)}), você já garante ${min}.` };
  if (r.precisa.status === 'impossivel') return { tipo: 'bad', texto: `Mesmo com nota máxima em ${lista(r.faltam)}, não dá para chegar a ${min}.` };
  const x = r.precisa.value;
  const nmax = periodo.notaMaxima;
  const partes = r.faltam.map((s) => {
    const n = (r.notas || r.finais || []).find((k) => normalizeName(k.sigla) === normalizeName(s));
    const vale = n ? valeDe(n, periodo) : nmax;
    return Math.abs(vale - nmax) > 1e-9 ? `${s} (${fmtNota(Math.min(vale, Math.ceil(((x * vale) / nmax) * 10 - 1e-6) / 10), casas)} de ${fmtNota(vale, casas).replace(/,0+$/, '')})` : s;
  });
  if (r.faltam.length === 1) return { tipo: 'need', texto: `Para ${verbo} com ${min}, tire pelo menos ${fmtNota(x, casas)} em ${partes[0]}.` };
  return { tipo: 'need', texto: `Para ${verbo} com ${min}, tire pelo menos ${fmtNota(x, casas)} em cada: ${lista(partes)}.` };
}

function Need({ info, style }) {
  if (!info) return null;
  const Icon = info.tipo === 'good' ? CircleCheck : info.tipo === 'bad' ? CircleAlert : Target;
  return (
    <div className={`need ${info.tipo}`} style={style}>
      <Icon aria-hidden="true" />
      <span>{info.texto}</span>
    </div>
  );
}

const ORDEM_TIPO = { avaliacao: 0, bonus: 1, oficial: 2 };
const sinal = (v, casas) => `${v > 0 ? '+' : ''}${fmtNota(v, casas)}`;
const ordenarNotas = (notas) => [...notas].sort((a, b) => ORDEM_TIPO[tipoDe(a)] - ORDEM_TIPO[tipoDe(b)]);

export function NotaChip({ n, periodo, casas, onClick }) {
  const t = tipoDe(n);
  if (t === 'bonus') {
    return (
      <button type="button" className="chip bonus" onClick={onClick} title={`Bônus: ${n.nome}. Soma direto na média. Clique para editar.`}>
        <span className="sg">{n.sigla}</span>
        <span className="vl">{sinal(n.valor, casas)}</span>
      </button>
    );
  }
  if (t === 'oficial') {
    return (
      <button type="button" className="chip oficial" onClick={onClick} title="Média divulgada pela escola. Ela substitui a conta do app. Clique para editar.">
        <span className="sg">Escola</span>
        <span className="vl">{fmtNota(n.valor, casas)}</span>
      </button>
    );
  }
  const vale = valeDe(n, periodo);
  const baixa = n.valor !== null && (n.valor / vale) * periodo.notaMaxima + 1e-9 < periodo.mediaMinima;
  return (
    <button
      type="button"
      className={`chip ${n.valor === null ? 'pending' : ''} ${baixa ? 'low' : ''}`}
      onClick={onClick}
      title={`${n.nome}${n.peso !== 1 ? `, peso ${fmtNota(n.peso, 0)}` : ''}. Clique para editar.`}
    >
      <span className="sg">{n.sigla}</span>
      <span className="vl">{n.valor === null ? 'a fazer' : fmtNota(n.valor, casas)}</span>
      {Math.abs(vale - periodo.notaMaxima) > 1e-9 && <span className="of">/{fmtNota(vale, casas).replace(/,0+$/, '')}</span>}
    </button>
  );
}

function rotuloMedia(r, low) {
  if (r.erro) return 'fórmula com erro';
  if (r.oficial) return low ? 'abaixo, da escola' : 'média da escola';
  if (r.vazio) return r.bonusNotas && r.bonusNotas.length ? 'só bônus' : 'sem notas';
  if (r.valor === null) return `falta ${lista(r.faltam)}`;
  if (low) return r.parcial ? 'abaixo, parcial' : 'abaixo da média';
  if (r.parcial) return 'parcial';
  return r.comBonus ? 'com bônus' : 'média';
}

function EtapaView({ ctx, etapa, materias }) {
  const { data, periodo, abrir, escuro } = ctx;
  const casas = data.settings.casas;
  return (
    <div className="ruled">
      {materias.map((m) => {
        const r = etapaResult(data, periodo, m, etapa);
        const low = r.valor !== null && r.valor + 1e-9 < periodo.mediaMinima;
        const precisa = textoPrecisa(r, periodo, casas);
        const propria = formulaEtapaDe(periodo, m, etapa) !== formulaEtapaDe(periodo, null, etapa);
        return (
          <div key={m.id} className="ruled-row" style={precisa || r.erro ? { paddingBottom: 10 } : null}>
            <div className="subject">
              <span className="dot" style={{ background: corDe(m.cor, escuro) }} />
              <div style={{ minWidth: 0 }}>
                <div className="nm">{m.nome}</div>
                {(m.professor || propria) && (
                  <div className="sub" title={propria ? `Conta própria: ${r.formula}` : undefined}>
                    {[m.professor, propria && 'conta própria'].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </div>
            <div className="chips">
              {ordenarNotas(r.notas).map((n) => <NotaChip key={n.id} n={n} periodo={periodo} casas={casas} onClick={() => abrir('nota', { notaId: n.id })} />)}
              <button type="button" className="chip add" onClick={() => abrir('nota', { materiaId: m.id, etapaId: etapa.id })} aria-label={`Adicionar nota de ${m.nome}`} title={`Adicionar nota de ${m.nome}`}>
                <Plus />
              </button>
            </div>
            <div className="avg">
              <div className={`v ${r.valor === null ? 'none' : low ? 'low' : ''}`}>{r.erro ? '!' : fmtNota(r.valor, casas)}</div>
              <div className={`l ${low ? 'low' : ''}`}>{rotuloMedia(r, low)}</div>
            </div>
            {r.erro ? <Need info={{ tipo: 'bad', texto: `A fórmula desta parte tem um erro: ${r.erro} ${propria ? `Arrume em Fórmulas, na conta de ${m.nome}.` : 'Arrume em Fórmulas.'}` }} /> : <Need info={precisa} />}
          </div>
        );
      })}
    </div>
  );
}

function AnoView({ ctx, materias }) {
  const { data, periodo, abrir, escuro } = ctx;
  const casas = data.settings.casas;
  const linhas = materias.map((m) => ({ m, r: finalResult(data, periodo, m) }));
  const temParcial = linhas.some(({ r }) => r.etapas.some((e) => e.parcial));
  return (
    <>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Matéria</th>
              {periodo.etapas.map((e) => <th key={e.id} className="c" title={e.nome}>{e.codigo}</th>)}
              <th>Notas finais</th>
              <th className="c">Média final</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ m, r }) => {
              const sit = situacao(periodo, r);
              const low = r.valor !== null && r.valor + 1e-9 < periodo.mediaMinima;
              const precisa = textoPrecisa(r, periodo, casas, 'passar');
              return (
                <tr key={m.id}>
                  <td>
                    <div className="subject">
                      <span className="dot" style={{ background: corDe(m.cor, escuro) }} />
                      <span className="nm">{m.nome}</span>
                    </div>
                  </td>
                  {r.etapas.map((e) => (
                    <td key={e.etapa.id} className={`c ${e.valor !== null && e.valor + 1e-9 < periodo.mediaMinima ? 'low' : ''} ${e.parcial ? 'partial' : ''}`} title={e.oficial ? 'Média divulgada pela escola' : e.parcial ? 'Parcial: ainda há avaliação sem nota' : e.comBonus ? `Com ${sinal(e.bonus, casas)} de bônus` : e.erro || undefined}>
                      {e.erro ? '!' : fmtNota(e.valor, casas)}
                    </td>
                  ))}
                  <td>
                    <div className="chips">
                      {ordenarNotas(r.finais).map((n) => <NotaChip key={n.id} n={n} periodo={periodo} casas={casas} onClick={() => abrir('nota', { notaId: n.id })} />)}
                      <button type="button" className="chip add" onClick={() => abrir('nota', { materiaId: m.id, etapaId: FINAL })} aria-label={`Adicionar nota final de ${m.nome}`} title="Recuperação, exame ou outra nota do período todo">
                        <Plus />
                      </button>
                    </div>
                  </td>
                  <td className={`c final ${low ? 'low' : ''} ${r.parcial ? 'partial' : ''}`}>{r.erro ? '!' : fmtNota(r.valor, casas)}</td>
                  <td style={{ minWidth: 200 }}>
                    <Status tipo={sit}>{SITUACAO_TEXTO[sit]}</Status>
                    {precisa && precisa.tipo !== 'good' && sit !== 'aprovado' && <div className="small muted" style={{ marginTop: 4, maxWidth: 260 }}>{precisa.texto}</div>}
                    {r.erro && <div className="small" style={{ color: 'var(--red)', marginTop: 4 }}>{r.erro}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small faint" style={{ marginTop: 10 }}>
        {temParcial && 'Valores em cinza são parciais: ainda há avaliação sem nota. '}
        A média final usa a fórmula <span className="code">{periodo.formulaFinal}</span>
        {materias.some((m) => m.formulaFinal) ? `, menos em ${lista(materias.filter((m) => m.formulaFinal).map((m) => m.nome))}, que têm conta própria` : ''}. Troque em Fórmulas.
      </p>
    </>
  );
}

function MateriasModal({ ctx, onClose }) {
  const { data, update, periodo, escuro, confirm } = ctx;
  const [editando, setEditando] = useState(null); // id | 'nova'
  const materias = materiasDo(data, periodo.id);
  const sugestoes = MATERIAS_SUGERIDAS.filter((s) => !materias.some((m) => m.nome.toLowerCase() === s.toLowerCase()));

  const addRapida = (nome) => update((d) => { d.materias.push(makeMateria(periodo.id, nome, nextColor(materiasDo(d, periodo.id)))); });

  const apagar = async (m) => {
    const n = data.notas.filter((x) => x.materiaId === m.id).length;
    const a = data.aulas.filter((x) => x.materiaId === m.id).length;
    if (n || a) {
      const ok = await confirm({ title: `Apagar ${m.nome}?`, message: `Também somem ${n} ${n === 1 ? 'nota' : 'notas'} e ${a} ${a === 1 ? 'aula' : 'aulas'} do horário. Dá para desfazer logo depois.`, confirmLabel: 'Apagar matéria', danger: true });
      if (!ok) return;
    }
    update((d) => {
      d.materias = d.materias.filter((x) => x.id !== m.id);
      d.notas = d.notas.filter((x) => x.materiaId !== m.id);
      d.aulas = d.aulas.filter((x) => x.materiaId !== m.id);
      d.faltas = d.faltas.filter((x) => x.materiaId !== m.id);
      d.eventos.forEach((e) => { if (e.materiaId === m.id) e.materiaId = null; });
    }, { undo: `${m.nome} apagada.` });
  };

  if (editando) return <MateriaModal ctx={ctx} materiaId={editando === 'nova' ? null : editando} onClose={() => setEditando(null)} />;

  return (
    <Modal title={`Matérias de ${periodo.nome}`} onClose={onClose} footer={<><span className="spacer" /><button type="button" className="btn" onClick={() => setEditando('nova')}><Plus /> Nova matéria</button><button type="button" className="btn primary" onClick={onClose}>Pronto</button></>}>
      {materias.length > 0 ? (
        <ul className="list sheet" style={{ marginBottom: 14 }}>
          {materias.map((m) => (
            <li key={m.id} style={{ padding: '8px 8px 8px 14px' }}>
              <span className="dot" style={{ background: corDe(m.cor, escuro) }} />
              <span className="grow">
                <span className="t1">{m.nome}</span>
                <span className="t2" style={{ display: 'block' }}>{[m.professor, m.sala && `sala ${m.sala}`, temFormulaPropria(m) && 'conta própria', m.foraDaMedia && 'fora da média geral'].filter(Boolean).join(', ') || 'Sem professor cadastrado'}</span>
              </span>
              <button type="button" className="btn ghost icon small" onClick={() => setEditando(m.id)} aria-label={`Editar ${m.nome}`} title="Editar"><Pencil /></button>
              <button type="button" className="btn ghost icon small" onClick={() => apagar(m)} aria-label={`Apagar ${m.nome}`} title="Apagar"><Trash2 /></button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ marginTop: 0 }}>Nenhuma matéria ainda. Escolha abaixo ou crie uma nova.</p>
      )}
      {sugestoes.length > 0 && (
        <>
          <div className="small" style={{ fontWeight: 650, color: 'var(--ink-2)', marginBottom: 8 }}>Adicionar rápido</div>
          <div className="toggle-chips">
            {sugestoes.map((s) => <button key={s} type="button" aria-pressed={false} onClick={() => addRapida(s)}><Plus /> {s}</button>)}
          </div>
        </>
      )}
    </Modal>
  );
}

function MateriaModal({ ctx, materiaId, onClose, abrirConta = false }) {
  const { data, update, periodo, escuro } = ctx;
  const original = materiaId ? data.materias.find((m) => m.id === materiaId) : null;
  const tipo = TIPOS_ETAPA[periodo.tipo];
  const porEtapaSalvo = (original && original.formulasEtapa) || {};
  const [f, setF] = useState(() => ({
    nome: original ? original.nome : '', cor: original ? original.cor : nextColor(materiasDo(data, periodo.id)),
    professor: original ? original.professor : '', sala: original ? original.sala : '',
    totalAulas: original && original.totalAulas ? String(original.totalAulas) : '',
    formulaEtapa: original ? original.formulaEtapa : '', formulaFinal: original ? original.formulaFinal : '',
    porEtapa: Object.fromEntries(periodo.etapas.map((e) => [e.id, porEtapaSalvo[e.id] || ''])),
    foraDaMedia: Boolean(original && original.foraDaMedia),
  }));
  const [iguais, setIguais] = useState(() => !periodo.etapas.some((e) => porEtapaSalvo[e.id]));
  const [erro, setErro] = useState('');
  const [avancado, setAvancado] = useState(abrirConta || Boolean(original && (temFormulaPropria(original) || original.totalAulas || original.foraDaMedia)));
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const geralIgual = periodo.etapas.every((e) => e.formula === periodo.etapas[0].formula);

  const salvar = () => {
    const nome = f.nome.trim();
    if (!nome) return setErro('Digite o nome da matéria.');
    if (materiasDo(data, periodo.id).some((m) => m.id !== materiaId && m.nome.toLowerCase() === nome.toLowerCase())) return setErro(`Já existe ${nome} neste período.`);
    const total = parseNum(f.totalAulas);
    if (Number.isNaN(total) || (total !== null && !(total > 0 && Number.isInteger(total)))) return setErro('O total de aulas precisa ser um número inteiro.');
    const conferir = iguais ? [['formulaEtapa', f.formulaEtapa]] : periodo.etapas.map((e) => [e.nome, f.porEtapa[e.id] || '']);
    for (const [k, v] of [...conferir, ['final', f.formulaFinal]]) {
      if (v.trim() && !compile(v).ok) return setErro(`A conta ${k === 'final' ? 'da média final' : k === 'formulaEtapa' ? `de cada ${tipo.nome.toLowerCase()}` : `do ${k}`} tem um erro: ${compile(v).error}`);
    }
    const porEtapa = iguais ? {} : Object.fromEntries(periodo.etapas.map((e) => [e.id, (f.porEtapa[e.id] || '').trim()]).filter(([, v]) => v));
    const dados = {
      nome, cor: f.cor, professor: f.professor.trim(), sala: f.sala.trim(), totalAulas: total,
      formulaEtapa: iguais ? f.formulaEtapa.trim() : '', formulasEtapa: porEtapa, formulaFinal: f.formulaFinal.trim(), foraDaMedia: f.foraDaMedia,
    };
    update((d) => {
      if (original) Object.assign(d.materias.find((m) => m.id === original.id), dados);
      else d.materias.push({ ...makeMateria(periodo.id, nome, f.cor), ...dados });
    }, { msg: original ? 'Matéria salva.' : `${nome} adicionada.` });
    onClose();
  };

  return (
    <Modal title={original ? `Editar ${original.nome}` : 'Nova matéria'} size={avancado ? 'wide' : ''} onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>Voltar</button><button type="button" className="btn primary" onClick={salvar}>Salvar</button></>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <Field label="Nome" id="m-nome">
          <input id="m-nome" className="input" value={f.nome} onChange={(e) => set('nome')(e.target.value)} maxLength={50} list="m-sug" />
          <datalist id="m-sug">{MATERIAS_SUGERIDAS.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <div className="field">
          <span className="label">Cor</span>
          <div className="swatches" role="radiogroup" aria-label="Cor da matéria">
            {CORES.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={f.cor === c.id} aria-label={c.id} className="swatch" style={{ background: escuro ? c.escuro : c.claro }} onClick={() => set('cor')(c.id)}>
                {f.cor === c.id && <Check />}
              </button>
            ))}
          </div>
        </div>
        <div className="grid2">
          <Field label="Professor (opcional)" id="m-prof">
            <input id="m-prof" className="input" value={f.professor} onChange={(e) => set('professor')(e.target.value)} maxLength={60} />
          </Field>
          <Field label="Sala (opcional)" id="m-sala">
            <input id="m-sala" className="input" value={f.sala} onChange={(e) => set('sala')(e.target.value)} maxLength={20} />
          </Field>
        </div>
        {avancado ? (
          <>
            <div className="formula-box" style={{ margin: 0 }}>
              <div className="top">
                <span className="t">Conta da média {f.nome.trim() ? `de ${f.nome.trim()}` : 'desta matéria'}</span>
                <span className="spacer" />
                {periodo.etapas.length > 1 && (
                  <label className="check small" style={{ alignItems: 'center' }}>
                    <input type="checkbox" checked={iguais} onChange={(e) => setIguais(e.target.checked)} />
                    <span>A mesma em todos os {tipo.plural}</span>
                  </label>
                )}
              </div>
              <div className="stack" style={{ gap: 12 }}>
                {iguais ? (
                  <FormulaInput
                    id="m-fe"
                    label={`Cada ${tipo.nome.toLowerCase()}`}
                    value={f.formulaEtapa}
                    onChange={set('formulaEtapa')}
                    contexto="etapa"
                    ctx={ctx}
                    opcional
                    hintVazio={`Em branco: usa a conta geral do período${geralIgual ? ` (${periodo.etapas[0].formula})` : ''}.`}
                  />
                ) : (
                  periodo.etapas.map((e) => (
                    <FormulaInput
                      key={e.id}
                      id={`m-fe-${e.id}`}
                      label={`${e.nome} (${e.codigo})`}
                      value={f.porEtapa[e.id] || ''}
                      onChange={(v) => setF((x) => ({ ...x, porEtapa: { ...x.porEtapa, [e.id]: v } }))}
                      contexto="etapa"
                      ctx={ctx}
                      etapaId={e.id}
                      opcional
                      hintVazio={`Em branco: usa a conta geral (${e.formula}).`}
                    />
                  ))
                )}
                <FormulaInput id="m-ff" label="Média final" value={f.formulaFinal} onChange={set('formulaFinal')} contexto="final" ctx={ctx} opcional hintVazio={`Em branco: usa a conta geral (${periodo.formulaFinal}).`} />
              </div>
              <p className="small muted" style={{ margin: '10px 0 0' }}>
                Bônus entram sozinhos: são somados na média da parte, sem passar de {fmtNota(periodo.notaMaxima, 0)}. Para decidir onde eles entram, use <span className="code">BONUS</span> na conta.
              </p>
            </div>
            <div className="set-row" style={{ padding: 0, border: 0 }}>
              <div className="txt">
                <div className="t">Fora da média geral</div>
                <div className="d">Para matérias que não entram na média geral do período, como as que só têm conceito.</div>
              </div>
              <Switch checked={f.foraDaMedia} onChange={set('foraDaMedia')} label="Fora da média geral" />
            </div>
            <Field label="Total de aulas no período (opcional)" id="m-tot" hint="Em branco: o app calcula pelo horário e pelas datas do período">
              <input id="m-tot" className="input" inputMode="numeric" value={f.totalAulas} onChange={(e) => set('totalAulas')(e.target.value)} />
            </Field>
          </>
        ) : (
          <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setAvancado(true)}>Esta matéria calcula a média de um jeito diferente?</button>
        )}
        {erro && <div className="err" role="alert" style={{ color: 'var(--red)', fontWeight: 560 }}>{erro}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function presetsEtapa(periodo) {
  return [
    { f: 'MEDIA', nome: 'Média das avaliações (com pesos)' },
    { f: 'SOMA', nome: 'Soma dos pontos' },
    { f: '(P1 + P2) / 2', nome: 'Média de P1 e P2' },
    { f: '(P1*2 + P2*3) / 5', nome: 'Ponderada: P1 peso 2, P2 peso 3' },
    { f: 'P1*40% + P2*60%', nome: 'Porcentagem: P1 40%, P2 60%' },
    { f: 'max(MEDIA; REC)', nome: 'Recuperação substitui se for maior' },
    { f: `se(MEDIA >= ${fmtNota(periodo.mediaMinima, 1).replace(/,0$/, '')}; MEDIA; (MEDIA + REC) / 2)`, nome: 'Abaixo da média: média com a recuperação' },
  ];
}
function presetsFinal(periodo) {
  const n = periodo.etapas.length;
  const codes = periodo.etapas.map((e) => e.codigo);
  const pesos = codes.map((c, i) => `${c}*${i + 1}`).join(' + ');
  const soma = (n * (n + 1)) / 2;
  const min = fmtNota(periodo.mediaMinima, 1).replace(/,0$/, '');
  return [
    { f: 'MEDIA', nome: `Média dos ${TIPOS_ETAPA[periodo.tipo].plural}` },
    { f: 'SOMA', nome: `Soma dos ${TIPOS_ETAPA[periodo.tipo].plural}` },
    ...(n > 1 ? [{ f: `(${pesos}) / ${soma}`, nome: `Pesos crescentes (1 a ${n})` }] : []),
    { f: `se(MEDIA >= ${min}; MEDIA; (MEDIA + REC) / 2)`, nome: 'Com recuperação final: média com a REC' },
    { f: `se(MEDIA >= ${min}; MEDIA; max(MEDIA; REC))`, nome: 'Com recuperação final: fica a maior' },
  ];
}

function conhecidas(ctx, contexto, etapaId) {
  const { data, periodo } = ctx;
  const ids = new Set(materiasDo(data, periodo.id).map((m) => m.id));
  const set = new Set(['MEDIA', 'SOMA', 'BONUS']);
  if (contexto === 'final') {
    periodo.etapas.forEach((e) => set.add(e.codigo));
    data.notas.filter((n) => ids.has(n.materiaId) && n.etapaId === FINAL).forEach((n) => set.add(normalizeName(n.sigla)));
  } else {
    data.notas.filter((n) => ids.has(n.materiaId) && n.etapaId !== FINAL && (!etapaId || n.etapaId === etapaId)).forEach((n) => set.add(normalizeName(n.sigla)));
  }
  return set;
}

function FormulaInput({ id, label, value, onChange, contexto, ctx, etapaId, opcional, hintVazio }) {
  const { periodo, data } = ctx;
  const casas = data.settings.casas;
  const presets = contexto === 'final' ? presetsFinal(periodo) : presetsEtapa(periodo);
  const vazio = !value.trim();
  const c = vazio ? null : compile(value);
  let status = null;
  if (vazio) status = opcional ? { ok: true, texto: hintVazio } : { ok: false, texto: 'Escreva uma fórmula, ou escolha um modelo.' };
  else if (!c.ok) status = { ok: false, texto: c.error };
  else {
    const known = conhecidas(ctx, contexto, etapaId);
    const novas = c.vars.filter((v) => !known.has(v));
    const nmax = periodo.notaMaxima;
    const exemplo = Math.min(nmax, 7);
    // exemplo usa o vale de cada nota (7 de 10 numa de 5 = 3,5)
    const ids = new Set(materiasDo(data, periodo.id).map((m) => m.id));
    const valeDaSigla = (v) => {
      const n = data.notas.find((x) => ids.has(x.materiaId) && tipoDe(x) === 'avaliacao' && normalizeName(x.sigla) === v && x.vale > 0);
      return n ? n.vale : nmax;
    };
    const vals = Object.fromEntries(c.vars.map((v) => [v, contexto === 'final' ? exemplo : (exemplo * valeDaSigla(v)) / nmax]));
    const r = tryEvaluate(c.ast, vals);
    const diferentes = c.vars.filter((v) => Math.abs(vals[v] - exemplo) > 1e-9);
    const quais = diferentes.length ? ` (${c.vars.map((v) => `${v} ${fmtNota(vals[v], casas)}${Math.abs(vals[v] - exemplo) > 1e-9 ? ` de ${fmtNota(valeDaSigla(v), casas).replace(/,0+$/, '')}` : ''}`).join(', ')})` : '';
    const ex = r.value !== undefined ? ` Se tudo for ${fmtNota(exemplo, casas)}${diferentes.length ? ' de 10' : ''}${quais}, o resultado é ${fmtNota(r.value, casas)}.` : r.error ? ` Atenção: ${r.error}` : '';
    const naoDa = r.value !== undefined && Math.abs(r.value - exemplo) > 0.05;
    const avisos = [
      novas.length ? `${lista(novas)} ainda não ${novas.length === 1 ? 'existe' : 'existem'} em nenhuma matéria. Até ser lançada, a média mostra o que falta.` : null,
      naoDa && contexto !== 'final'
        ? `Com tudo ${fmtNota(exemplo, casas)}, a conta dá ${fmtNota(r.value, casas)} e não ${fmtNota(exemplo, casas)}. Isso é normal quando alguma avaliação vale menos que ${fmtNota(nmax, 0)} (por exemplo, duas provas de 5 cada): lance essas notas com “Vale quanto” igual ao valor delas e a média sai certa. Se todas valem ${fmtNota(nmax, 0)}, confira os pesos da fórmula.`
        : null,
      naoDa && contexto === 'final' ? `Com tudo ${fmtNota(exemplo, casas)}, a média final dá ${fmtNota(r.value, casas)} e não ${fmtNota(exemplo, casas)}: confira os pesos da fórmula.` : null,
    ].filter(Boolean);
    status = {
      ok: true,
      texto: `Fórmula válida.${ex}`,
      aviso: avisos.length ? avisos.join(' ') : null,
    };
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="inline">
        <input id={id} className={`input mono ${status && !status.ok ? 'bad' : ''}`} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} maxLength={300} placeholder={opcional ? 'Usar a fórmula geral' : 'MEDIA'} />
        <select className="select" style={{ width: 150, flex: 'none' }} value="" onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Escolher um modelo de fórmula">
          <option value="">Modelos…</option>
          {presets.map((p) => <option key={p.f} value={p.f}>{p.nome}</option>)}
        </select>
      </div>
      {status && (
        <div className={`fstatus ${status.ok ? (vazio ? '' : 'ok') : 'bad'}`} style={vazio && status.ok ? { color: 'var(--ink-3)' } : null}>
          {!vazio && (status.ok ? <CircleCheck /> : <CircleAlert />)}
          <span>{status.texto}</span>
        </div>
      )}
      {status && status.aviso && <div className="fstatus" style={{ color: 'var(--warn)' }}><CircleHelp /><span>{status.aviso}</span></div>}
    </div>
  );
}

function resumoConta(m, periodo) {
  const partes = [];
  if (m.formulaEtapa) partes.push(`cada ${TIPOS_ETAPA[periodo.tipo].nome.toLowerCase()}: ${m.formulaEtapa}`);
  for (const e of periodo.etapas) if (m.formulasEtapa && m.formulasEtapa[e.id]) partes.push(`${e.codigo}: ${m.formulasEtapa[e.id]}`);
  if (m.formulaFinal) partes.push(`final: ${m.formulaFinal}`);
  return partes.join('; ');
}

function FormulasModal({ ctx, onClose, onMateria }) {
  const { data, periodo, update, escuro } = ctx;
  const tipo = TIPOS_ETAPA[periodo.tipo];
  const materias = materiasDo(data, periodo.id);
  const [iguais, setIguais] = useState(() => periodo.etapas.every((e) => e.formula === periodo.etapas[0].formula));
  const [etapas, setEtapas] = useState(() => periodo.etapas.map((e) => e.formula));
  const [final, setFinal] = useState(periodo.formulaFinal);
  const [erro, setErro] = useState('');
  const lista = iguais ? periodo.etapas.map(() => etapas[0]) : etapas;
  const mudou = lista.some((x, i) => x.trim() !== periodo.etapas[i].formula) || final.trim() !== periodo.formulaFinal;

  const gravar = () => {
    for (let i = 0; i < lista.length; i++) {
      if (!lista[i].trim()) return setErro(`Falta a fórmula do ${periodo.etapas[i].nome}.`), false;
      const c = compile(lista[i]);
      if (!c.ok) return setErro(`${iguais ? 'A fórmula das partes' : `O ${periodo.etapas[i].nome}`} tem um erro: ${c.error}`), false;
    }
    if (!final.trim()) return setErro('Falta a fórmula da média final.'), false;
    if (!compile(final).ok) return setErro(`A fórmula da média final tem um erro: ${compile(final).error}`), false;
    if (mudou) {
      update((d) => {
        const p = d.periodos.find((x) => x.id === periodo.id);
        p.etapas.forEach((e, i) => { e.formula = lista[i].trim(); });
        p.formulaFinal = final.trim();
      }, { msg: 'Fórmulas salvas. As médias já foram recalculadas.' });
    }
    return true;
  };
  const salvar = () => gravar() && onClose();
  const abrirMateria = (id) => gravar() && onMateria(id);

  return (
    <Modal
      title="Fórmulas das médias"
      sub={`Como sai a média de cada ${tipo.nome.toLowerCase()} e a média final de ${periodo.nome}.`}
      onClose={onClose}
      size="wide"
      footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn primary" onClick={salvar}>Salvar fórmulas</button></>}
    >
      <div className="formula-box">
        <div className="top">
          <span className="t">Média de cada {tipo.nome.toLowerCase()}</span>
          <span className="spacer" />
          <label className="check small" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={iguais} onChange={(e) => setIguais(e.target.checked)} />
            <span>A mesma para todos</span>
          </label>
        </div>
        {iguais ? (
          <FormulaInput id="f-todas" label={`Fórmula (vale para ${periodo.etapas.map((e) => e.codigo).join(', ')})`} value={etapas[0]} onChange={(v) => setEtapas((xs) => xs.map((_, i) => (i === 0 ? v : xs[i])))} contexto="etapa" ctx={ctx} />
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            {periodo.etapas.map((e, i) => (
              <FormulaInput key={e.id} id={`f-${e.id}`} label={`${e.nome} (${e.codigo})`} value={etapas[i]} onChange={(v) => setEtapas((xs) => xs.map((x, j) => (j === i ? v : x)))} contexto="etapa" ctx={ctx} etapaId={e.id} />
            ))}
          </div>
        )}
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          Use a sigla de cada avaliação, como <span className="code">P1</span> ou <span className="code">TRAB</span>. <span className="code">MEDIA</span> é a média de todas (com os pesos) e <span className="code">SOMA</span> soma os pontos.
        </p>
      </div>
      <div className="formula-box">
        <div className="top"><span className="t">Média final do período</span></div>
        <FormulaInput id="f-final" label="Fórmula" value={final} onChange={setFinal} contexto="final" ctx={ctx} />
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          Use {periodo.etapas.slice(0, 4).map((e) => <span key={e.id}><span className="code">{e.codigo}</span>{' '}</span>)}{periodo.etapas.length > 4 ? 'e os outros códigos ' : ''}para a média de cada {tipo.nome.toLowerCase()}, <span className="code">MEDIA</span> para a média de todos e a sigla das notas finais, como <span className="code">REC</span>.
        </p>
      </div>
      {materias.length > 0 && (
        <div className="formula-box">
          <div className="top"><span className="t">Matérias com conta diferente</span></div>
          <p className="small muted" style={{ margin: '0 0 10px' }}>
            Se uma matéria calcula a média de outro jeito, ou só um {tipo.nome.toLowerCase()} dela é diferente, dê a ela uma conta própria. As outras continuam com as fórmulas acima.
          </p>
          <ul className="list sheet conta-list">
            {materias.map((m) => {
              const resumo = resumoConta(m, periodo);
              return (
                <li key={m.id}>
                  <span className="dot" style={{ background: corDe(m.cor, escuro) }} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="t1" style={{ display: 'block' }}>{m.nome}</span>
                    <span className={`t2 ${resumo ? 'mono' : ''}`} style={{ display: 'block' }}>{resumo || 'Usa as fórmulas gerais'}{m.foraDaMedia ? (resumo ? '. Fora da média geral' : ', fora da média geral') : ''}</span>
                  </span>
                  <button type="button" className="btn small" onClick={() => abrirMateria(m.id)}>{resumo ? 'Mudar a conta' : 'Dar conta própria'}</button>
                </li>
              );
            })}
          </ul>
          {mudou && <p className="small faint" style={{ margin: '8px 0 0' }}>Ao abrir uma matéria, as fórmulas acima são salvas antes.</p>}
        </div>
      )}
      <details className="help">
        <summary>Como escrever uma fórmula</summary>
        <div className="help-grid">
          <span className="code">+ - * /</span><span>somar, subtrair, multiplicar, dividir</span>
          <span className="code">( )</span><span>o que está dentro é calculado primeiro</span>
          <span className="code">0,4 ou 40%</span><span>números com vírgula e porcentagem</span>
          <span className="code">max(P1; REC)</span><span>a maior nota (também: maior)</span>
          <span className="code">min(P1; P2)</span><span>a menor nota (também: menor)</span>
          <span className="code">media(P1; P2; P3)</span><span>média só das que você escolher</span>
          <span className="code">arred(x; 1)</span><span>arredonda com 1 casa (7,46 vira 7,5)</span>
          <span className="code">arredmeio(x)</span><span>arredonda para o meio ponto mais próximo (6,74 vira 6,5)</span>
          <span className="code">se(MEDIA &gt;= 6; MEDIA; REC)</span><span>se a condição for verdade usa o primeiro, senão o segundo</span>
          <span className="code">BONUS</span><span>soma dos bônus da parte. Sem citar, o bônus é somado no fim, sem passar da nota máxima</span>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Separe os valores das funções com ponto e vírgula. Letras maiúsculas ou minúsculas tanto faz.</p>
      </details>
      {erro && <div className="err" role="alert" style={{ color: 'var(--red)', fontWeight: 560, marginTop: 12 }}>{erro}</div>}
    </Modal>
  );
}
