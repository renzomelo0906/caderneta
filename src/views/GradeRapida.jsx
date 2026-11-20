import { useMemo, useState } from 'react';
import { Plus, X, Wand2, TriangleAlert } from 'lucide-react';
import { Modal, Field } from '../components/ui.jsx';
import { materiasDo, corDe, uid } from '../lib/model.js';
import { aulasDo, ordenarAulas } from '../lib/schedule.js';
import { DIAS_CURTO, DIAS, minutos, hhmm, plural, parseNum } from '../lib/format.js';

export function gerarHorarios({ inicio, duracao, quantidade, intervaloApos, intervalo }) {
  const out = [];
  let t = minutos(inicio);
  if (t === null || !(duracao > 0) || !(quantidade > 0)) return out;
  for (let i = 1; i <= Math.min(quantidade, 16); i++) {
    if (t + duracao > 24 * 60 - 1) break;
    out.push({ id: uid(), inicio: hhmm(t), fim: hhmm(t + duracao) });
    t += duracao;
    if (i === intervaloApos && intervalo > 0) t += intervalo;
  }
  return out;
}

export function GradeRapidaModal({ ctx, onClose }) {
  const { data, periodo, update, escuro } = ctx;
  const materias = materiasDo(data, periodo.id);
  const inicial = useMemo(() => {
    const aulas = aulasDo(data, periodo.id).filter((a) => materias.some((m) => m.id === a.materiaId));
    const porHorario = new Map();
    for (const a of ordenarAulas(aulas)) {
      const k = `${a.inicio}-${a.fim}`;
      if (!porHorario.has(k)) porHorario.set(k, { id: uid(), inicio: a.inicio, fim: a.fim });
    }
    const slots = [...porHorario.values()].sort((a, b) => minutos(a.inicio) - minutos(b.inicio) || minutos(a.fim) - minutos(b.fim));
    const cells = {};
    const geridas = new Set();
    let sobrando = 0;
    for (const a of aulas) {
      const s = porHorario.get(`${a.inicio}-${a.fim}`);
      const k = `${s.id}|${a.dia}`;
      if (cells[k]) {
        sobrando++; // repetida: ignora
        continue;
      }
      cells[k] = { materiaId: a.materiaId, aulaId: a.id };
      geridas.add(a.id);
    }
    return { slots, cells, geridas, sobrando, sabado: aulas.some((a) => a.dia === 6), domingo: aulas.some((a) => a.dia === 0) };
  }, []);

  const [slots, setSlots] = useState(inicial.slots);
  const [cells, setCells] = useState(inicial.cells);
  const [sabado, setSabado] = useState(inicial.sabado);
  const [gerador, setGerador] = useState({ inicio: '07:00', duracao: '50', quantidade: '6', intervaloApos: '3', intervalo: '20' });
  const [mostrarGerador, setMostrarGerador] = useState(!inicial.slots.length);
  const [erro, setErro] = useState('');

  const dias = [1, 2, 3, 4, 5, ...(sabado ? [6] : []), ...(inicial.domingo ? [0] : [])];
  const mat = (id) => materias.find((m) => m.id === id);
  const setCell = (slotId, dia, materiaId) => setCells((c) => ({ ...c, [`${slotId}|${dia}`]: { ...(c[`${slotId}|${dia}`] || {}), materiaId } }));
  const setSlot = (id, k, v) => setSlots((xs) => xs.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  const tirarSlot = (id) => setSlots((xs) => xs.filter((s) => s.id !== id));
  const maisSlot = () => setSlots((xs) => {
    const ult = xs[xs.length - 1];
    const dur = ult ? Math.max(5, minutos(ult.fim) - minutos(ult.inicio)) : 50;
    const ini = ult ? minutos(ult.fim) : 7 * 60;
    return [...xs, { id: uid(), inicio: hhmm(Math.min(ini, 23 * 60)), fim: hhmm(Math.min(ini + dur, 23 * 60 + 59)) }];
  });
  const gerar = () => {
    const g = {
      inicio: gerador.inicio,
      duracao: parseNum(gerador.duracao),
      quantidade: parseNum(gerador.quantidade),
      intervaloApos: parseNum(gerador.intervaloApos),
      intervalo: parseNum(gerador.intervalo) || 0,
    };
    const novos = gerarHorarios(g);
    if (!novos.length) return setErro('Confira o começo, a duração e quantas aulas são.');
    setCells((c) => {
      const out = {};
      novos.forEach((s, i) => {
        const velho = slots[i];
        if (!velho) return;
        for (const d of [0, 1, 2, 3, 4, 5, 6]) if (c[`${velho.id}|${d}`]) out[`${s.id}|${d}`] = c[`${velho.id}|${d}`];
      });
      return out;
    });
    setSlots(novos);
    setMostrarGerador(false);
    setErro('');
  };

  const usadas = (s) => dias.some((d) => cells[`${s.id}|${d}`] && cells[`${s.id}|${d}`].materiaId);
  const total = slots.reduce((n, s) => n + dias.filter((d) => cells[`${s.id}|${d}`] && cells[`${s.id}|${d}`].materiaId).length, 0);
  const porDia = (d) => slots.filter((s) => cells[`${s.id}|${d}`] && cells[`${s.id}|${d}`].materiaId).length;
  const sobrepostos = slots.filter((s, i) => slots.some((o, j) => j !== i && minutos(o.inicio) < minutos(s.fim) && minutos(s.inicio) < minutos(o.fim)));

  const salvar = () => {
    for (const s of slots) {
      if (!usadas(s)) continue;
      const a = minutos(s.inicio);
      const b = minutos(s.fim);
      if (a === null || b === null) return setErro('Preencha o começo e o fim de todos os horários usados.');
      if (b <= a) return setErro(`O horário das ${s.inicio} termina antes de começar.`);
    }
    update((d) => {
      const manter = d.aulas.filter((a) => !(a.periodoId === periodo.id && inicial.geridas.has(a.id)));
      const novas = [];
      for (const s of slots) {
        for (const dia of dias) {
          const c = cells[`${s.id}|${dia}`];
          if (!c || !c.materiaId) continue;
          const antiga = c.aulaId ? data.aulas.find((a) => a.id === c.aulaId) : null;
          novas.push({
            id: antiga ? antiga.id : uid(), periodoId: periodo.id, materiaId: c.materiaId, dia, inicio: s.inicio, fim: s.fim,
            sala: antiga && antiga.materiaId === c.materiaId ? antiga.sala || '' : '',
          });
        }
      }
      d.aulas = [...manter, ...novas];
    }, { undo: `Horário salvo: ${plural(total, 'aula', 'aulas')} na semana.` });
    onClose();
  };

  return (
    <Modal
      title="Montar o horário da semana"
      sub="Escolha a matéria de cada aula. Para mudar o horário, é só trocar as células e salvar."
      size="xwide"
      onClose={onClose}
      footer={
        <>
          <label className="check small" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={sabado} onChange={(e) => setSabado(e.target.checked)} />
            <span>Tem aula no sábado</span>
          </label>
          <span className="spacer" />
          <span className="small muted">{plural(total, 'aula', 'aulas')} na semana</span>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn primary" onClick={salvar}>Salvar horário</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        {mostrarGerador ? (
          <div className="formula-box gerador" style={{ margin: 0 }}>
            <div className="top">
              <span className="t">Horários das aulas</span>
              <span className="spacer" />
              {slots.length > 0 && <button type="button" className="link small" onClick={() => setMostrarGerador(false)}>Fechar</button>}
            </div>
            <div className="gerador-campos">
              <Field label="Primeira aula" id="g-ini"><input id="g-ini" className="input" type="time" value={gerador.inicio} onChange={(e) => setGerador((g) => ({ ...g, inicio: e.target.value }))} /></Field>
              <Field label="Cada aula (min)" id="g-dur"><input id="g-dur" className="input" inputMode="numeric" value={gerador.duracao} onChange={(e) => setGerador((g) => ({ ...g, duracao: e.target.value }))} /></Field>
              <Field label="Aulas por dia" id="g-qtd"><input id="g-qtd" className="input" inputMode="numeric" value={gerador.quantidade} onChange={(e) => setGerador((g) => ({ ...g, quantidade: e.target.value }))} /></Field>
              <Field label="Intervalo depois da" id="g-apos">
                <select id="g-apos" className="select" value={gerador.intervaloApos} onChange={(e) => setGerador((g) => ({ ...g, intervaloApos: e.target.value }))}>
                  <option value="0">Sem intervalo</option>
                  {Array.from({ length: Math.max(1, Math.min(15, parseNum(gerador.quantidade) || 6) - 1) }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}ª aula</option>)}
                </select>
              </Field>
              <Field label="Intervalo (min)" id="g-int"><input id="g-int" className="input" inputMode="numeric" value={gerador.intervalo} onChange={(e) => setGerador((g) => ({ ...g, intervalo: e.target.value }))} disabled={gerador.intervaloApos === '0'} /></Field>
            </div>
            <div className="inline" style={{ marginTop: 10 }}>
              <button type="button" className="btn primary small" onClick={gerar}><Wand2 /> {slots.length ? 'Refazer os horários' : 'Criar os horários'}</button>
              {slots.length > 0 && <span className="small muted">As matérias já escolhidas ficam, linha por linha.</span>}
            </div>
          </div>
        ) : (
          <div className="inline" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="link small" onClick={() => setMostrarGerador(true)}><Wand2 size={14} /> Mudar os horários de todas as aulas de uma vez</button>
          </div>
        )}

        {slots.length > 0 && (
          <div className="grade-wrap">
            <table className="grade">
              <thead>
                <tr>
                  <th className="hr">Horário</th>
                  {dias.map((d) => <th key={d} title={DIAS[d]}>{DIAS_CURTO[d]}</th>)}
                  <th className="x" aria-label="Tirar horário" />
                </tr>
              </thead>
              <tbody>
                {slots.map((s, i) => (
                  <tr key={s.id} className={sobrepostos.includes(s) ? 'sobre' : ''}>
                    <td className="hr">
                      <input className="input" type="time" value={s.inicio} onChange={(e) => setSlot(s.id, 'inicio', e.target.value)} aria-label={`Começo da ${i + 1}ª aula`} />
                      <span className="faint">–</span>
                      <input className="input" type="time" value={s.fim} onChange={(e) => setSlot(s.id, 'fim', e.target.value)} aria-label={`Fim da ${i + 1}ª aula`} />
                    </td>
                    {dias.map((d) => {
                      const c = cells[`${s.id}|${d}`];
                      const m = c && c.materiaId ? mat(c.materiaId) : null;
                      return (
                        <td key={d}>
                          <select
                            className={`select cel ${m ? 'cheia' : ''}`}
                            style={m ? { '--c': corDe(m.cor, escuro) } : null}
                            value={m ? m.id : ''}
                            onChange={(e) => setCell(s.id, d, e.target.value)}
                            aria-label={`${DIAS[d]}, ${s.inicio}`}
                          >
                            <option value="">—</option>
                            {materias.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                          </select>
                        </td>
                      );
                    })}
                    <td className="x">
                      <button type="button" className="btn ghost icon small" onClick={() => tirarSlot(s.id)} aria-label={`Tirar o horário das ${s.inicio}`} title="Tirar este horário"><X /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="hr">
                    <button type="button" className="btn ghost small" onClick={maisSlot}><Plus /> Horário</button>
                  </td>
                  {dias.map((d) => <td key={d} className="cnt">{plural(porDia(d), 'aula', 'aulas')}</td>)}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {sobrepostos.length > 0 && (
          <div className="banner warn" style={{ margin: 0 }}>
            <TriangleAlert />
            <span>Alguns horários se cruzam (estão marcados). Dá para salvar assim, mas confira se não é engano.</span>
          </div>
        )}
        {inicial.sobrando > 0 && <p className="small muted" style={{ margin: 0 }}>{plural(inicial.sobrando, 'aula que divide', 'aulas que dividem')} o mesmo horário com outra não aparece{inicial.sobrando > 1 ? 'm' : ''} aqui e continua{inicial.sobrando > 1 ? 'm' : ''} como {inicial.sobrando > 1 ? 'estão' : 'está'}.</p>}
        {erro && <div className="err" role="alert" style={{ color: 'var(--red)', fontWeight: 560 }}>{erro}</div>}
      </div>
    </Modal>
  );
}
