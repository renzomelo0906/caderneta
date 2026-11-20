import { useMemo, useState } from 'react';
import { Trash2, CircleHelp } from 'lucide-react';
import { Modal, Field, Seg } from '../components/ui.jsx';
import { uid, suggestSigla, SIGLA_RE, materiasDo } from '../lib/model.js';
import { etapaResult, finalResult, FINAL, tipoDe, formulaEtapaDe, formulaFinalDe } from '../lib/grades.js';
import { normalizeName, FUNCTION_NAMES, compile } from '../lib/formula.js';
import { fmtNota, parseNum, hojeISO } from '../lib/format.js';

const NOMES = ['Prova 1', 'Prova 2', 'Prova 3', 'Trabalho', 'Teste', 'Simulado', 'Atividade', 'Seminário', 'Participação', 'Projeto', 'Recuperação', 'Exame final'];
const MOTIVOS = ['Participação', 'Comportamento', 'Olimpíada', 'Feira de ciências', 'Lição de casa', 'Atraso na entrega'];
const RESERVADAS = ['MEDIA', 'SOMA', 'BONUS', ...FUNCTION_NAMES];
const SIGLA_OFICIAL = 'ESCOLA';

const TIPOS = [
  { value: 'avaliacao', label: 'Avaliação' },
  { value: 'bonus', label: 'Bônus' },
  { value: 'oficial', label: 'Média da escola' },
];

