import { useMemo, useRef, useState } from 'react';
import { Copy, FileUp, Sparkles, ArrowLeft, CircleCheck, TriangleAlert, Camera, ClipboardPaste, ShieldCheck } from 'lucide-react';
import { Modal, Seg } from '../components/ui.jsx';
import { materiasDo, corDe } from '../lib/model.js';
import { FINAL } from '../lib/grades.js';
import { promptNotas, promptHorario, extrairJSON, analisarNotas, aplicarNotas, analisarHorario, aplicarHorario, ImportError } from '../lib/importar.js';
import { fmtNota, DIAS_CURTO, plural } from '../lib/format.js';

const MAX_ARQUIVO = 2 * 1024 * 1024;

export function ImportarModal({ ctx, onClose, tipo: tipoInicial = 'notas' }) {
  const { data, periodo, api, toast, update, go, escuro } = ctx;
  const [tipo, setTipo] = useState(tipoInicial === 'horario' ? 'horario' : 'notas');
  const [texto, setTexto] = useState('');
  const [obj, setObj] = useState(null);
  const [erro, setErro] = useState('');
  const [mapas, setMapas] = useState({ materias: {}, partes: {} });
  const [desmarcadas, setDesmarcadas] = useState(() => new Set());
  const [substituir, setSubstituir] = useState(true);
  const [verPedido, setVerPedido] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const arquivoRef = useRef(null);

  const analise = useMemo(() => {
    if (!obj || !periodo) return null;
    try {
      return { a: tipo === 'notas' ? analisarNotas(obj, data, periodo, mapas) : analisarHorario(obj, data, periodo, mapas) };
    } catch (e) {
      return { erro: e instanceof ImportError ? e.message : 'Não deu para ler essa resposta.' };
    }
  }, [obj, tipo, data, periodo, mapas]);

  if (!periodo) {
    return (
      <Modal title="Importar com IA" size="narrow" onClose={onClose} footer={<button type="button" className="btn primary" onClick={onClose}>Entendi</button>}>
        <p className="muted" style={{ margin: 0 }}>Crie um período primeiro (no menu do período, à esquerda). As notas e o horário entram nele.</p>
      </Modal>
    );
  }

  const pedido = tipo === 'notas' ? promptNotas(data, periodo) : promptHorario(data, periodo);
  const copiar = async () => {
    await api.copiar(pedido, 0);
    toast('Pedido copiado. Cole na IA junto com os prints.');
  };
  const trocarTipo = (t) => {
    setTipo(t);
    setObj(null);
    setErro('');
    setMapas({ materias: {}, partes: {} });
    setDesmarcadas(new Set());
  };

  const lerArquivo = async (file) => {
    if (!file) return;
    if (file.size > MAX_ARQUIVO) return setErro('Esse arquivo é grande demais. Ele deveria ter só o texto que a IA respondeu.');
    try {
      setTexto(await file.text());
      setErro('');
    } catch (_) {
      setErro('Não deu para abrir esse arquivo.');
    }
  };
  const conferir = () => {
    try {
      const o = extrairJSON(texto);
      setObj(o);
      setErro('');
      setMapas({ materias: {}, partes: {} });
      setDesmarcadas(new Set());
    } catch (e) {
      setErro(e instanceof ImportError ? e.message : 'Não deu para ler essa resposta.');
    }
  };

  // passo 1
  if (!obj || (analise && analise.erro)) {
    const msg = erro || (analise && analise.erro);
    return (
      <Modal
        key="passo1"
        title="Importar com IA"
        sub={tipo === 'notas' ? `Traga as notas do boletim para ${periodo.nome} sem digitar uma por uma.` : `Traga o horário de aulas de ${periodo.nome} de um print.`}
        size="wide"
        onClose={onClose}
        footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn primary" onClick={conferir} disabled={!texto.trim()}>Conferir</button></>}
      >
        <div className="stack" style={{ gap: 16 }}>
          <Seg label="O que importar" value={tipo} onChange={trocarTipo} options={[{ value: 'notas', label: 'Notas e médias' }, { value: 'horario', label: 'Horário' }]} />
          <ol className="passos">
            <li>
              <span className="n"><Camera /></span>
              <div>
                <div className="t">Tire print {tipo === 'notas' ? 'do boletim' : 'do horário'}</div>
                <div className="d">Abra o portal ou o app da escola e aperte <kbd>Windows</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>. {tipo === 'notas' ? 'Pode tirar vários prints, um de cada parte.' : 'Um print com a semana toda já serve.'}</div>
              </div>
            </li>
            <li>
              <span className="n"><Sparkles /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="t">Mande para uma IA, com este pedido</div>
                <div className="d">Qualquer IA gratuita que aceite imagem: ChatGPT, Gemini, Copilot, Claude. Cole os prints e o pedido na mesma mensagem.</div>
                <div className="inline" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn primary small" onClick={copiar}><Copy /> Copiar pedido</button>
                  <button type="button" className="link small" onClick={() => setVerPedido((v) => !v)}>{verPedido ? 'Esconder o pedido' : 'Ver o pedido'}</button>
                </div>
                {verPedido && <textarea className="input mono prompt-box" readOnly value={pedido} aria-label="Pedido para a IA" />}
              </div>
            </li>
            <li>
              <span className="n"><ClipboardPaste /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="t">Cole aqui a resposta</div>
                <div className="d">Copie o bloco de código que a IA respondeu (o botão de copiar fica no canto dele). Se ela mandou um arquivo, abra ou arraste ele para cá.</div>
                <textarea
                  id="imp-texto"
                  className={`input mono import-drop ${arrastando ? 'over' : ''} ${msg ? 'bad' : ''}`}
                  value={texto}
                  onChange={(e) => { setTexto(e.target.value); setErro(''); setObj(null); }}
                  onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
                  onDragLeave={() => setArrastando(false)}
                  onDrop={(e) => { e.preventDefault(); setArrastando(false); lerArquivo(e.dataTransfer.files && e.dataTransfer.files[0]); }}
                  placeholder={'{\n  "caderneta": "' + tipo + '",\n  ...\n}'}
                  spellCheck={false}
                  aria-label="Resposta da IA"
                />
                <div className="inline" style={{ marginTop: 8 }}>
                  <button type="button" className="btn small" onClick={() => arquivoRef.current && arquivoRef.current.click()}><FileUp /> Abrir arquivo</button>
                  <input ref={arquivoRef} type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={(e) => { lerArquivo(e.target.files[0]); e.target.value = ''; }} />
                  {texto && <button type="button" className="link small" onClick={() => { setTexto(''); setErro(''); setObj(null); }}>Limpar</button>}
                </div>
                {msg && <div className="err" role="alert" style={{ marginTop: 8 }}>{msg}</div>}
              </div>
            </li>
          </ol>
          <div className="auth-note" style={{ margin: 0 }}>
            <ShieldCheck />
            <span>O app não manda nada para a internet: os prints vão só para a IA que você escolher. A IA pode errar, então na próxima tela você confere tudo antes de importar.</span>
          </div>
        </div>
      </Modal>
    );
  }

  // passo 2
  const a = analise.a;
  const importaveis = a.linhas.filter((l) => l.status === 'nova' || l.status === 'atualiza');
  const marcadas = new Set(importaveis.filter((l) => !desmarcadas.has(l.i)).map((l) => l.i));
  const alternar = (i) => setDesmarcadas((s) => {
    const n = new Set(s);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    return n;
  });
  const todas = marcadas.size === importaveis.length;
  const alternarTodas = () => setDesmarcadas(todas ? new Set(importaveis.map((l) => l.i)) : new Set());
  const materias = materiasDo(data, periodo.id);
  const mat = (id) => materias.find((m) => m.id === id);
  const etapa = (id) => (id === FINAL ? { codigo: 'Final', nome: 'Período todo' } : periodo.etapas.find((e) => e.id === id));
  const aulasAtuais = data.aulas.filter((x) => x.periodoId === periodo.id).length;
  const casas = data.settings.casas;
  const setMapa = (grupo, chave, valor) => setMapas((x) => ({ ...x, [grupo]: { ...x[grupo], [chave]: valor } }));

  const importar = () => {
    if (!marcadas.size) return;
    const sel = a.linhas.filter((l) => marcadas.has(l.i));
    const novas = sel.filter((l) => l.status === 'nova').length;
    const atual = sel.filter((l) => l.status === 'atualiza').length;
    const criar = new Set(sel.filter((l) => l.materiaId === 'nova').map((l) => l.materiaChave)).size;
    let msg;
    if (tipo === 'notas') {
      msg = [novas && `${plural(novas, 'nota nova', 'notas novas')}`, atual && `${plural(atual, 'atualizada', 'atualizadas')}`, criar && `${plural(criar, 'matéria criada', 'matérias criadas')}`].filter(Boolean).join(', ') + '.';
      update((d) => { aplicarNotas(d, a, periodo.id, marcadas); }, { undo: `Importado: ${msg}` });
      onClose();
      go('notas');
    } else {
      msg = `${plural(novas, 'aula importada', 'aulas importadas')}${criar ? `, ${plural(criar, 'matéria criada', 'matérias criadas')}` : ''}.`;
      update((d) => { aplicarHorario(d, a, periodo.id, marcadas, { substituir: substituir && aulasAtuais > 0 }); }, { undo: `Horário ${substituir && aulasAtuais ? 'trocado' : 'importado'}: ${msg}` });
      onClose();
      go('horario');
    }
  };

  const r = a.resumo;
  const partesResumo = [
    r.novas && `${r.novas} ${tipo === 'notas' ? (r.novas === 1 ? 'nova' : 'novas') : r.novas === 1 ? 'aula' : 'aulas'}`,
    r.atualiza && `${r.atualiza} ${r.atualiza === 1 ? 'atualiza' : 'atualizam'} uma nota que já existe`,
    r.iguais && `${r.iguais} já ${r.iguais === 1 ? 'estava igual' : 'estavam iguais'}`,
    r.repetidas && `${r.repetidas} ${r.repetidas === 1 ? 'repetida' : 'repetidas'} nos prints`,
    r.erros && `${r.erros} com problema`,
  ].filter(Boolean);

  return (
    <Modal
      key="passo2"
      title={tipo === 'notas' ? 'Conferir as notas' : 'Conferir o horário'}
      sub={partesResumo.join(', ') + '.'}
      size="xwide"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={() => setObj(null)}><ArrowLeft /> Voltar</button>
          <span className="spacer" />
          <button type="button" className="btn primary" onClick={importar} disabled={!marcadas.size}>
            {tipo === 'notas' ? `Importar ${plural(marcadas.size, 'nota', 'notas')}` : substituir && aulasAtuais ? `Trocar pelo horário novo (${plural(marcadas.size, 'aula', 'aulas')})` : `Importar ${plural(marcadas.size, 'aula', 'aulas')}`}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        {a.materias.length > 0 && (
          <section>
            <h3 className="imp-h">Matérias</h3>
            <div className="map-grid">
              {a.materias.map((m) => (
                <div key={m.chave} className="map-row">
                  <span className="lido" title={m.nome}>{m.nome}</span>
                  <span className="seta" aria-hidden="true">→</span>
                  <select
                    className="select"
                    value={m.destino}
                    onChange={(e) => setMapa('materias', m.chave, e.target.value)}
                    aria-label={`Matéria do app para ${m.nome}`}
                  >
                    {materias.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                    <option value="nova">Criar matéria “{m.nome}”</option>
                    <option value="ignorar">Não importar</option>
                  </select>
                  {m.destino === 'nova' ? <span className="tag novo">nova</span> : m.destino === 'ignorar' ? <span className="tag">fora</span> : <CircleCheck className="ok-ic" aria-label="já existe" />}
                </div>
              ))}
            </div>
          </section>
        )}

        {tipo === 'notas' && a.partesDesconhecidas.length > 0 && (
          <section>
            <h3 className="imp-h">Partes que não reconheci</h3>
            <div className="map-grid">
              {a.partesDesconhecidas.map((p) => (
                <div key={p.chave} className="map-row">
                  <span className="lido">{p.texto || '(sem parte)'}</span>
                  <span className="seta" aria-hidden="true">→</span>
                  <select className="select" value={mapas.partes[p.chave] ?? ''} onChange={(e) => setMapa('partes', p.chave, e.target.value)} aria-label={`Parte do período para ${p.texto || 'as notas sem parte'}`}>
                    <option value="" disabled>Escolha…</option>
                    {periodo.etapas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                    <option value={FINAL}>Final do período</option>
                    <option value="ignorar">Não importar</option>
                  </select>
                  <span className="tag aviso">{plural(p.qtd, 'nota', 'notas')}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {tipo === 'horario' && aulasAtuais > 0 && (
          <label className="check banner info" style={{ margin: 0 }}>
            <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} />
            <span>
              <strong>Trocar o horário atual por este</strong>
              <span className="small muted" style={{ display: 'block' }}>As {aulasAtuais} aulas de agora saem e entram as do print. Desmarcado, as aulas do print são somadas às que já existem.</span>
            </span>
          </label>
        )}

        <div className="table-wrap import-table">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={todas && importaveis.length > 0} onChange={alternarTodas} disabled={!importaveis.length} aria-label="Marcar todas" />
                </th>
                {tipo === 'notas' ? <><th>Matéria</th><th>Parte</th><th>Avaliação</th><th className="r">Nota</th></> : <><th>Dia</th><th>Horário</th><th>Matéria</th><th>Sala</th></>}
                <th>O que acontece</th>
              </tr>
            </thead>
            <tbody>
              {a.linhas.map((l) => {
                const pode = l.status === 'nova' || l.status === 'atualiza';
                const m = l.materiaId && l.materiaId !== 'nova' && l.materiaId !== 'ignorar' ? mat(l.materiaId) : null;
                const e = l.etapaId && l.etapaId !== 'ignorar' ? etapa(l.etapaId) : null;
                return (
                  <tr key={l.i} className={pode ? (marcadas.has(l.i) ? '' : 'off') : 'off'}>
                    <td>{pode && <input type="checkbox" checked={marcadas.has(l.i)} onChange={() => alternar(l.i)} aria-label={`Importar ${l.nome || l.materiaNome}`} />}</td>
                    {tipo === 'notas' ? (
                      <>
                        <td>
                          <div className="subject">
                            {m && <span className="dot" style={{ background: corDe(m.cor, escuro) }} />}
                            <span className="nm">{m ? m.nome : l.materiaNome || '—'}</span>
                          </div>
                        </td>
                        <td className="muted">{e ? e.codigo : l.parteTexto || '—'}</td>
                        <td className="nowrap">{l.tipo === 'oficial' ? <span className="muted">Média da escola</span> : <>{l.nome} {l.sigla && <span className="code">{l.sigla}</span>}</>}</td>
                        <td className="r num nowrap" style={{ fontWeight: 650 }}>
                          {Number.isNaN(l.valor) ? '?' : l.valor === null ? <span className="faint">a fazer</span> : l.tipo === 'bonus' ? `${l.valor > 0 ? '+' : ''}${fmtNota(l.valor, casas)}` : fmtNota(l.valor, casas)}
                          {l.vale ? <span className="faint small"> de {fmtNota(l.vale, casas).replace(/,0+$/, '')}</span> : null}
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{l.dia !== null && l.dia !== undefined ? DIAS_CURTO[l.dia] : l.diaTexto || '—'}</td>
                        <td className="num">{l.inicio || '?'}–{l.fim || '?'}{l.fimEstimado && <span className="faint small" title="O print não tinha o fim; o app estimou"> ~</span>}</td>
                        <td>
                          <div className="subject">
                            {m && <span className="dot" style={{ background: corDe(m.cor, escuro) }} />}
                            <span className="nm">{m ? m.nome : l.materiaNome || '—'}</span>
                          </div>
                        </td>
                        <td className="muted">{l.sala || '—'}</td>
                      </>
                    )}
                    <td><Acontece l={l} tipo={tipo} casas={casas} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {r.erros > 0 && <p className="small muted" style={{ margin: 0 }}>Linhas com problema ficam de fora. Se forem muitas, volte, peça para a IA conferir e cole a resposta de novo.</p>}
      </div>
    </Modal>
  );
}

function Acontece({ l, tipo, casas }) {
  if (l.status === 'erro') return <span className="imp-st bad"><TriangleAlert size={14} /> {l.erro}</span>;
  if (l.status === 'atualiza') return <span className="imp-st">troca {l.antes === null ? 'a fazer' : fmtNota(l.antes, casas)} por {l.valor === null ? 'a fazer' : fmtNota(l.valor, casas)}</span>;
  if (l.status === 'igual') return <span className="imp-st faint">já está igual</span>;
  if (l.status === 'repetida') return <span className="imp-st faint">repetida</span>;
  if (l.status === 'ignorada') return <span className="imp-st faint">não entra</span>;
  const nova = l.materiaId === 'nova' ? ', na matéria nova' : '';
  if (tipo === 'horario') return <span className="imp-st ok">entra{nova}</span>;
  return <span className="imp-st ok">{l.tipo === 'oficial' ? 'média da escola' : l.tipo === 'bonus' ? 'bônus novo' : 'nota nova'}{nova}</span>;
}

