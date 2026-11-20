import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { House, NotebookPen, Clock, CalendarDays, ChartLine, History, Lock, ChevronDown, Check, Pencil, Plus } from 'lucide-react';
import { UiProvider, useUi, Logo, Avatar, Popover } from './components/ui.jsx';
import { normalize, emptyData, periodoAtual, TIPOS_ETAPA } from './lib/model.js';
import { agendaDeAvisos } from './lib/events.js';
import Auth from './views/Auth.jsx';
import Onboarding from './views/Onboarding.jsx';
import Inicio from './views/Inicio.jsx';
import Notas from './views/Notas.jsx';
import Horario from './views/Horario.jsx';
import Calendario from './views/Calendario.jsx';
import Desempenho from './views/Desempenho.jsx';
import Historico from './views/Historico.jsx';
import Ajustes from './views/Ajustes.jsx';
import { PeriodoModal } from './views/Periodo.jsx';
import { NotaModal } from './views/NotaModal.jsx';
import { EventoModal } from './views/EventoModal.jsx';
import { FaltaModal } from './views/FaltaModal.jsx';
import { ImportarModal } from './views/Importar.jsx';

const api = window.caderneta;

const VIEWS = [
  { id: 'inicio', nome: 'Início', icon: House, C: Inicio },
  { id: 'notas', nome: 'Notas', icon: NotebookPen, C: Notas },
  { id: 'horario', nome: 'Horário', icon: Clock, C: Horario },
  { id: 'calendario', nome: 'Calendário', icon: CalendarDays, C: Calendario },
  { id: 'desempenho', nome: 'Desempenho', icon: ChartLine, C: Desempenho },
  { id: 'historico', nome: 'Histórico', icon: History, C: Historico },
];

// tema efetivo vem do main
function useEscuro() {
  const [escuro, setEscuro] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = mq.matches ? 'lousa' : 'caderno';
      setEscuro(mq.matches);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return escuro;
}

export default function App() {
  return (
    <UiProvider>
      <Root />
    </UiProvider>
  );
}

function Root() {
  const escuro = useEscuro();
  const [sessao, setSessao] = useState(null); // {conta, resumo}
  const [data, setData] = useState(null);

  const entrar = (conta, json, resumo) => {
    let d;
    try {
      d = json ? normalize(JSON.parse(json)) : emptyData(conta.nome);
    } catch (_) {
      d = emptyData(conta.nome);
    }
    if (!d.profile.nome) d.profile.nome = conta.nome;
    setData(d);
    setSessao({ conta, resumo, novo: !json });
  };

  if (!sessao || !data) return <Auth api={api} onEnter={entrar} />;
  return <Sessao api={api} sessao={sessao} initial={data} escuro={escuro} />;
}

