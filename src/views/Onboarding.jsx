import { useState } from 'react';
import { Plus, Check, ArrowLeft } from 'lucide-react';
import { Logo, Field } from '../components/ui.jsx';
import { TIPOS_ETAPA, MAX_ETAPAS, MATERIAS_SUGERIDAS, makePeriodo, makeMateria, nextColor } from '../lib/model.js';
import { parseNum } from '../lib/format.js';

const OPCOES = [
  { tipo: 'bimestre', n: 4, l: 'bimestres' },
  { tipo: 'trimestre', n: 3, l: 'trimestres' },
  { tipo: 'semestre', n: 2, l: 'semestres' },
  { tipo: 'outro', n: null, l: 'outro jeito' },
];

export default function Onboarding({ ctx }) {
  const { data, update } = ctx;
  const [passo, setPasso] = useState(0);
  const [opcao, setOpcao] = useState('trimestre');
  const [tipoOutro, setTipoOutro] = useState('etapa');
  const [qtd, setQtd] = useState('4');
  const [nome, setNome] = useState(String(new Date().getFullYear()));
  const [max, setMax] = useState('10');
  const [min, setMin] = useState('6');
  const [escolhidas, setEscolhidas] = useState([]);
  const [nova, setNova] = useState('');
  const [erro, setErro] = useState('');

  const avancar = () => {
    const nmax = parseNum(max);
    const nmin = parseNum(min);
    const q = parseNum(qtd);
    if (!nome.trim()) return setErro('Dê um nome ao período, como 2026 ou 3º semestre.');
    if (!(nmax > 0)) return setErro('A nota máxima precisa ser maior que zero.');
    if (!(nmin >= 0) || nmin > nmax) return setErro('A média para passar precisa estar entre 0 e a nota máxima.');
    if (opcao === 'outro' && !(q >= 1 && q <= MAX_ETAPAS && Number.isInteger(q))) return setErro(`Escolha de 1 a ${MAX_ETAPAS} etapas.`);
    setErro('');
    setPasso(1);
  };

  const toggle = (m) => setEscolhidas((xs) => (xs.includes(m) ? xs.filter((x) => x !== m) : [...xs, m]));
  const adicionar = (e) => {
    e.preventDefault();
    const n = nova.trim();
    if (n && !escolhidas.some((x) => x.toLowerCase() === n.toLowerCase())) setEscolhidas((xs) => [...xs, n]);
    setNova('');
  };

  const concluir = () => {
    const op = OPCOES.find((o) => o.tipo === opcao);
    const tipo = opcao === 'outro' ? tipoOutro : opcao;
    const p = makePeriodo({ nome: nome.trim(), tipo, quantidade: opcao === 'outro' ? parseNum(qtd) : op.n, notaMaxima: parseNum(max), mediaMinima: parseNum(min) });
    update((d) => {
      d.periodos.push(p);
      d.settings.periodoAtualId = p.id;
      for (const m of escolhidas) d.materias.push(makeMateria(p.id, m, nextColor(d.materias.filter((x) => x.periodoId === p.id))));
      d.onboarded = true;
    });
  };

  return (
    <div className="auth">
      <div className="auth-card wide">
        <div className="auth-brand">
          <Logo size={40} />
          <div>
            <div className="name hand">Caderneta</div>
            <div className="tag">Primeiros passos, {data.profile.nome}</div>
          </div>
        </div>
        <div className="steps" aria-hidden="true"><i className="on" /><i className={passo >= 1 ? 'on' : ''} /></div>

        {passo === 0 && (
          <div className="stack">
            <div>
              <h2>Como sua escola divide o ano?</h2>
              <p className="muted" style={{ margin: 0 }}>Dá para mudar depois. Cada parte tem a própria média, e o período tem a média final.</p>
            </div>
            <div className="choices" role="group" aria-label="Divisão do período">
              {OPCOES.map((o) => (
                <button key={o.tipo} type="button" className="choice" aria-pressed={opcao === o.tipo} onClick={() => setOpcao(o.tipo)}>
                  <div className="big">{o.n ?? '1 a 24'}</div>
                  <div className="l">{o.l}</div>
                </button>
              ))}
            </div>
            {opcao === 'outro' && (
              <div className="grid2">
                <Field label="Nome de cada parte" id="tipo">
                  <select id="tipo" className="select" value={tipoOutro} onChange={(e) => setTipoOutro(e.target.value)}>
                    {Object.entries(TIPOS_ETAPA).map(([k, t]) => <option key={k} value={k}>{t.nome}</option>)}
                  </select>
                </Field>
                <Field label="Quantas partes" id="qtd" hint={`De 1 a ${MAX_ETAPAS}`}>
                  <input id="qtd" className="input" type="number" min={1} max={MAX_ETAPAS} value={qtd} onChange={(e) => setQtd(e.target.value)} />
                </Field>
              </div>
            )}
            <div className="grid3">
              <Field label="Nome do período" id="pn" hint="Ex.: 2026, 1º ano">
                <input id="pn" className="input" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} />
              </Field>
              <Field label="Nota máxima" id="pmax">
                <input id="pmax" className="input" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
              </Field>
              <Field label="Média para passar" id="pmin">
                <input id="pmin" className="input" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
              </Field>
            </div>
            {erro && <div className="err" role="alert" style={{ color: 'var(--red)', fontWeight: 560 }}>{erro}</div>}
            <div className="inline" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn primary" onClick={avancar}>Continuar</button>
            </div>
          </div>
        )}

        {passo === 1 && (
          <div className="stack">
            <div>
              <h2>Quais matérias você tem?</h2>
              <p className="muted" style={{ margin: 0 }}>Toque para escolher. Professor, sala e cor você ajusta depois.</p>
            </div>
            <div className="toggle-chips">
              {[...MATERIAS_SUGERIDAS, ...escolhidas.filter((m) => !MATERIAS_SUGERIDAS.includes(m))].map((m) => (
                <button key={m} type="button" aria-pressed={escolhidas.includes(m)} onClick={() => toggle(m)}>
                  {escolhidas.includes(m) && <Check />}
                  {m}
                </button>
              ))}
            </div>
            <form className="row" onSubmit={adicionar}>
              <Field label="Outra matéria" id="outra">
                <input id="outra" className="input" value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Ex.: Programação" maxLength={50} />
              </Field>
              <button type="submit" className="btn" disabled={!nova.trim()}><Plus /> Adicionar</button>
            </form>
            <div className="inline">
              <button type="button" className="btn ghost" onClick={() => setPasso(0)}><ArrowLeft /> Voltar</button>
              <span className="spacer" />
              <span className="muted small">{escolhidas.length ? `${escolhidas.length} ${escolhidas.length === 1 ? 'matéria' : 'matérias'}` : 'Nenhuma ainda'}</span>
              <button type="button" className="btn primary" onClick={concluir}>{escolhidas.length ? 'Começar' : 'Pular por enquanto'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
