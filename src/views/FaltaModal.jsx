import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, Field } from '../components/ui.jsx';
import { uid, materiasDo } from '../lib/model.js';
import { hojeISO, fmtData, plural } from '../lib/format.js';

export function FaltaModal({ ctx, onClose, materiaId }) {
  const { data, update, periodo } = ctx;
  const materias = periodo ? materiasDo(data, periodo.id) : [];
  const [mat, setMat] = useState(materiaId || (materias[0] && materias[0].id) || '');
  const [dia, setDia] = useState(hojeISO());
  const [qtd, setQtd] = useState('1');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const lista = data.faltas.filter((x) => x.materiaId === mat).sort((a, b) => b.data.localeCompare(a.data));

  const salvar = () => {
    const q = Number(qtd);
    if (!mat) return setErro('Escolha a matéria.');
    if (!Number.isInteger(q) || q < 1 || q > 20) return setErro('Quantas aulas você perdeu? De 1 a 20.');
    update((d) => { d.faltas.push({ id: uid(), materiaId: mat, data: dia, quantidade: q, obs: obs.trim() }); }, { msg: `${plural(q, 'falta registrada', 'faltas registradas')}.` });
    onClose();
  };

  const apagar = (f) => update((d) => { d.faltas = d.faltas.filter((x) => x.id !== f.id); }, { undo: 'Falta apagada.' });

  return (
    <Modal
      title="Registrar falta"
      onClose={onClose}
      size="narrow"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" onClick={salvar}>Registrar</button>
        </>
      }
    >
      <div className="stack">
        <Field label="Matéria" id="f-mat">
          <select id="f-mat" className="select" value={mat} onChange={(e) => setMat(e.target.value)}>
            {materias.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </Field>
        <div className="grid2">
          <Field label="Dia" id="f-dia">
            <input id="f-dia" className="input" type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
          </Field>
          <Field label="Aulas perdidas" id="f-qtd">
            <input id="f-qtd" className="input" type="number" min={1} max={20} value={qtd} onChange={(e) => setQtd(e.target.value)} />
          </Field>
        </div>
        <Field label="Motivo (opcional)" id="f-obs">
          <input id="f-obs" className="input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: atestado médico" maxLength={80} />
        </Field>
        {erro && <div className="err" role="alert" style={{ color: 'var(--red)', fontWeight: 560 }}>{erro}</div>}
        {lista.length > 0 && (
          <div>
            <div className="label small" style={{ fontWeight: 650, color: 'var(--ink-2)', marginBottom: 6 }}>Já registradas nesta matéria</div>
            <ul className="list sheet" style={{ maxHeight: 180, overflowY: 'auto' }}>
              {lista.map((x) => (
                <li key={x.id} style={{ padding: '6px 6px 6px 14px', minHeight: 40 }}>
                  <span className="grow">
                    <span className="t1">{fmtData(x.data)}, {plural(x.quantidade, 'aula', 'aulas')}</span>
                    {x.obs && <span className="t2" style={{ display: 'block' }}>{x.obs}</span>}
                  </span>
                  <button type="button" className="btn ghost icon small" onClick={() => apagar(x)} aria-label={`Apagar falta de ${fmtData(x.data)}`} title="Apagar"><Trash2 /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