function Sessao({ api, sessao, initial, escuro }) {
  const { toast, confirm } = useUi();
  const [data, setData] = useState(initial);
  const dataRef = useRef(initial);
  const [view, setView] = useState('inicio');
  const [modal, setModal] = useState(null); //{ tipo, props }
  const [resumo, setResumo] = useState(sessao.resumo);
  const mainRef = useRef(null);

  const update = useCallback((fn, opts = {}) => {
    const prev = dataRef.current;
    const next = structuredClone(prev);
    fn(next);
    dataRef.current = next;
    setData(next);
    if (opts.undo) {
      toast(opts.undo, {
        undo: () => {
          dataRef.current = prev;
          setData(prev);
        },
      });
    } else if (opts.msg) toast(opts.msg);
  }, [toast]);

  // salva qnd muda (se ja tiver salvando, salva a ultima dps)
  const fila = useRef({ busy: false, pending: null, promise: null, last: sessao.novo ? null : JSON.stringify(initial) });
  const persist = useCallback((d) => {
    const f = fila.current;
    f.pending = d;
    if (f.busy) return f.promise;
    f.busy = true;
    f.promise = (async () => {
      while (f.pending) {
        const cur = f.pending;
        f.pending = null;
        const json = JSON.stringify(cur);
        if (json === f.last) continue;
        const r = await api.salvar(json, cur.profile.nome);
        if (r?.ok) f.last = json;
        else if (r && r.codigo !== 'travado') toast(`Não deu para salvar: ${r.erro || 'erro desconhecido'}`, { tipo: 'erro' });
      }
      f.busy = false;
    })();
    return f.promise;
  }, [api, toast]);
  useEffect(() => {
    persist(data);
  }, [data, persist]);

  const travar = useCallback(async () => {
    await persist(dataRef.current);
    await api.travar();
  }, [api, persist]);

  // auto lock
  const autoLock = data.settings.autoLockMin;
  useEffect(() => {
    if (!autoLock) return undefined;
    let last = Date.now();
    const bump = () => { last = Date.now(); };
    const evs = ['mousemove', 'mousedown', 'keydown', 'wheel'];
    evs.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
    const t = setInterval(() => {
      if (Date.now() - last > autoLock * 60000) travar();
    }, 5000);
    return () => {
      clearInterval(t);
      evs.forEach((ev) => window.removeEventListener(ev, bump));
    };
  }, [autoLock, travar]);

  // ctrl+L
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        travar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [travar]);

  const s = data.settings;
  useEffect(() => { api.tema(s.theme); }, [api, s.theme]);
  useEffect(() => { api.protegerCaptura(s.protegerCaptura); }, [api, s.protegerCaptura]);
  useEffect(() => { api.segundoPlano(s.segundoPlano); }, [api, s.segundoPlano]);

  // manda os avisos p/ o windows (qnd muda e de 1 em 1h)
  useEffect(() => {
    const send = () => api.agendarAvisos(agendaDeAvisos(dataRef.current));
    const t = setTimeout(send, 600);
    const i = setInterval(send, 60 * 60 * 1000);
    return () => {
      clearTimeout(t);
      clearInterval(i);
    };
  }, [api, data.eventos, data.aulas, data.materias, s.avisos, s.avisoDetalhes, s.avisoAulas, s.avisoAulasMin, s.periodoAtualId]);

  const go = useCallback((v) => {
    setView(v);
    if (mainRef.current) mainRef.current.scrollTo(0, 0);
  }, []);
  const abrir = useCallback((tipo, props = {}) => setModal({ tipo, props }), []);
  const fechar = useCallback(() => setModal(null), []);

  const periodo = periodoAtual(data);
  const ctx = useMemo(
    () => ({ api, data, update, periodo, escuro, go, abrir, toast, confirm, conta: sessao.conta, resumo, limparResumo: () => setResumo(null), travar }),
    [api, data, update, periodo, escuro, go, abrir, toast, confirm, sessao.conta, resumo, travar]
  );

  if (!data.onboarded) return <Onboarding ctx={ctx} />;

  const atual = VIEWS.find((v) => v.id === view);
  const View = atual ? atual.C : Ajustes;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <span className="name hand">Caderneta</span>
        </div>
        <PeriodoSwitcher ctx={ctx} />
        <nav className="nav" aria-label="Seções">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" aria-current={view === v.id ? 'page' : undefined} onClick={() => go(v.id)}>
              <v.icon aria-hidden="true" />
              <span>{v.nome}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button type="button" className="me" onClick={() => go('ajustes')} aria-current={view === 'ajustes' ? 'page' : undefined}>
            <Avatar nome={data.profile.nome || sessao.conta.nome} cor={sessao.conta.cor} />
            <span style={{ minWidth: 0 }}>
              <span className="nm" style={{ display: 'block' }}>{data.profile.nome || sessao.conta.nome}</span>
              <span className="sub">Ajustes</span>
            </span>
          </button>
          <button type="button" className="btn ghost icon" onClick={travar} title="Travar agora (Ctrl+L)" aria-label="Travar agora">
            <Lock />
          </button>
        </div>
      </aside>
      <main className="main" ref={mainRef}>
        <div className="page">
          <View ctx={ctx} />
        </div>
      </main>

      {modal && modal.tipo === 'periodo' && <PeriodoModal ctx={ctx} onClose={fechar} {...modal.props} />}
      {modal && modal.tipo === 'nota' && <NotaModal ctx={ctx} onClose={fechar} {...modal.props} />}
      {modal && modal.tipo === 'evento' && <EventoModal ctx={ctx} onClose={fechar} {...modal.props} />}
      {modal && modal.tipo === 'falta' && <FaltaModal ctx={ctx} onClose={fechar} {...modal.props} />}
      {modal && modal.tipo === 'importar' && <ImportarModal ctx={ctx} onClose={fechar} {...modal.props} />}
    </div>
  );
}

function PeriodoSwitcher({ ctx }) {
  const { data, update, periodo, abrir } = ctx;
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (!periodo) {
    return (
      <button type="button" className="periodo-btn" onClick={() => abrir('periodo')}>
        <span>
          <span className="t" style={{ display: 'block' }}>Criar período</span>
          <span className="s">Ano ou semestre letivo</span>
        </span>
        <Plus />
      </button>
    );
  }
  const desc = (p) => `${p.etapas.length} ${p.etapas.length === 1 ? TIPOS_ETAPA[p.tipo].nome.toLowerCase() : TIPOS_ETAPA[p.tipo].plural}`;
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="periodo-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span style={{ minWidth: 0 }}>
          <span className="t" style={{ display: 'block' }}>{periodo.nome}</span>
          <span className="s">{desc(periodo)}{periodo.concluido ? ', concluído' : ''}</span>
        </span>
        <ChevronDown />
      </button>
      <Popover open={open} onClose={close} style={{ top: 'calc(100% - 4px)', left: 0, right: -40 }}>
        {[...data.periodos].reverse().map((p) => (
          <button
            key={p.id}
            type="button"
            className="item"
            role="menuitemradio"
            aria-checked={p.id === periodo.id}
            onClick={() => {
              update((d) => { d.settings.periodoAtualId = p.id; });
              close();
            }}
          >
            <span>
              <span style={{ display: 'block', fontWeight: 620 }}>{p.nome}</span>
              <span className="faint small">{desc(p)}</span>
            </span>
            {p.id === periodo.id && <Check className="ck" />}
          </button>
        ))}
        <hr />
        <button type="button" className="item" onClick={() => { close(); abrir('periodo', { periodoId: periodo.id }); }}>
          <Pencil /> Editar {periodo.nome}
        </button>
        <button type="button" className="item" onClick={() => { close(); abrir('periodo'); }}>
          <Plus /> Novo período
        </button>
      </Popover>
    </div>
  );
}
