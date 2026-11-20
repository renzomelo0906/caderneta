import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, Field } from '../components/ui.jsx';
import { uid, TIPOS_EVENTO, AVISOS, materiasDo } from '../lib/model.js';
import { hojeISO, minutos } from '../lib/format.js';

export const COR_TIPO = {
  prova: 'var(--red)',
  trabalho: '#d0661f',
  tarefa: 'var(--pen)',
  lembrete: '#7a5bd0',
  evento: '#13917a',
  feriado: 'var(--ok)',
};

export function EventoModal({ ctx, onClose, eventoId, data: dataInicial, tipo: tipoInicial, materiaId }) {
  const { data, update, periodo } = ctx;
  const original = eventoId ? data.eventos.find((e) => e.id === eventoId) : null;
  const materias = periodo ? materiasDo(data, periodo.id) : [];
  const [f, setF] = useState(() =>
    original
      ? { titulo: original.titulo, tipo: original.tipo, materiaId: original.materiaId || '', data: original.data, fim: original.fim || '', hora: original.hora || '', aviso: original.aviso ?? null, repetir: original.repetir || 'nao', ate: original.ate || '', obs: original.obs || '' }
      : { titulo: '', tipo: tipoInicial || 'prova', materiaId: materiaId || '', data: dataInicial || hojeISO(), fim: '', hora: '', aviso: 1440, repetir: 'nao', ate: '', obs: '' }
  );
  const [erro, setErro] = useState('');
  const [varios, setVarios] = useState(Boolean(original && original.fim));
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const salvar = () => {
    const titulo = f.titulo.trim() || (f.materiaId && ['prova', 'trabalho'].includes(f.tipo) ? `${TIPOS_EVENTO[f.tipo].nome} de ${materias.find((m) => m.id === f.materiaId)?.nome || ''}`.trim() : '');
    if (!titulo) return setErro('Escreva o que é, por exemplo: Prova de funções.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) return setErro('Escolha a data.');
    if (f.hora && minutos(f.hora) === null) return setErro('Hora inválida.');
    if (varios && f.fim && f.fim < f.data) return setErro('O último dia está antes do primeiro.');
    if (f.repetir !== 'nao' && f.ate && f.ate < f.data) return setErro('A repetição termina antes de começar.');
    const ev = {
      ...(original || {}),
      id: original ? original.id : uid(),
      titulo, tipo: f.tipo, materiaId: f.materiaId || null, data: f.data, fim: varios && f.fim > f.data ? f.fim : '', hora: f.hora,
      aviso: f.aviso, repetir: f.repetir, ate: f.repetir !== 'nao' ? f.ate : '', obs: f.obs.trim(),
      feito: original ? Boolean(original.feito) : false, feitos: original ? original.feitos || [] : [],
    };
    update((d) => {
      const i = d.eventos.findIndex((x) => x.id === ev.id);
      if (i >= 0) d.eventos[i] = ev;
      else d.eventos.push(ev);
    }, { msg: original ? 'Evento salvo.' : `${TIPOS_EVENTO[ev.tipo].nome} adicionado ao calendário.` });
    onClose();
  };

  const apagar = () => {
    update((d) => { d.eventos = d.eventos.filter((x) => x.id !== original.id); }, { undo: `${original.titulo} apagado.` });
    onClose();
  };

  return (
    <Modal
      title={original ? 'Editar evento' : 'Novo no calendário'}
      onClose={onClose}
      footer={
        <>
          {original && <button type="button" className="btn danger" onClick={apagar}><Trash2 /> Apagar</button>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" onClick={salvar}>Salvar</button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <div className="toggle-chips" role="group" aria-label="Tipo">
          {Object.entries(TIPOS_EVENTO).map(([k, t]) => (
            <button key={k} type="button" aria-pressed={f.tipo === k} onClick={() => { set('tipo')(k); if (k === 'feriado') set('aviso')(null); }}>
              <span className="dot" style={{ background: f.tipo === k ? 'currentColor' : COR_TIPO[k], width: 8, height: 8 }} />
              {t.nome}
            </button>
          ))}
        </div>
        <div className="grid2">
          <Field label="O que é" id="e-tit">
            <input id="e-tit" className="input" value={f.titulo} onChange={(e) => set('titulo')(e.target.value)} placeholder={f.tipo === 'prova' ? 'Ex.: Prova de funções' : f.tipo === 'feriado' ? 'Ex.: Feriado de Finados' : 'Ex.: Entregar resumo'} maxLength={80} />
          </Field>
          <Field label="Matéria" id="e-mat">
            <select id="e-mat" className="select" value={f.materiaId} onChange={(e) => set('materiaId')(e.target.value)}>
              <option value="">Nenhuma</option>
              {materias.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid3">
          <Field label={varios ? 'Primeiro dia' : 'Dia'} id="e-data">
            <input id="e-data" className="input" type="date" value={f.data} onChange={(e) => set('data')(e.target.value)} />
          </Field>
          {varios ? (
            <Field label="Último dia" id="e-fim">
              <input id="e-fim" className="input" type="date" value={f.fim} min={f.data} onChange={(e) => set('fim')(e.target.value)} />
            </Field>
          ) : (
            <Field label="Hora" id="e-hora" hint="Em branco: o dia todo">
              <input id="e-hora" className="input" type="time" value={f.hora} onChange={(e) => set('hora')(e.target.value)} />
            </Field>
          )}
          <Field label="Avisar" id="e-av">
            <select id="e-av" className="select" value={f.aviso === null ? '' : String(f.aviso)} onChange={(e) => set('aviso')(e.target.value === '' ? null : Number(e.target.value))}>
              {AVISOS.map((a) => <option key={String(a.min)} value={a.min === null ? '' : String(a.min)}>{a.nome}</option>)}
            </select>
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={varios} onChange={(e) => setVarios(e.target.checked)} />
          <span>Dura vários dias (semana de provas, férias)</span>
        </label>
        <div className="grid2">
          <Field label="Repetir" id="e-rep">
            <select id="e-rep" className="select" value={f.repetir} onChange={(e) => set('repetir')(e.target.value)}>
              <option value="nao">Não repete</option>
              <option value="semanal">Toda semana</option>
              <option value="mensal">Todo mês</option>
            </select>
          </Field>
          {f.repetir !== 'nao' && (
            <Field label="Repetir até" id="e-ate" hint="Em branco: sem data para acabar">
              <input id="e-ate" className="input" type="date" value={f.ate} min={f.data} onChange={(e) => set('ate')(e.target.value)} />
            </Field>
          )}
        </div>
        <Field label="Anotações" id="e-obs">
          <textarea id="e-obs" className="textarea" value={f.obs} onChange={(e) => set('obs')(e.target.value)} placeholder="Conteúdo da prova, material, link do trabalho…" maxLength={1000} />
        </Field>
        {f.tipo === 'feriado' && <div className="muted small">Dias marcados como feriado ou sem aula saem da conta de aulas da frequência.</div>}
        {erro && <div className="err" role="alert" style={{ color: 'var(--red)', fontWeight: 560 }}>{erro}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
