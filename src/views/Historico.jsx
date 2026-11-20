import { useState } from 'react';
import { History, FileDown, Pencil } from 'lucide-react';
import { Empty, Status, Seg } from '../components/ui.jsx';
import { corDe, TIPOS_ETAPA } from '../lib/model.js';
import { finalResult, situacao, SITUACAO_TEXTO, mediaGeral, FINAL, valeDe, tipoDe } from '../lib/grades.js';
import { frequencia } from '../lib/schedule.js';
import { fmtNota, fmtData } from '../lib/format.js';
import { relatorioHTML } from '../lib/report.js';

export default function Historico({ ctx }) {
  const { data } = ctx;
  const [aba, setAba] = useState('boletins');
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="hand">Histórico</h1>
          <div className="sub">Todos os períodos, com a média final e a situação de cada matéria.</div>
        </div>
        <div className="actions">
          <Seg label="Ver" value={aba} onChange={setAba} options={[{ value: 'boletins', label: 'Boletins' }, { value: 'notas', label: 'Todas as notas' }]} />
        </div>
      </div>
      {!data.periodos.length ? (
        <div className="sheet"><Empty icon={History} title="Nada por aqui ainda">Os períodos que você criar aparecem aqui, do mais novo para o mais antigo.</Empty></div>
      ) : aba === 'boletins' ? <Boletins ctx={ctx} /> : <TodasNotas ctx={ctx} />}
    </>
  );
}

