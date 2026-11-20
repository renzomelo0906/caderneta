import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, Field, Switch } from '../components/ui.jsx';
import { TIPOS_ETAPA, MAX_ETAPAS, makePeriodo, makeEtapas } from '../lib/model.js';
import { parseNum } from '../lib/format.js';

export function PeriodoModal({ ctx, onClose, periodoId }) {
  const { data, update, confirm } = ctx;
  const original = data.periodos.find((p) => p.id === periodoId) || null;
  const [f, setF] = useState(() => {
    const p = original || makePeriodo({ nome: String(new Date().getFullYear() + (data.periodos.length ? 1 : 0)) });
    return {
      nome: p.nome, tipo: p.tipo, qtd: String(p.etapas.length), max: String(p.notaMaxima).replace('.', ','), min: String(p.mediaMinima).replace('.', ','),
      freq: String(p.frequenciaMinima), inicio: p.inicio, fim: p.fim, concluido: p.concluido,
      etapas: p.etapas.map((e) => ({ ...e })),
    };
  });
  const [erro, setErro] = useState('');
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  // mudou qtd/tipo: refaz as etapas mantendo as q ja tinha
  const etapasPara = (tipo, qtd) => makeEtapas(tipo, qtd, f.etapas);
  const mudarQtd = (v) => {
    const q = parseNum(v);
    setF((x) => ({ ...x, qtd: v, etapas: q >= 1 && q <= MAX_ETAPAS && Number.isInteger(q) ? makeEtapas(x.tipo, q, x.etapas) : x.etapas }));
  };
  const mudarTipo = (tipo) => {
    const q = parseNum(f.qtd);
    setF((x) => ({ ...x, tipo, qtd: original ? x.qtd : String(TIPOS_ETAPA[tipo].padrao), etapas: makeEtapas(tipo, original && q >= 1 ? q : TIPOS_ETAPA[tipo].padrao, x.etapas) }));
  };
  const setEtapa = (i, k, v) => setF((x) => ({ ...x, etapas: x.etapas.map((e, j) => (j === i ? { ...e, [k]: v } : e)) }));

  const salvar = async () => {
    const q = parseNum(f.qtd);
    const nmax = parseNum(f.max);
    const nmin = parseNum(f.min);
    const freq = parseNum(f.freq);
    if (!f.nome.trim()) return setErro('Dê um nome ao período.');
    if (!(Number.isInteger(q) && q >= 1 && q <= MAX_ETAPAS)) return setErro(`O número de partes vai de 1 a ${MAX_ETAPAS}.`);
    if (!(nmax > 0)) return setErro('A nota máxima precisa ser maior que zero.');
    if (!(nmin >= 0 && nmin <= nmax)) return setErro('A média para passar precisa estar entre 0 e a nota máxima.');
    if (!(freq >= 0 && freq <= 100)) return setErro('A frequência mínima vai de 0 a 100%.');
    if (f.inicio && f.fim && f.fim < f.inicio) return setErro('O fim do período está antes do início.');
    const etapas = etapasPara(f.tipo, q).map((e, i) => ({ ...e, nome: (f.etapas[i] && f.etapas[i].nome.trim()) || e.nome, inicio: (f.etapas[i] && f.etapas[i].inicio) || '', fim: (f.etapas[i] && f.etapas[i].fim) || '' }));

    if (original) {
      const removidas = original.etapas.filter((e) => !etapas.some((x) => x.id === e.id)).map((e) => e.id);
      const perdidas = data.notas.filter((n) => removidas.includes(n.etapaId)).length;
      if (perdidas && !(await confirm({ title: 'Apagar notas das partes removidas?', message: `Com menos partes, ${perdidas} ${perdidas === 1 ? 'nota é apagada' : 'notas são apagadas'}. Dá para desfazer logo depois.`, confirmLabel: 'Apagar e salvar', danger: true }))) return;
      update((d) => {
        const p = d.periodos.find((x) => x.id === original.id);
        Object.assign(p, { nome: f.nome.trim(), tipo: f.tipo, etapas, notaMaxima: nmax, mediaMinima: nmin, frequenciaMinima: freq, inicio: f.inicio, fim: f.fim, concluido: f.concluido });
        d.notas = d.notas.filter((n) => !removidas.includes(n.etapaId));
      }, perdidas ? { undo: 'Período salvo.' } : { msg: 'Período salvo.' });
    } else {
      const p = { ...makePeriodo({ nome: f.nome.trim(), tipo: f.tipo, quantidade: q, notaMaxima: nmax, mediaMinima: nmin, frequenciaMinima: freq, inicio: f.inicio, fim: f.fim }), etapas };
      // copia as formulas do periodo atual
      const atual = ctx.periodo;
      if (atual && atual.tipo === f.tipo) {
        p.formulaFinal = atual.formulaFinal;
        p.etapas.forEach((e, i) => { if (atual.etapas[i]) e.formula = atual.etapas[i].formula; });
      }
      update((d) => {
        d.periodos.push(p);
        d.settings.periodoAtualId = p.id;
      }, { msg: `${p.nome} criado. Agora cadastre as matérias.` });
      ctx.go('notas');
    }
    onClose();
  };

  const apagar = async () => {
    const mats = data.materias.filter((m) => m.periodoId === original.id).map((m) => m.id);
    const nNotas = data.notas.filter((n) => mats.includes(n.materiaId)).length;
    const ok = await confirm({
      title: `Apagar ${original.nome}?`,
      message: `Some o período com ${mats.length} ${mats.length === 1 ? 'matéria' : 'matérias'}, ${nNotas} ${nNotas === 1 ? 'nota' : 'notas'}, o horário e as faltas. Dá para desfazer logo depois.`,
      confirmLabel: 'Apagar período',
      danger: true,
    });
    if (!ok) return;
    update((d) => {
      d.periodos = d.periodos.filter((p) => p.id !== original.id);
      d.materias = d.materias.filter((m) => m.periodoId !== original.id);
      d.notas = d.notas.filter((n) => !mats.includes(n.materiaId));
      d.aulas = d.aulas.filter((a) => a.periodoId !== original.id);
      d.faltas = d.faltas.filter((x) => !mats.includes(x.materiaId));
      if (d.settings.periodoAtualId === original.id) d.settings.periodoAtualId = d.periodos.length ? d.periodos[d.periodos.length - 1].id : null;
    }, { undo: `${original.nome} apagado.` });
    onClose();
  };

  const q = parseNum(f.qtd);
  const tipo = TIPOS_ETAPA[f.tipo];
  return (
    <Modal
      title={original ? `Editar ${original.nome}` : 'Novo período'}
      sub={original ? null : 'Um ano letivo, um semestre da faculdade ou um curso.'}
      onClose={onClose}
      size="wide"
      footer={
        <>
          {original && <button type="button" className="btn danger" onClick={apagar}><Trash2 /> Apagar período</button>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" onClick={salvar}>{original ? 'Salvar' : 'Criar período'}</button>
        </>
      }
    >
      <div className="stack">
        <div className="grid3">
          <Field label="Nome" id="p-nome" hint="Ex.: 2026, 3º semestre">
            <input id="p-nome" className="input" value={f.nome} onChange={(e) => set('nome')(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Dividido em" id="p-tipo">
            <select id="p-tipo" className="select" value={f.tipo} onChange={(e) => mudarTipo(e.target.value)}>
              {Object.entries(TIPOS_ETAPA).map(([k, t]) => <option key={k} value={k}>{t.plural.replace(/^./, (c) => c.toUpperCase())}</option>)}
            </select>
          </Field>
          <Field label="Quantos" id="p-qtd" hint={`De 1 a ${MAX_ETAPAS}`}>
            <input id="p-qtd" className="input" type="number" min={1} max={MAX_ETAPAS} value={f.qtd} onChange={(e) => mudarQtd(e.target.value)} />
          </Field>
        </div>
        <div className="grid3">
          <Field label="Nota máxima" id="p-max">
            <input id="p-max" className="input" inputMode="decimal" value={f.max} onChange={(e) => set('max')(e.target.value)} />
          </Field>
          <Field label="Média para passar" id="p-min">
            <input id="p-min" className="input" inputMode="decimal" value={f.min} onChange={(e) => set('min')(e.target.value)} />
          </Field>
          <Field label="Frequência mínima (%)" id="p-freq">
            <input id="p-freq" className="input" inputMode="numeric" value={f.freq} onChange={(e) => set('freq')(e.target.value)} />
          </Field>
        </div>
        <div className="grid3">
          <Field label="Começa em" id="p-ini" hint="Usado para contar as aulas">
            <input id="p-ini" className="input" type="date" value={f.inicio} onChange={(e) => set('inicio')(e.target.value)} />
          </Field>
          <Field label="Termina em" id="p-fim">
            <input id="p-fim" className="input" type="date" value={f.fim} onChange={(e) => set('fim')(e.target.value)} />
          </Field>
          {original && (
            <div className="field">
              <span className="label">Concluído</span>
              <div className="inline" style={{ height: 38 }}>
                <Switch checked={f.concluido} onChange={set('concluido')} label="Período concluído" />
                <span className="muted small">{f.concluido ? 'Já terminou' : 'Em andamento'}</span>
              </div>
            </div>
          )}
        </div>

        {Number.isInteger(q) && q >= 1 && q <= MAX_ETAPAS && (
          <details className="help" open={Boolean(original)}>
            <summary>Nomes e datas de cada {tipo.nome.toLowerCase()} (opcional)</summary>
            <p className="muted small" style={{ marginTop: 0 }}>Com as datas, o app sabe qual {tipo.nome.toLowerCase()} está acontecendo hoje.</p>
            <div className="stack" style={{ gap: 8 }}>
              {etapasPara(f.tipo, q).map((e, i) => (
                <div key={e.id} className="row" style={{ alignItems: 'center', gap: 8 }}>
                  <span className="code" style={{ width: 40, textAlign: 'center' }}>{e.codigo}</span>
                  <input className="input" aria-label={`Nome da parte ${i + 1}`} value={f.etapas[i] ? f.etapas[i].nome : e.nome} onChange={(ev) => setEtapa(i, 'nome', ev.target.value)} maxLength={40} style={{ flex: 2 }} />
                  <input className="input" type="date" aria-label={`Início de ${e.nome}`} value={(f.etapas[i] && f.etapas[i].inicio) || ''} onChange={(ev) => setEtapa(i, 'inicio', ev.target.value)} style={{ flex: 1 }} />
                  <input className="input" type="date" aria-label={`Fim de ${e.nome}`} value={(f.etapas[i] && f.etapas[i].fim) || ''} onChange={(ev) => setEtapa(i, 'fim', ev.target.value)} style={{ flex: 1 }} />
                </div>
              ))}
            </div>
          </details>
        )}
        {erro && <div className="err" role="alert" style={{ color: 'var(--red)', fontWeight: 560 }}>{erro}</div>}
      </div>
    </Modal>
  );
}
