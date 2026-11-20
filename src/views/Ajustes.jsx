import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Download, FolderOpen, Trash2, Copy, Bell, CircleCheck, CircleAlert, Grid3x3 } from 'lucide-react';
import { Modal, Field, PasswordInput, Switch, Seg } from '../components/ui.jsx';
import { forcaSenha, erroSenha, erroPin } from '../lib/strength.js';
import { fmtDataHora } from '../lib/format.js';

export default function Ajustes({ ctx }) {
  const { data, update, api, toast } = ctx;
  const s = data.settings;
  const [modal, setModal] = useState(null);
  const [info, setInfo] = useState(null);
  const [acessos, setAcessos] = useState([]);
  const [nome, setNome] = useState(data.profile.nome);
  const [escola, setEscola] = useState(data.profile.escola || '');

  const [pin, setPin] = useState(null);

  useEffect(() => {
    api.info().then((r) => r && r.ok && setInfo(r));
    api.historicoAcessos().then((r) => r && r.ok && setAcessos(r.historico));
    api.pinStatus().then((r) => r && r.ok && setPin(r));
  }, [api, modal]);

  const desligarPin = async () => {
    const r = await api.pinRemover();
    if (r?.ok) {
      setPin((p) => ({ ...p, ativo: false }));
      toast('PIN desligado. Agora só a senha entra.');
    }
  };

  const setS = (k) => (v) => update((d) => { d.settings[k] = v; });
  const salvarPerfil = () => {
    const n = nome.trim();
    if (!n) return setNome(data.profile.nome);
    if (n !== data.profile.nome || escola.trim() !== (data.profile.escola || '')) {
      update((d) => { d.profile.nome = n; d.profile.escola = escola.trim(); }, { msg: 'Perfil salvo.' });
    }
  };

  const exportar = async () => {
    const r = await api.exportarConta();
    if (r?.ok) toast('Cópia salva. Guarde ela num pen drive ou na nuvem.');
    else if (r && !r.cancelado) toast(r.erro || 'Não deu para salvar a cópia.', { tipo: 'erro' });
  };
  const testar = async () => {
    const r = await api.testarAviso();
    toast(r && r.ok ? 'Aviso enviado. Ele aparece no canto da tela.' : 'O Windows não deixou mostrar o aviso. Confira as notificações nas configurações do Windows.', r && r.ok ? {} : { tipo: 'erro' });
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="hand">Ajustes</h1>
          <div className="sub">Perfil, aparência, avisos e segurança da sua conta.</div>
        </div>
      </div>
      <div className="settings">
        <section className="sheet">
          <div className="sheet-head"><h2>Perfil</h2></div>
          <div className="sheet-body grid2">
            <Field label="Nome" id="aj-nome"><input id="aj-nome" className="input" value={nome} onChange={(e) => setNome(e.target.value)} onBlur={salvarPerfil} maxLength={60} /></Field>
            <Field label="Escola ou curso (opcional)" id="aj-esc" hint="Aparece no boletim em PDF"><input id="aj-esc" className="input" value={escola} onChange={(e) => setEscola(e.target.value)} onBlur={salvarPerfil} maxLength={80} /></Field>
          </div>
        </section>

        <section className="sheet">
          <div className="sheet-head"><h2>Aparência</h2></div>
          <div className="set-row">
            <div className="txt"><div className="t">Tema</div><div className="d">Caderno é o claro; Lousa, o escuro. Automático segue o Windows.</div></div>
            <Seg label="Tema" value={s.theme} onChange={setS('theme')} options={[{ value: 'auto', label: 'Automático' }, { value: 'caderno', label: 'Caderno' }, { value: 'lousa', label: 'Lousa' }]} />
          </div>
          <div className="set-row">
            <div className="txt"><div className="t">Casas decimais das notas</div><div className="d">{s.casas === 1 ? 'Ex.: 7,5' : 'Ex.: 7,45'}</div></div>
            <Seg label="Casas decimais" value={s.casas} onChange={setS('casas')} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]} />
          </div>
        </section>

        <section className="sheet">
          <div className="sheet-head"><h2>Avisos</h2><span className="spacer" /><button type="button" className="btn small" onClick={testar}><Bell /> Testar aviso</button></div>
          <div className="set-row">
            <div className="txt"><div className="t">Avisar dos eventos do calendário</div><div className="d">No horário que você escolheu em cada evento.</div></div>
            <Switch checked={s.avisos} onChange={setS('avisos')} label="Avisar dos eventos" />
          </div>
          <div className="set-row">
            <div className="txt"><div className="t">Mostrar o assunto no aviso</div><div className="d">Desligado, o aviso só diz que há um lembrete, sem mostrar o que é para quem estiver olhando a tela.</div></div>
            <Switch checked={s.avisoDetalhes} onChange={setS('avisoDetalhes')} label="Mostrar o assunto no aviso" />
          </div>
          <div className="set-row">
            <div className="txt"><div className="t">Avisar antes de cada aula</div><div className="d">Usa o seu horário da semana.</div></div>
            {s.avisoAulas && (
              <select className="select" value={s.avisoAulasMin} onChange={(e) => setS('avisoAulasMin')(Number(e.target.value))} aria-label="Quanto tempo antes da aula" style={{ minWidth: 140 }}>
                {[0, 5, 10, 15].map((m) => <option key={m} value={m}>{m ? `${m} min antes` : 'Na hora'}</option>)}
              </select>
            )}
            <Switch checked={s.avisoAulas} onChange={setS('avisoAulas')} label="Avisar antes de cada aula" />
          </div>
          <div className="set-row">
            <div className="txt"><div className="t">Continuar avisando com a janela fechada</div><div className="d">Ao fechar, a Caderneta trava e fica perto do relógio. Para sair de vez, clique com o botão direito no ícone e escolha Sair.</div></div>
            <Switch checked={s.segundoPlano} onChange={setS('segundoPlano')} label="Continuar avisando com a janela fechada" />
          </div>
        </section>

        <section className="sheet">
          <div className="sheet-head"><ShieldCheck size={18} style={{ color: 'var(--ok)' }} /><h2>Segurança</h2></div>
          <div className="set-row">
            <div className="txt"><div className="t">Travar sozinho</div><div className="d">Depois de um tempo sem mexer, pede a senha (ou o PIN) de novo. Também trava quando o Windows trava (Win+L) ou o PC dorme.</div></div>
            <select className="select" value={s.autoLockMin} onChange={(e) => setS('autoLockMin')(Number(e.target.value))} aria-label="Travar sozinho depois de">
              {[1, 5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>Depois de {m} min</option>)}
              <option value={0}>Nunca</option>
            </select>
          </div>
          <div className="set-row">
            <div className="txt"><div className="t">Esconder de capturas de tela</div><div className="d">Prints, gravações e compartilhamento de tela mostram a janela preta.</div></div>
            <Switch checked={s.protegerCaptura} onChange={setS('protegerCaptura')} label="Esconder de capturas de tela" />
          </div>
          <div className="set-row">
            <div className="txt">
              <div className="t">Entrar com PIN</div>
              <div className="d">
                {pin && pin.ativo
                  ? `Ligado, com ${pin.digitos} números. Vale só neste computador; errou 5 vezes, ele desliga. A cada 30 dias o app pede a senha uma vez, para você não esquecer dela.`
                  : pin && !pin.disponivel
                    ? 'Este computador não deixa guardar o PIN com segurança.'
                    : 'Um PIN só de números para entrar rápido neste computador, sem digitar a senha inteira.'}
              </div>
            </div>
            {pin && pin.ativo ? (
              <div className="inline">
                <button type="button" className="btn ghost" onClick={desligarPin}>Desligar</button>
                <button type="button" className="btn" onClick={() => setModal('pin')}>Trocar PIN</button>
              </div>
            ) : (
              <button type="button" className="btn" onClick={() => setModal('pin')} disabled={!pin || !pin.disponivel}><Grid3x3 /> Criar PIN</button>
            )}
          </div>
          <div className="set-row">
            <div className="txt"><div className="t">Senha</div><div className="d">Troque se achar que alguém descobriu.</div></div>
            <button type="button" className="btn" onClick={() => setModal('senha')}><KeyRound /> Trocar senha</button>
          </div>
          <div className="set-row">
            <div className="txt"><div className="t">Código de recuperação</div><div className="d">Perdeu o código? Gere outro. O antigo para de funcionar.</div></div>
            <button type="button" className="btn" onClick={() => setModal('codigo')}>Gerar novo código</button>
          </div>
          <div className="set-row" style={{ alignItems: 'flex-start' }}>
            <div className="txt">
              <div className="t">Últimos acessos</div>
              <div className="d" style={{ marginBottom: 8 }}>Entradas e tentativas de senha e de PIN nesta conta.</div>
              <ul className="list access-list" style={{ border: '1px solid var(--rule)', borderRadius: 10, maxHeight: 220, overflowY: 'auto' }}>
                {acessos.length === 0 && <li className="muted">Nenhum registro.</li>}
                {acessos.slice(0, 12).map((a, i) => (
                  <li key={a.em + i} style={{ minHeight: 36, padding: '6px 12px', color: a.ok ? 'var(--ink)' : 'var(--red)' }}>
                    {a.ok ? <CircleCheck size={15} style={{ color: 'var(--ok)' }} /> : <CircleAlert size={15} />}
                    <span className="grow">{a.ok ? (a.via === 'recuperacao' ? 'Entrou com o código de recuperação' : a.via === 'criacao' ? 'Conta criada' : a.via === 'pin' ? 'Entrou com o PIN' : 'Entrou com a senha') : a.via === 'recuperacao' ? 'Código de recuperação errado' : a.via === 'pin' ? 'PIN errado' : 'Senha errada'}</span>
                    <span className="small muted num">{fmtDataHora(a.em)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="sheet">
          <div className="sheet-head"><h2>Cópia de segurança</h2></div>
          <div className="set-row">
            <div className="txt"><div className="t">Salvar uma cópia</div><div className="d">Um arquivo .cad criptografado, que só abre com a sua senha ou o código. Para restaurar, use "Restaurar de uma cópia" na tela de entrada.</div></div>
            <button type="button" className="btn" onClick={exportar}><Download /> Salvar cópia</button>
          </div>
          <div className="set-row">
            <div className="txt"><div className="t">Cópias automáticas</div><div className="d">O app guarda sozinho uma cópia por dia dos últimos 30 dias, também criptografadas.{info ? ` Pasta: ${info.pasta}` : ''}</div></div>
            <button type="button" className="btn" onClick={() => api.abrirPasta()}><FolderOpen /> Abrir pasta</button>
          </div>
        </section>

        <section className="sheet">
          <div className="sheet-head"><h2>Apagar conta</h2></div>
          <div className="set-row">
            <div className="txt"><div className="t">Apagar esta conta e todos os dados dela</div><div className="d">Notas, horário, calendário e as cópias automáticas deste computador. Cópias salvas em outro lugar continuam lá.</div></div>
            <button type="button" className="btn danger" onClick={() => setModal('apagar')}><Trash2 /> Apagar conta</button>
          </div>
        </section>

        <p className="small faint">Caderneta {info ? info.versao : ''}. Seus dados ficam só neste computador, criptografados (AES-256), e não vão para a internet.</p>
      </div>

      {modal === 'pin' && <CriarPin ctx={ctx} trocar={Boolean(pin && pin.ativo)} onClose={() => setModal(null)} />}
      {modal === 'senha' && <TrocarSenha ctx={ctx} onClose={() => setModal(null)} />}
      {modal === 'codigo' && <NovoCodigo ctx={ctx} onClose={() => setModal(null)} />}
      {modal === 'apagar' && <ApagarConta ctx={ctx} onClose={() => setModal(null)} />}
    </>
  );
}

function CriarPin({ ctx, trocar, onClose }) {
  const { api, toast } = ctx;
  const [senha, setSenha] = useState('');
  const [pin, setPin] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const soNumeros = (v) => v.replace(/\D/g, '').slice(0, 12);
  const salvar = async () => {
    if (!senha) return setErro('Digite sua senha, para confirmar que é você.');
    const e = erroPin(pin, conf);
    if (e) return setErro(e);
    setBusy(true);
    const r = await api.pinDefinir({ senha, pin });
    setBusy(false);
    if (r?.ok) {
      toast(trocar ? 'PIN trocado.' : 'PIN criado. Na próxima vez, é só digitar ele.');
      onClose();
    } else setErro((r && r.erro) || 'A senha está errada.');
  };
  return (
    <Modal title={trocar ? 'Trocar o PIN' : 'Criar PIN'} size="narrow" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn primary" onClick={salvar} disabled={busy}>{busy ? 'Salvando…' : trocar ? 'Trocar PIN' : 'Criar PIN'}</button></>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <p className="muted small" style={{ margin: 0 }}>Com o PIN você entra rápido neste computador. A senha continua valendo e é pedida uma vez a cada 30 dias.</p>
        <Field label="Sua senha" id="pin-s"><PasswordInput id="pin-s" value={senha} onChange={setSenha} /></Field>
        <div className="grid2">
          <Field label="PIN (6 a 12 números)" id="pin-n">
            <input id="pin-n" className="input mono" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(soNumeros(e.target.value))} maxLength={12} />
          </Field>
          <Field label="Repita o PIN" id="pin-c">
            <input id="pin-c" className="input mono" type="password" inputMode="numeric" autoComplete="off" value={conf} onChange={(e) => setConf(soNumeros(e.target.value))} maxLength={12} />
          </Field>
        </div>
        {erro && <div className="err" role="alert">{erro}</div>}
        <div className="auth-note" style={{ margin: 0 }}>
          <ShieldCheck />
          <span>O PIN só funciona neste computador e nesta conta do Windows. Se alguém errar 5 vezes, ele é desligado e só a senha entra.</span>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function TrocarSenha({ ctx, onClose }) {
  const { api, toast, data } = ctx;
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const f = forcaSenha(nova, data.profile.nome);
  const salvar = async () => {
    if (!atual) return setErro('Digite a senha atual.');
    const e = erroSenha(nova, conf, data.profile.nome);
    if (e) return setErro(e);
    if (nova === atual) return setErro('A senha nova é igual à atual.');
    setBusy(true);
    const r = await api.trocarSenha({ atual, nova });
    setBusy(false);
    if (r?.ok) {
      toast('Senha trocada. Use a nova na próxima vez.');
      onClose();
    } else setErro((r && r.erro) || 'A senha atual está errada.');
  };
  return (
    <Modal title="Trocar senha" size="narrow" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn primary" onClick={salvar} disabled={busy}>{busy ? 'Trocando…' : 'Trocar senha'}</button></>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <Field label="Senha atual" id="ts-a"><PasswordInput id="ts-a" value={atual} onChange={setAtual} /></Field>
        <Field label="Senha nova" id="ts-n"><PasswordInput id="ts-n" value={nova} onChange={setNova} autoComplete="new-password" /></Field>
        {nova && <div><div className={`strength n${f.nivel}`}><i /><i /><i /><i /></div><div className="small" style={{ marginTop: 4 }}><strong>{f.texto}</strong> <span className="muted">{f.dica}</span></div></div>}
        <Field label="Repita a senha nova" id="ts-c" error={erro}><PasswordInput id="ts-c" value={conf} onChange={setConf} autoComplete="new-password" /></Field>
        <div className="small muted">O código de recuperação continua o mesmo.</div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function NovoCodigo({ ctx, onClose }) {
  const { api, toast } = ctx;
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState(null);
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const gerar = async () => {
    if (!senha) return setErro('Digite sua senha.');
    setBusy(true);
    const r = await api.novoCodigo({ senha });
    setBusy(false);
    if (r?.ok) setCodigo(r.codigo);
    else setErro((r && r.erro) || 'Senha errada.');
  };
  return (
    <Modal
      title={codigo ? 'Seu novo código' : 'Gerar novo código de recuperação'}
      size="narrow"
      onClose={onClose}
      footer={codigo ? <button type="button" className="btn primary" onClick={onClose}>Guardei o código</button> : <><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn primary" onClick={gerar} disabled={busy}>{busy ? 'Gerando…' : 'Gerar'}</button></>}
    >
      {codigo ? (
        <div className="stack">
          <div className="recovery">{codigo}</div>
          <div className="inline" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn small" onClick={async () => { await api.copiar(codigo, 90); toast('Código copiado. Ele sai da área de transferência em 90 segundos.'); }}><Copy /> Copiar</button>
          </div>
          <p className="muted small" style={{ margin: 0 }}>Anote num papel ou guarde no celular. O código antigo não funciona mais.</p>
        </div>
      ) : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); gerar(); }}>
          <p className="muted" style={{ margin: 0 }}>O código atual para de funcionar e um novo aparece uma única vez.</p>
          <Field label="Sua senha" id="nc-s" error={erro}><PasswordInput id="nc-s" value={senha} onChange={setSenha} /></Field>
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
}

function ApagarConta({ ctx, onClose }) {
  const { api, data } = ctx;
  const [senha, setSenha] = useState('');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const palavra = 'APAGAR';
  const apagar = async () => {
    if (texto.trim().toUpperCase() !== palavra) return setErro(`Digite ${palavra} para confirmar.`);
    if (!senha) return setErro('Digite sua senha.');
    setBusy(true);
    const r = await api.apagarConta({ senha });
    setBusy(false);
    if (!r || !r.ok) setErro((r && r.erro) || 'Senha errada.');
  };
  return (
    <Modal title={`Apagar a conta de ${data.profile.nome}?`} size="narrow" onClose={onClose} footer={<><button type="button" className="btn" onClick={onClose}>Cancelar</button><button type="button" className="btn danger solid" onClick={apagar} disabled={busy}>{busy ? 'Apagando…' : 'Apagar para sempre'}</button></>}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); apagar(); }}>
        <div className="banner bad" style={{ margin: 0 }}><Trash2 /><span>Isso não tem volta. Se quiser guardar alguma coisa, salve uma cópia antes.</span></div>
        <Field label={`Digite ${palavra}`} id="ap-t"><input id="ap-t" className="input" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" /></Field>
        <Field label="Sua senha" id="ap-s" error={erro}><PasswordInput id="ap-s" value={senha} onChange={setSenha} /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