export function NotaModal({ ctx, onClose, notaId, materiaId, etapaId, tipo }) {
  const { data, update, periodo } = ctx;
  const original = notaId ? data.notas.find((n) => n.id === notaId) : null;
  const materias = periodo ? materiasDo(data, periodo.id) : [];
  const casas = data.settings.casas;
  const nmax = periodo ? periodo.notaMaxima : 10;
  const semZeros = (v) => fmtNota(v, casas).replace(/,0+$/, '');

  const [f, setF] = useState(() => {
    if (original) {
      return {
        tipo: tipoDe(original), materiaId: original.materiaId, etapaId: original.etapaId, nome: original.nome, sigla: original.sigla, siglaManual: true,
        valor: original.valor === null ? '' : fmtNota(original.valor, 2).replace(/,?0+$/, '').replace(/^-?$/, '0'), vale: original.vale ? String(original.vale).replace('.', ',') : '',
        peso: String(original.peso).replace('.', ','), data: original.data,
      };
    }
    return {
      tipo: TIPOS.some((t) => t.value === tipo) ? tipo : 'avaliacao',
      materiaId: materiaId || (materias[0] && materias[0].id) || '', etapaId: etapaId || (periodo && periodo.etapas[0].id) || '',
      nome: '', sigla: '', siglaManual: false, valor: '', vale: '', peso: '1', data: hojeISO(),
    };
  });
  const [erro, setErro] = useState('');
  const [mais, setMais] = useState(Boolean(original && (original.vale || original.peso !== 1)));

  const irmas = useMemo(
    () => data.notas.filter((n) => n.materiaId === f.materiaId && n.etapaId === f.etapaId && n.id !== notaId),
    [data.notas, f.materiaId, f.etapaId, notaId]
  );
  const siglasIrmas = irmas.map((n) => n.sigla.toUpperCase());
  const siglaAuto = suggestSigla(f.nome, siglasIrmas);
  const sigla = f.tipo === 'oficial' ? SIGLA_OFICIAL : f.siglaManual ? f.sigla : siglaAuto;
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const montar = () => {
    if (!f.materiaId) return 'Escolha a matéria.';
    if (!f.etapaId) return 'Escolha em qual parte do período a nota entra.';
    const valor = parseNum(f.valor);
    if (Number.isNaN(valor)) return f.tipo === 'bonus' ? 'Os pontos precisam ser um número, como 0,5.' : 'A nota precisa ser um número, como 7,5.';

    if (f.tipo === 'oficial') {
      if (irmas.some((n) => tipoDe(n) === 'oficial')) return 'Essa matéria já tem a média da escola nessa parte. Edite a que já existe.';
      if (valor === null) return 'Digite a média que a escola divulgou.';
      if (valor < 0 || valor > nmax + 1e-9) return `A média vai de 0 a ${semZeros(nmax)}.`;
      return {
        id: original ? original.id : uid(), tipo: 'oficial', materiaId: f.materiaId, etapaId: f.etapaId,
        nome: 'Média da escola', sigla: SIGLA_OFICIAL, valor, vale: null, peso: 1, data: '',
        criadoEm: original ? original.criadoEm || new Date().toISOString() : new Date().toISOString(),
      };
    }

    const s = sigla.trim();
    if (!SIGLA_RE.test(s)) return 'A sigla começa com letra e tem só letras, números ou _ (até 12), como P1 ou TRAB.';
    const S = normalizeName(s);
    if (siglasIrmas.includes(S)) return `Já existe ${s} nesta matéria e nesta parte. Use outra sigla.`;
    if (RESERVADAS.includes(S) || S === SIGLA_OFICIAL) return `${s} é uma palavra reservada das fórmulas. Use outra sigla.`;
    if (f.etapaId === FINAL && periodo.etapas.some((e) => e.codigo === S)) return `${s} é o código de uma parte do período. Use outra sigla, como REC.`;

    if (f.tipo === 'bonus') {
      if (valor === null || valor === 0) return 'Digite quantos pontos o bônus vale, como 0,5 (ou -0,5 para desconto).';
      if (Math.abs(valor) > nmax + 1e-9) return `O bônus vai de -${semZeros(nmax)} a ${semZeros(nmax)} pontos.`;
      return {
        id: original ? original.id : uid(), tipo: 'bonus', materiaId: f.materiaId, etapaId: f.etapaId,
        nome: f.nome.trim() || 'Bônus', sigla: s, valor, vale: null, peso: 1, data: f.data || '',
        criadoEm: original ? original.criadoEm || new Date().toISOString() : new Date().toISOString(),
      };
    }

    const vale = parseNum(f.vale);
    const peso = parseNum(f.peso);
    if (Number.isNaN(vale) || (vale !== null && !(vale > 0))) return 'O valor máximo da avaliação precisa ser maior que zero.';
    const teto = vale ?? nmax;
    if (valor !== null && (valor < 0 || valor > teto + 1e-9)) return `A nota vai de 0 a ${semZeros(teto)}.`;
    if (peso === null || Number.isNaN(peso) || !(peso > 0)) return 'O peso precisa ser maior que zero.';
    return {
      id: original ? original.id : uid(), tipo: 'avaliacao',
      materiaId: f.materiaId, etapaId: f.etapaId,
      nome: f.nome.trim() || s, sigla: s, valor, vale: vale && Math.abs(vale - nmax) > 1e-9 ? vale : null, peso, data: f.data || '',
      criadoEm: original ? original.criadoEm || new Date().toISOString() : new Date().toISOString(),
    };
  };

  const montada = montar();
  const previa = useMemo(() => {
    if (typeof montada === 'string' || !periodo) return null;
    const mat = data.materias.find((m) => m.id === montada.materiaId);
    if (!mat) return null;
    const outras = data.notas.filter((n) => n.id !== montada.id);
    const depois = { ...data, notas: [...outras, montada] };
    if (montada.etapaId === FINAL) {
      return { rotulo: 'Média final', antes: finalResult(data, periodo, mat), depois: finalResult(depois, periodo, mat) };
    }
    const etapa = periodo.etapas.find((e) => e.id === montada.etapaId);
    if (!etapa) return null;
    return { rotulo: `Média do ${etapa.nome}`, antes: etapaResult(data, periodo, mat, etapa), depois: etapaResult(depois, periodo, mat, etapa) };
  }, [JSON.stringify(montada), data, periodo]);

  const salvar = (outra) => {
    const n = montar();
    if (typeof n === 'string') return setErro(n);
    update((d) => {
      const i = d.notas.findIndex((x) => x.id === n.id);
      if (i >= 0) d.notas[i] = n;
      else d.notas.push(n);
    }, { msg: original ? 'Nota salva.' : n.tipo === 'oficial' ? 'Média da escola salva.' : n.tipo === 'bonus' ? 'Bônus adicionado.' : `${n.sigla} adicionada.` });
    if (outra) {
      setF((x) => ({ ...x, nome: '', sigla: '', siglaManual: false, valor: '' }));
      setErro('');
      setTimeout(() => document.getElementById(f.tipo === 'oficial' ? 'n-valor' : 'n-nome')?.focus(), 0);
    } else onClose();
  };

  const apagar = () => {
    update((d) => { d.notas = d.notas.filter((x) => x.id !== original.id); }, { undo: `${original.tipo === 'oficial' ? 'Média da escola' : original.sigla} apagada.` });
    onClose();
  };

  if (!periodo || !materias.length) {
    return (
      <Modal title="Adicionar nota" onClose={onClose} size="narrow" footer={<button type="button" className="btn primary" onClick={() => { onClose(); ctx.go('notas'); }}>Ir para Notas</button>}>
        <p className="muted" style={{ margin: 0 }}>Primeiro cadastre as matérias do período, na tela de Notas.</p>
      </Modal>
    );
  }

  const titulo = original
    ? f.tipo === 'oficial' ? 'Editar média da escola' : `Editar ${original.sigla}`
    : 'Adicionar nota';
  // a sigla entra na conta msm?
  const matSel = materias.find((m) => m.id === f.materiaId);
  const etSel = periodo.etapas.find((e) => e.id === f.etapaId);
  const contaAlvo = f.etapaId === FINAL ? formulaFinalDe(periodo, matSel) : formulaEtapaDe(periodo, matSel, etSel);
  const cAlvo = compile(contaAlvo);
  const S = normalizeName(sigla.trim());
  const usaTodas = f.etapaId !== FINAL && cAlvo.ok && (cAlvo.vars.includes('MEDIA') || cAlvo.vars.includes('SOMA'));
  const foraDaConta = f.tipo === 'avaliacao' && S && SIGLA_RE.test(sigla.trim()) && cAlvo.ok && !usaTodas && !cAlvo.vars.includes(S);
  const mudou = previa && previa.depois.valor !== null && (previa.antes.valor === null || Math.abs(previa.antes.valor - previa.depois.valor) > 1e-9);
  const ehAval = f.tipo === 'avaliacao';
  return (
    <Modal
      title={titulo}
      onClose={onClose}
      footer={
        <>
          {original && <button type="button" className="btn danger" onClick={apagar}><Trash2 /> Apagar</button>}
          <span className="spacer" />
          {!original && f.tipo !== 'oficial' && <button type="button" className="btn" onClick={() => salvar(true)}>Salvar e adicionar outra</button>}
          <button type="button" className="btn primary" onClick={() => salvar(false)}>Salvar</button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => { e.preventDefault(); salvar(false); }}>
        {!original && <Seg label="Tipo de nota" value={f.tipo} onChange={(t) => { setErro(''); set('tipo')(t); }} options={TIPOS} />}
        {f.tipo === 'bonus' && <p className="small muted" style={{ margin: 0 }}>Pontos extras que a escola dá (ou tira) direto na média dessa parte. A média nunca passa de {semZeros(nmax)}.</p>}
        {f.tipo === 'oficial' && <p className="small muted" style={{ margin: 0 }}>A média que a escola divulgou, como aparece no boletim. Ela substitui a conta do app nessa parte. Use quando a escola calcula de um jeito diferente.</p>}
        <div className="grid2">
          <Field label="Matéria" id="n-mat">
            <select id="n-mat" className="select" value={f.materiaId} onChange={(e) => set('materiaId')(e.target.value)}>
              {materias.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </Field>
          <Field label="Entra em" id="n-et">
            <select id="n-et" className="select" value={f.etapaId} onChange={(e) => set('etapaId')(e.target.value)}>
              {periodo.etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              <option value={FINAL}>{f.tipo === 'avaliacao' ? 'Nota final do período (recuperação, exame)' : 'Média final do período'}</option>
            </select>
          </Field>
        </div>
        {f.tipo !== 'oficial' && (
          <div className="row">
            <Field label={ehAval ? 'Avaliação' : 'Motivo'} id="n-nome" className="grow">
              <input id="n-nome" className="input" list="n-nomes" value={f.nome} onChange={(e) => set('nome')(e.target.value)} placeholder={ehAval ? 'Ex.: Prova 1' : 'Ex.: Participação'} maxLength={60} autoComplete="off" />
              <datalist id="n-nomes">{(ehAval ? NOMES : MOTIVOS).map((n) => <option key={n} value={n} />)}</datalist>
            </Field>
            <Field label="Sigla" id="n-sigla" className="sigla">
              <input
                id="n-sigla"
                className="input mono"
                style={{ width: 110 }}
                value={sigla}
                onChange={(e) => setF((x) => ({ ...x, sigla: e.target.value.replace(/\s/g, ''), siglaManual: true }))}
                maxLength={12}
                spellCheck={false}
              />
            </Field>
          </div>
        )}
        <div className="grid2">
          {ehAval ? (
            <Field label="Nota" id="n-valor" hint="Deixe em branco se ainda não fez">
              <input id="n-valor" className="input" inputMode="decimal" value={f.valor} onChange={(e) => set('valor')(e.target.value)} placeholder={`0 a ${semZeros(parseNum(f.vale) || nmax)}`} data-autofocus={original ? true : undefined} />
            </Field>
          ) : f.tipo === 'bonus' ? (
            <Field label="Pontos" id="n-valor" hint="Negativo para desconto, como -0,5">
              <input id="n-valor" className="input" inputMode="decimal" value={f.valor} onChange={(e) => set('valor')(e.target.value)} placeholder="Ex.: 0,5" data-autofocus={original ? true : undefined} />
            </Field>
          ) : (
            <Field label="Média da escola" id="n-valor">
              <input id="n-valor" className="input" inputMode="decimal" value={f.valor} onChange={(e) => set('valor')(e.target.value)} placeholder={`0 a ${semZeros(nmax)}`} data-autofocus />
            </Field>
          )}
          {f.tipo !== 'oficial' && (
            <Field label="Data" id="n-data">
              <input id="n-data" className="input" type="date" value={f.data} onChange={(e) => set('data')(e.target.value)} />
            </Field>
          )}
        </div>
        {ehAval && (mais ? (
          <div className="grid2">
            <Field label="Vale quanto" id="n-vale" hint={`Em branco: ${semZeros(nmax)}, a nota máxima do período`}>
              <input id="n-vale" className="input" inputMode="decimal" value={f.vale} onChange={(e) => set('vale')(e.target.value)} placeholder={String(nmax)} />
            </Field>
            <Field label="Peso" id="n-peso" hint="Usado pela MEDIA. 2 conta em dobro">
              <input id="n-peso" className="input" inputMode="decimal" value={f.peso} onChange={(e) => set('peso')(e.target.value)} />
            </Field>
          </div>
        ) : (
          <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setMais(true)}>A avaliação vale menos que {fmtNota(nmax, 0)} ou tem peso diferente?</button>
        ))}

        {previa && (
          <div className="banner info" style={{ margin: 0 }}>
            <div>
              <div className="small muted">
                {previa.rotulo}
                {previa.depois.oficial ? ', a da escola' : previa.depois.parcial ? ' (parcial)' : ''}
                {previa.depois.comBonus ? `, com ${previa.depois.bonus > 0 ? '+' : ''}${fmtNota(previa.depois.bonus, casas)} de bônus` : ''}
              </div>
              <div className="hand" style={{ fontSize: 22, fontWeight: 760, color: previa.depois.valor !== null && previa.depois.valor < periodo.mediaMinima ? 'var(--red)' : 'var(--ink)' }}>
                {previa.depois.erro ? 'Fórmula com erro' : previa.depois.valor === null ? (previa.depois.faltam.length ? `Falta ${previa.depois.faltam.join(', ')}` : 'Ainda sem avaliações') : fmtNota(previa.depois.valor, casas)}
                {mudou && previa.antes.valor !== null && <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}> antes {fmtNota(previa.antes.valor, casas)}</span>}
              </div>
              {previa.depois.oficial && previa.depois.calculado !== null && Math.abs(previa.depois.calculado - previa.depois.valor) > 0.05 && (
                <div className="small muted">Pela fórmula do app daria {fmtNota(previa.depois.calculado, casas)}.</div>
              )}
            </div>
          </div>
        )}
        {foraDaConta && (
          <div className="fstatus" style={{ color: 'var(--warn)', margin: 0 }}>
            <CircleHelp />
            <span>
              {sigla.trim()} não entra na conta {f.etapaId === FINAL ? 'da média final' : `do ${etSel ? etSel.nome : 'trimestre'}`} de {matSel ? matSel.nome : 'esta matéria'}, que é <span className="code">{contaAlvo}</span>. Use uma sigla da conta ou mude a conta em Notas, Fórmulas.
            </span>
          </div>
        )}
        {erro && <div className="err" role="alert" style={{ color: 'var(--red)', fontWeight: 560 }}>{erro}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
