import { useState } from 'react';
import { ChartLine, TrendingUp, TrendingDown, MoveRight, Table2 } from 'lucide-react';
import { Empty, Seg } from '../components/ui.jsx';
import LineChart from '../components/LineChart.jsx';
import { materiasDo, corDe, TIPOS_ETAPA } from '../lib/model.js';
import { serieDesempenho, finalResult } from '../lib/grades.js';
import { fmtNota, fmtDataCurta } from '../lib/format.js';

function Tendencia({ pontos, casas }) {
  if (pontos.length < 2) return <span className="trend flat"><MoveRight /> Só uma nota até agora</span>;
  const a = pontos[pontos.length - 2].valor;
  const b = pontos[pontos.length - 1].valor;
  const dif = b - a;
  if (Math.abs(dif) < 0.05) return <span className="trend flat"><MoveRight /> Igual à anterior</span>;
  return dif > 0
    ? <span className="trend up"><TrendingUp /> Subiu {fmtNota(dif, casas)} desde a anterior</span>
    : <span className="trend down"><TrendingDown /> Caiu {fmtNota(-dif, casas)} desde a anterior</span>;
}

export default function Desempenho({ ctx }) {
  const { data, periodo, escuro } = ctx;
  const [modo, setModo] = useState('avaliacoes');
  const [selId, setSelId] = useState(null);
  const [tabela, setTabela] = useState(false);
  const casas = data.settings.casas;

  const head = (
    <div className="page-head">
      <div>
        <h1 className="hand">Desempenho</h1>
        <div className="sub">Como suas notas andam em cada matéria{periodo ? `, em ${periodo.nome}` : ''}.</div>
      </div>
      {periodo && (
        <div className="actions">
          <Seg label="O que mostrar" value={modo} onChange={setModo} options={[{ value: 'avaliacoes', label: 'Cada avaliação' }, { value: 'etapas', label: `Média de cada ${TIPOS_ETAPA[periodo.tipo].nome.toLowerCase()}` }]} />
        </div>
      )}
    </div>
  );

  if (!periodo) return <>{head}<div className="sheet"><Empty icon={ChartLine} title="Nenhum período ainda" /></div></>;
  const materias = materiasDo(data, periodo.id);
  const series = materias.map((m) => ({ m, pontos: serieDesempenho(data, periodo, m, modo) }));
  const comDados = series.filter((s) => s.pontos.length);
  if (!comDados.length) {
    return (
      <>
        {head}
        <div className="sheet">
          <Empty icon={ChartLine} title="Ainda não tem notas para desenhar" action={<button type="button" className="btn primary" onClick={() => ctx.go('notas')}>Lançar notas</button>}>
            {modo === 'etapas' ? 'Assim que alguma média sair, o gráfico aparece aqui.' : 'Cada nota lançada vira um ponto no gráfico da matéria.'}
          </Empty>
        </div>
      </>
    );
  }

  const sel = comDados.find((s) => s.m.id === selId) || comDados[0];
  const fr = finalResult(data, periodo, sel.m);
  const vals = sel.pontos.map((p) => p.valor);
  const melhor = Math.max(...vals);
  const pior = Math.min(...vals);

  return (
    <>
      {head}
      <div className="sheet" style={{ marginBottom: 18 }}>
        <div className="sheet-head">
          <span className="dot" style={{ background: corDe(sel.m.cor, escuro), width: 12, height: 12 }} />
          <h2 style={{ fontSize: 19 }} className="hand">{sel.m.nome}</h2>
          <span className="spacer" />
          <Tendencia pontos={sel.pontos} casas={casas} />
        </div>
        <div className="stat-row" style={{ borderBottom: '1px solid var(--rule)' }}>
          <div className="stat">
            <div className="l">Média final{fr.parcial ? ' até agora' : ''}</div>
            <div className={`v ${fr.valor !== null && fr.valor + 1e-9 < periodo.mediaMinima ? 'low' : ''}`}>{fmtNota(fr.valor, casas)}</div>
            <div className="d">{fr.valor === null ? `Falta ${fr.faltam.join(', ')}` : fr.valor + 1e-9 < periodo.mediaMinima ? `Abaixo de ${fmtNota(periodo.mediaMinima, casas)}` : `Acima de ${fmtNota(periodo.mediaMinima, casas)}`}</div>
          </div>
          <div className="stat">
            <div className="l">{modo === 'etapas' ? 'Melhor média' : 'Melhor nota'}</div>
            <div className="v">{fmtNota(melhor, casas)}</div>
            <div className="d">{sel.pontos.filter((p) => p.valor === melhor).map((p) => p.rotulo + (p.grupo ? ` (${p.grupo})` : '')).join(', ')}</div>
          </div>
          <div className="stat">
            <div className="l">{modo === 'etapas' ? 'Pior média' : 'Pior nota'}</div>
            <div className={`v ${pior + 1e-9 < periodo.mediaMinima ? 'low' : ''}`}>{fmtNota(pior, casas)}</div>
            <div className="d">{sel.pontos.filter((p) => p.valor === pior).map((p) => p.rotulo + (p.grupo ? ` (${p.grupo})` : '')).join(', ')}</div>
          </div>
        </div>
        <div style={{ padding: '14px 18px 6px' }}>
          <LineChart
            pontos={sel.pontos}
            max={periodo.notaMaxima}
            min={periodo.mediaMinima}
            casas={casas}
            height={300}
            chaveAnimacao={sel.m.id + modo}
            label={`Notas de ${sel.m.nome}: ${sel.pontos.map((p) => `${p.rotulo} ${fmtNota(p.valor, casas)}`).join(', ')}`}
          />
        </div>
        <div className="inline" style={{ padding: '4px 18px 12px' }}>
          <span className="small faint">{modo === 'avaliacoes' ? 'Cada ponto é uma avaliação, já na escala de 0 a ' + fmtNota(periodo.notaMaxima, 0) + '. Use as setas do teclado para percorrer.' : 'Cada ponto é a média de uma parte do período.'}</span>
          <span className="spacer" />
          <button type="button" className="btn ghost small" onClick={() => setTabela((t) => !t)} aria-expanded={tabela}><Table2 /> {tabela ? 'Esconder tabela' : 'Ver como tabela'}</button>
        </div>
        {tabela && (
          <table className="tbl" style={{ borderTop: '1px solid var(--rule)' }}>
            <thead>
              <tr>
                <th>{modo === 'etapas' ? 'Parte' : 'Avaliação'}</th>
                {modo === 'avaliacoes' && <th>Parte</th>}
                {modo === 'avaliacoes' && <th>Data</th>}
                <th className="r">Nota</th>
              </tr>
            </thead>
            <tbody>
              {sel.pontos.map((p, i) => (
                <tr key={p.id + i}>
                  <td>{p.detalhe}</td>
                  {modo === 'avaliacoes' && <td>{p.grupo}</td>}
                  {modo === 'avaliacoes' && <td>{p.data ? fmtDataCurta(p.data) : '—'}</td>}
                  <td className={`r ${p.valor + 1e-9 < periodo.mediaMinima ? 'low' : ''}`}>
                    {fmtNota(p.valor, casas)}
                    {p.vale && Math.abs(p.vale - periodo.notaMaxima) > 1e-9 ? <span className="faint small"> ({fmtNota(p.bruto, casas)} de {fmtNota(p.vale, casas)})</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="section-title">Todas as matérias</h2>
      <div className="multiples">
        {series.map(({ m, pontos }) => {
          const ultimo = pontos.length ? pontos[pontos.length - 1].valor : null;
          return (
            <button key={m.id} type="button" className="multiple" aria-pressed={sel.m.id === m.id} onClick={() => setSelId(m.id)} disabled={!pontos.length} style={!pontos.length ? { cursor: 'default', opacity: 0.6 } : null}>
              <div className="top">
                <span className="dot" style={{ background: corDe(m.cor, escuro) }} />
                <span className="nm">{m.nome}</span>
                <span className={`v ${ultimo !== null && ultimo + 1e-9 < periodo.mediaMinima ? 'low' : ''}`}>{ultimo === null ? '' : fmtNota(ultimo, casas)}</span>
              </div>
              {pontos.length ? (
                <LineChart pontos={pontos} max={periodo.notaMaxima} min={periodo.mediaMinima} casas={casas} height={78} mini chaveAnimacao={m.id + modo} label={`Notas de ${m.nome}`} />
              ) : (
                <div className="small faint" style={{ height: 78, display: 'grid', placeItems: 'center' }}>Sem notas ainda</div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