function Boletins({ ctx }) {
  const { data, api, toast, escuro, abrir } = ctx;
  const casas = data.settings.casas;
  const periodos = [...data.periodos].reverse();

  const exportar = async (lista, titulo, arquivo) => {
    const r = await api.exportarPdf({ nome: arquivo, html: relatorioHTML(data, lista, titulo) });
    if (r && r.ok) toast('PDF salvo.');
    else if (r && !r.cancelado) toast(r.erro || 'Não deu para gerar o PDF.', { tipo: 'erro' });
  };

  return (
    <>
      <div className="inline" style={{ marginBottom: 16 }}>
        <span className="muted">{periodos.length} {periodos.length === 1 ? 'período' : 'períodos'}</span>
        <span className="spacer" />
        <button type="button" className="btn small" onClick={() => exportar(data.periodos, 'Histórico escolar', 'historico-escolar.pdf')}><FileDown /> Histórico completo em PDF</button>
      </div>
      {periodos.map((p) => {
        const materias = data.materias.filter((m) => m.periodoId === p.id);
        const geral = mediaGeral(data, p, materias);
        const linhas = materias.map((m) => ({ m, r: finalResult(data, p, m), f: frequencia(data, p, m) }));
        const aprov = linhas.filter(({ r }) => situacao(p, r) === 'aprovado').length;
        const temParcial = linhas.some(({ r }) => r.parcial);
        return (
          <section key={p.id} className="hist-periodo">
            <div className="hist-head">
              <h2 className="hand">{p.nome}</h2>
              <Status tipo={p.concluido ? 'aprovado' : 'andamento'}>{p.concluido ? 'Concluído' : 'Em andamento'}</Status>
              <span className="muted small">
                {p.etapas.length} {p.etapas.length === 1 ? TIPOS_ETAPA[p.tipo].nome.toLowerCase() : TIPOS_ETAPA[p.tipo].plural}
                {geral !== null ? `, média geral ${fmtNota(geral, casas)}${temParcial ? ' até agora' : ''}` : ''}
                {materias.length ? `, ${aprov} de ${materias.length} aprovadas` : ''}
              </span>
              <span className="spacer" />
              <button type="button" className="btn ghost small" onClick={() => abrir('periodo', { periodoId: p.id })}><Pencil /> Editar</button>
              <button type="button" className="btn small" onClick={() => exportar([p], `Boletim ${p.nome}`, `boletim-${p.nome.replace(/[^\w-]+/g, '-')}.pdf`)}><FileDown /> Boletim em PDF</button>
            </div>
            {materias.length === 0 ? (
              <div className="sheet muted" style={{ padding: 16 }}>Sem matérias neste período.</div>
            ) : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Matéria</th>
                      {p.etapas.length <= 8 && p.etapas.map((e) => <th key={e.id} className="c">{e.codigo}</th>)}
                      <th className="c">Média final</th>
                      <th className="c">Frequência</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map(({ m, r, f }) => {
                      const sit = situacao(p, r);
                      return (
                        <tr key={m.id}>
                          <td><div className="subject"><span className="dot" style={{ background: corDe(m.cor, escuro) }} /><span className="nm">{m.nome}</span></div></td>
                          {p.etapas.length <= 8 && r.etapas.map((e) => (
                            <td key={e.etapa.id} className={`c ${e.valor !== null && e.valor + 1e-9 < p.mediaMinima ? 'low' : ''} ${e.parcial ? 'partial' : ''}`}>{fmtNota(e.valor, casas)}</td>
                          ))}
                          <td className={`c final ${r.valor !== null && r.valor + 1e-9 < p.mediaMinima ? 'low' : ''} ${r.parcial ? 'partial' : ''}`}>{fmtNota(r.valor, casas)}</td>
                          <td className={`c ${f.podeFaltar !== null && f.podeFaltar < 0 ? 'low' : ''}`}>{f.total ? `${Math.round(f.percentual)}%` : f.faltas ? `${f.faltas} ${f.faltas === 1 ? 'falta' : 'faltas'}` : '—'}</td>
                          <td><Status tipo={sit}>{SITUACAO_TEXTO[sit]}</Status></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}

function TodasNotas({ ctx }) {
  const { data, escuro, abrir, update } = ctx;
  const casas = data.settings.casas;
  const [periodoId, setPeriodoId] = useState(ctx.periodo ? ctx.periodo.id : '');
  const [materiaId, setMateriaId] = useState('');
  const periodo = data.periodos.find((p) => p.id === periodoId);
  const materias = data.materias.filter((m) => !periodoId || m.periodoId === periodoId);
  const ids = new Set(materias.map((m) => m.id));
  const notas = data.notas
    .filter((n) => ids.has(n.materiaId) && (!materiaId || n.materiaId === materiaId))
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  const mat = (id) => data.materias.find((m) => m.id === id);
  const per = (m) => data.periodos.find((p) => p.id === m.periodoId);

  // so da pra editar no periodo atual
  const editar = (n) => {
    const m = mat(n.materiaId);
    if (m.periodoId !== data.settings.periodoAtualId) update((d) => { d.settings.periodoAtualId = m.periodoId; });
    setTimeout(() => abrir('nota', { notaId: n.id }), 0);
  };

  return (
    <>
      <div className="filters">
        <select className="select" value={periodoId} onChange={(e) => { setPeriodoId(e.target.value); setMateriaId(''); }} aria-label="Período">
          <option value="">Todos os períodos</option>
          {[...data.periodos].reverse().map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select className="select" value={materiaId} onChange={(e) => setMateriaId(e.target.value)} aria-label="Matéria">
          <option value="">Todas as matérias</option>
          {materias.map((m) => <option key={m.id} value={m.id}>{m.nome}{periodoId ? '' : ` (${per(m)?.nome})`}</option>)}
        </select>
        <span className="muted small">{notas.length} {notas.length === 1 ? 'nota' : 'notas'}</span>
      </div>
      {notas.length === 0 ? (
        <div className="sheet"><Empty icon={History} title="Nenhuma nota com esses filtros" /></div>
      ) : (
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Data</th><th>Matéria</th><th>Avaliação</th><th>Parte</th>{!periodoId && <th>Período</th>}<th className="r">Nota</th><th /></tr>
            </thead>
            <tbody>
              {notas.map((n) => {
                const m = mat(n.materiaId);
                const p = per(m);
                const etapa = p.etapas.find((e) => e.id === n.etapaId);
                const vale = valeDe(n, p);
                const tipo = tipoDe(n);
                const low = tipo !== 'bonus' && n.valor !== null && (n.valor / vale) * p.notaMaxima + 1e-9 < p.mediaMinima;
                return (
                  <tr key={n.id}>
                    <td className="muted">{n.data ? fmtData(n.data) : '—'}</td>
                    <td><div className="subject"><span className="dot" style={{ background: corDe(m.cor, escuro) }} /><span className="nm">{m.nome}</span></div></td>
                    <td>{tipo === 'oficial' ? <span className="muted">Média da escola</span> : <>{n.nome} <span className="code">{n.sigla}</span>{tipo === 'bonus' && <span className="faint small"> bônus</span>}</>}</td>
                    <td className="muted">{n.etapaId === FINAL ? 'Final' : etapa ? etapa.nome : ''}</td>
                    {!periodoId && <td className="muted">{p.nome}</td>}
                    <td className={`r ${low ? 'low' : ''}`} style={{ fontWeight: 650 }}>
                      {n.valor === null ? <span className="faint">a fazer</span> : tipo === 'bonus' ? `${n.valor > 0 ? '+' : ''}${fmtNota(n.valor, casas)}` : fmtNota(n.valor, casas)}
                      {tipo === 'avaliacao' && Math.abs(vale - p.notaMaxima) > 1e-9 && <span className="faint small"> de {fmtNota(vale, casas)}</span>}
                    </td>
                    <td className="r" style={{ width: 44 }}>
                      <button type="button" className="btn ghost icon small" onClick={() => editar(n)} aria-label={`Editar ${n.sigla} de ${m.nome}`} title="Editar"><Pencil /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {periodo && <p className="small faint" style={{ marginTop: 10 }}>Mostrando as notas de {periodo.nome}, das mais recentes para as mais antigas.</p>}
    </>
  );
}
