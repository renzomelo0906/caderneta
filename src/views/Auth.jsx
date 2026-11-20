import { useEffect, useRef, useState } from 'react';
import { ChevronRight, UserPlus, Upload, KeyRound, ArrowLeft, ShieldCheck, Copy, Download, Lock, Grid3x3 } from 'lucide-react';
import { Logo, Avatar, Field, PasswordInput, AVATAR_CORES, useUi } from '../components/ui.jsx';
import { forcaSenha, erroSenha } from '../lib/strength.js';
import { fmtData, fmtDataHora } from '../lib/format.js';

const mmss = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function Auth({ api, onEnter }) {
  const { toast } = useUi();
  const [contas, setContas] = useState(null);
  const [tela, setTela] = useState({ modo: 'lista' });

  const carregar = async () => {
    const r = await api.listarContas();
    const lista = r && r.ok ? r.contas : [];
    setContas(lista);
    return lista;
  };
  useEffect(() => {
    carregar().then((lista) => {
      if (!lista.length) setTela({ modo: 'criar' });
      else if (lista.length === 1) setTela({ modo: 'senha', conta: lista[0] });
    });
  }, []);

  if (!contas) return <div className="auth" />;

  const voltar = contas.length ? () => setTela({ modo: 'lista' }) : null;
  let body;
  if (tela.modo === 'lista') body = <Lista contas={contas} onPick={(conta) => setTela({ modo: 'senha', conta })} onCriar={() => setTela({ modo: 'criar' })} onImportar={() => importar()} />;
  else if (tela.modo === 'senha') body = <Senha api={api} conta={tela.conta} outras={contas.length > 1} onVoltar={voltar} onEnter={onEnter} onEsqueci={() => setTela({ modo: 'recuperar', conta: tela.conta })} onCriar={() => setTela({ modo: 'criar' })} onImportar={() => importar()} />;
  else if (tela.modo === 'criar') body = <Criar api={api} primeira={!contas.length} corInicial={contas.length % AVATAR_CORES} onVoltar={voltar} onCriada={(conta, codigo) => setTela({ modo: 'codigo', conta, codigo, json: null, resumo: null, motivo: 'criacao' })} onImportar={() => importar()} />;
  else if (tela.modo === 'codigo') body = <Codigo api={api} codigo={tela.codigo} motivo={tela.motivo} onContinuar={() => onEnter(tela.conta, tela.json, tela.resumo)} />;
  else if (tela.modo === 'recuperar') body = <Recuperar api={api} conta={tela.conta} onVoltar={() => setTela({ modo: 'senha', conta: tela.conta })} onRecuperada={(json, codigo, resumo) => setTela({ modo: 'codigo', conta: tela.conta, codigo, json, resumo, motivo: 'recuperacao' })} />;
  else if (tela.modo === 'importar') body = <Importar api={api} info={tela.info} onVoltar={() => setTela(contas.length ? { modo: 'lista' } : { modo: 'criar' })} onFeito={async (id) => { const lista = await carregar(); toast('Conta restaurada. Entre com a senha dela.'); const c = lista.find((x) => x.id === id); setTela(c ? { modo: 'senha', conta: c } : { modo: 'lista' }); }} />;

  async function importar() {
    const r = await api.importarEscolher();
    if (!r || r.cancelado) return;
    if (!r.ok) return toast(r.erro || 'Não deu para abrir esse arquivo.', { tipo: 'erro' });
    setTela({ modo: 'importar', info: r });
  }

  return (
    <div className="auth">
      <div className={`auth-card ${tela.modo === 'codigo' ? 'wide' : ''}`}>
        <div className="auth-brand">
          <Logo size={40} />
          <div>
            <div className="name hand">Caderneta</div>
            <div className="tag">Notas, horário e calendário da escola</div>
          </div>
        </div>
        {body}
      </div>
    </div>
  );
}

function Lista({ contas, onPick, onCriar, onImportar }) {
  return (
    <>
      <h2>Quem está usando?</h2>
      <p className="muted" style={{ margin: 0 }}>Cada pessoa tem a própria conta, com senha.</p>
      <div className="accounts">
        {contas.map((c) => (
          <button key={c.id} type="button" className="account" onClick={() => onPick(c)}>
            <Avatar nome={c.nome} cor={c.cor} />
            <span>
              <span className="nm" style={{ display: 'block' }}>{c.nome}</span>
              <span className="sub">{c.bloqueado ? `Bloqueada por ${mmss(c.restanteMs)}` : `Conta criada em ${fmtData(String(c.criadoEm).slice(0, 10))}`}</span>
            </span>
            <ChevronRight className="go" />
          </button>
        ))}
      </div>
      <div className="auth-links">
        <button type="button" className="link inline" onClick={onCriar}><UserPlus size={15} /> Criar outra conta</button>
        <button type="button" className="link inline" onClick={onImportar}><Upload size={15} /> Restaurar de uma cópia</button>
      </div>
    </>
  );
}

function useCountdown(ms) {
  const [left, setLeft] = useState(ms);
  useEffect(() => {
    setLeft(ms);
    if (!ms) return undefined;
    const end = Date.now() + ms;
    const t = setInterval(() => {
      const l = Math.max(0, end - Date.now());
      setLeft(l);
      if (!l) clearInterval(t);
    }, 250);
    return () => clearInterval(t);
  }, [ms]);
  return left;
}

const PIN_EXPIRADO = 'Faz 30 dias que você entra só com o PIN. Digite a senha desta vez, para não esquecer dela. Depois o PIN volta a funcionar.';

function Senha(props) {
  const { conta } = props;
  const pin = conta.pin && conta.pin.ativo ? conta.pin : null;
  const [modo, setModo] = useState(pin && !pin.expirado ? 'pin' : 'senha');
  const [aviso, setAviso] = useState(pin && pin.expirado ? PIN_EXPIRADO : '');
  if (modo === 'pin') return <PinEntrada {...props} digitos={pin.digitos} onSenha={(msg) => { setAviso(msg || ''); setModo('senha'); }} />;
  return <SenhaEntrada {...props} aviso={aviso} onPin={pin && !pin.expirado && !aviso ? () => setModo('pin') : null} />;
}

function PinEntrada({ api, conta, outras, onVoltar, onEnter, onSenha, digitos = 6 }) {
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  const enviar = async (valor) => {
    if (busy || valor.length < 6) return;
    setBusy(true);
    setErro('');
    const r = await api.entrarPin({ id: conta.id, pin: valor });
    setBusy(false);
    if (r?.ok) return onEnter(conta, r.json, r.resumo);
    setPin('');
    if (r && r.codigo === 'pin-desligado') return onSenha('Você errou o PIN 5 vezes e ele foi desligado, por segurança. Entre com a senha. Depois dá para criar outro PIN em Ajustes.');
    if (r && r.codigo === 'pin-expirado') return onSenha(PIN_EXPIRADO);
    if (r && r.codigo === 'sem-pin') return onSenha('O PIN não vale mais neste computador. Entre com a senha.');
    setErro(r && r.codigo === 'pin-errado' ? `PIN errado. ${r.restantes === 1 ? 'Só mais 1 tentativa' : `Mais ${r.restantes} tentativas`} antes de ele ser desligado.` : (r && r.erro) || 'Não deu para entrar.');
    setTimeout(() => ref.current && ref.current.focus(), 0);
  };
  const mudar = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 12);
    setPin(d);
    setErro('');
    if (d.length === digitos) enviar(d); // entra sozinho no ultimo digito
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); enviar(pin); }} className="stack">
      <div className="inline">
        <Avatar nome={conta.nome} cor={conta.cor} size={40} />
        <div>
          <h2 style={{ margin: 0 }}>Oi, {conta.nome}</h2>
          <div className="muted small">Digite seu PIN de {digitos} números.</div>
        </div>
      </div>
      <div className="pin-wrap">
        <input
          id="pin"
          ref={ref}
          className={`input pin-input ${erro ? 'bad' : ''}`}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => mudar(e.target.value)}
          readOnly={busy}
          autoFocus
          maxLength={12}
          aria-label="PIN"
          aria-invalid={Boolean(erro)}
        />
        <div className="pin-dots" aria-hidden="true">
          {Array.from({ length: digitos }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}
        </div>
      </div>
      {erro && <div className="err" role="alert" style={{ textAlign: 'center' }}>{erro}</div>}
      {busy && <div className="small muted" style={{ textAlign: 'center' }}><span className="spin" /> Abrindo o cofre…</div>}
      <div className="auth-links" style={{ marginTop: 4 }}>
        <button type="button" className="link inline" onClick={() => onSenha('')}><KeyRound size={15} /> Usar a senha</button>
        {outras && onVoltar && <button type="button" className="link inline" onClick={onVoltar}><ArrowLeft size={15} /> Entrar com outra conta</button>}
      </div>
    </form>
  );
}

function SenhaEntrada({ api, conta, outras, onVoltar, onEnter, onEsqueci, onCriar, onImportar, aviso, onPin }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [espera, setEspera] = useState(conta.bloqueado ? conta.restanteMs : 0);
  const [busy, setBusy] = useState(false);
  const left = useCountdown(espera);
  const bloqueado = left > 0;

  const entrar = async (e) => {
    e.preventDefault();
    if (!senha || busy || bloqueado) return;
    setBusy(true);
    setErro('');
    const r = await api.entrar({ id: conta.id, senha });
    setBusy(false);
    if (r?.ok) return onEnter(conta, r.json, r.resumo);
    setSenha('');
    if (r?.bloqueio) {
      if (r.bloqueio.bloqueado) {
        setEspera(r.bloqueio.restanteMs);
        setErro('Muitas tentativas erradas.');
      } else {
        const n = r.bloqueio.livres;
        setErro(n > 0 ? `Senha incorreta. ${n === 1 ? 'Mais 1 tentativa' : `Mais ${n} tentativas`} antes de uma pausa.` : 'Senha incorreta.');
      }
    } else setErro((r && r.erro) || 'Não deu para abrir a conta.');
  };

  return (
    <form onSubmit={entrar} className="stack">
      <div className="inline">
        <Avatar nome={conta.nome} cor={conta.cor} size={40} />
        <div>
          <h2 style={{ margin: 0 }}>Oi, {conta.nome}</h2>
          <div className="muted small">Digite sua senha para abrir suas notas.</div>
        </div>
      </div>
      {aviso && (
        <div className="banner info" role="status" style={{ margin: 0 }}>
          <KeyRound />
          <span className="small">{aviso}</span>
        </div>
      )}
      <Field label="Senha" id="senha" error={bloqueado ? null : erro}>
        <PasswordInput id="senha" value={senha} onChange={setSenha} autoFocus invalid={Boolean(erro) && !bloqueado} />
      </Field>
      {bloqueado && (
        <div className="banner bad" role="alert" style={{ margin: 0 }}>
          <Lock />
          <div>
            <div className="t">Muitas tentativas erradas</div>
            <div className="small lockout">Por segurança, espere {mmss(left)} para tentar de novo.</div>
          </div>
        </div>
      )}
      <button type="submit" className="btn primary" disabled={!senha || busy || bloqueado}>
        {busy ? <><span className="spin" /> Abrindo o cofre…</> : 'Entrar'}
      </button>
      <div className="auth-links" style={{ marginTop: 4 }}>
        {onPin && <button type="button" className="link inline" onClick={onPin}><Grid3x3 size={15} /> Usar o PIN</button>}
        <button type="button" className="link inline" onClick={onEsqueci}><KeyRound size={15} /> Esqueci minha senha</button>
        {outras && onVoltar && <button type="button" className="link inline" onClick={onVoltar}><ArrowLeft size={15} /> Entrar com outra conta</button>}
        {!outras && <button type="button" className="link inline" onClick={onCriar}><UserPlus size={15} /> Criar outra conta</button>}
        {!outras && <button type="button" className="link inline" onClick={onImportar}><Upload size={15} /> Restaurar de uma cópia</button>}
      </div>
    </form>
  );
}

function Medidor({ senha, nome }) {
  const f = forcaSenha(senha, nome);
  if (!senha) return null;
  return (
    <div>
      <div className={`strength n${f.nivel}`} aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="small" style={{ marginTop: 4 }}>
        <strong>{f.texto}</strong>
        {f.dica && <span className="muted"> {f.dica}</span>}
      </div>
    </div>
  );
}

function Criar({ api, primeira, corInicial, onVoltar, onCriada, onImportar }) {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  const criar = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!nome.trim()) return setErro('Digite seu nome.');
    const err = erroSenha(senha, conf, nome);
    if (err) return setErro(err);
    setBusy(true);
    const r = await api.criarConta({ nome: nome.trim(), senha, cor: corInicial });
    setBusy(false);
    if (!r || !r.ok) return setErro((r && r.erro) || 'Não deu para criar a conta.');
    onCriada({ id: r.id, nome: nome.trim(), cor: corInicial }, r.codigo);
  };

  return (
    <form onSubmit={criar} className="stack">
      <div>
        <h2>{primeira ? 'Vamos criar sua conta' : 'Nova conta'}</h2>
        <p className="muted" style={{ margin: 0 }}>Suas notas ficam guardadas neste computador, trancadas com a sua senha.</p>
      </div>
      <Field label="Seu nome" id="nome">
        <input id="nome" className="input" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus maxLength={60} autoComplete="given-name" />
      </Field>
      <Field label="Crie uma senha" id="nova">
        <PasswordInput id="nova" value={senha} onChange={setSenha} autoComplete="new-password" />
      </Field>
      <Medidor senha={senha} nome={nome} />
      <Field label="Repita a senha" id="conf" error={erro}>
        <PasswordInput id="conf" value={conf} onChange={setConf} autoComplete="new-password" />
      </Field>
      <div className="auth-note">
        <ShieldCheck />
        <span>A senha não fica guardada em lugar nenhum. Sem ela, ninguém abre suas notas, nem quem mexer nos arquivos do computador. Se esquecer, você vai usar o código de recuperação que aparece no próximo passo.</span>
      </div>
      <button type="submit" className="btn primary" disabled={busy}>
        {busy ? <><span className="spin" /> Criando o cofre…</> : 'Criar conta'}
      </button>
      <div className="auth-links" style={{ marginTop: 4 }}>
        {onVoltar && <button type="button" className="link inline" onClick={onVoltar}><ArrowLeft size={15} /> Voltar</button>}
        <button type="button" className="link inline" onClick={onImportar}><Upload size={15} /> Já tenho uma cópia para restaurar</button>
      </div>
    </form>
  );
}

function Codigo({ api, codigo, motivo, onContinuar }) {
  const { toast } = useUi();
  const [ok, setOk] = useState(false);
  const copiar = async () => {
    await api.copiar(codigo, 90);
    toast('Código copiado. Ele sai da área de transferência em 90 segundos.');
  };
  const salvar = async () => {
    const r = await api.salvarTexto({
      nome: 'caderneta-codigo-de-recuperacao.txt',
      conteudo: `Código de recuperação da Caderneta\r\n\r\n${codigo}\r\n\r\nUse este código se esquecer a senha. Guarde este arquivo fora deste computador (no celular ou num pen drive) e apague daqui depois.\r\n`,
    });
    if (r?.ok) toast('Arquivo salvo. Guarde ele fora deste computador.');
  };
  return (
    <div className="stack">
      <div>
        <h2>{motivo === 'recuperacao' ? 'Senha trocada. Este é seu novo código' : 'Guarde seu código de recuperação'}</h2>
        <p className="muted" style={{ margin: 0 }}>
          Se você esquecer a senha, este código é o único jeito de abrir suas notas. Ele aparece só agora.
          {motivo === 'recuperacao' && ' O código antigo não funciona mais.'}
        </p>
      </div>
      <div className="recovery" aria-label="Código de recuperação">{codigo}</div>
      <div className="inline" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn small" onClick={copiar}><Copy /> Copiar</button>
        <button type="button" className="btn small" onClick={salvar}><Download /> Salvar em arquivo</button>
      </div>
      <div className="auth-note">
        <KeyRound />
        <span>Anote num papel ou guarde no celular. Não deixe só neste computador: quem pegar o código consegue trocar sua senha.</span>
      </div>
      <label className="check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>Guardei meu código num lugar seguro</span>
      </label>
      <button type="button" className="btn primary" disabled={!ok} onClick={onContinuar}>Continuar</button>
    </div>
  );
}

function Recuperar({ api, conta, onVoltar, onRecuperada }) {
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [conf, setConf] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const [espera, setEspera] = useState(0);
  const left = useCountdown(espera);

  const enviar = async (e) => {
    e.preventDefault();
    if (busy || left > 0) return;
    if (codigo.replace(/[^A-Za-z0-9]/g, '').length < 20) return setErro('O código tem 20 letras e números, em 4 grupos.');
    const err = erroSenha(senha, conf, conta.nome);
    if (err) return setErro(err);
    setBusy(true);
    setErro('');
    const r = await api.recuperar({ id: conta.id, codigo, novaSenha: senha });
    setBusy(false);
    if (r?.ok) return onRecuperada(r.json, r.codigo, r.resumo);
    if (r && r.bloqueio && r.bloqueio.bloqueado) {
      setEspera(r.bloqueio.restanteMs);
      setErro('Muitas tentativas erradas. Espere para tentar de novo.');
    } else setErro((r && r.erro) || 'Esse código não abre esta conta. Confira as letras e tente de novo.');
  };

  return (
    <form onSubmit={enviar} className="stack">
      <div>
        <h2>Esqueci a senha</h2>
        <p className="muted" style={{ margin: 0 }}>Digite o código de recuperação de {conta.nome} e escolha uma senha nova.</p>
      </div>
      <Field label="Código de recuperação" id="cod" hint="Maiúsculas, minúsculas e traços tanto faz.">
        <input id="cod" className="input mono" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoFocus placeholder="XXXXX-XXXXX-XXXXX-XXXXX" spellCheck={false} maxLength={40} />
      </Field>
      <Field label="Senha nova" id="ns">
        <PasswordInput id="ns" value={senha} onChange={setSenha} autoComplete="new-password" />
      </Field>
      <Medidor senha={senha} nome={conta.nome} />
      <Field label="Repita a senha nova" id="nc" error={left > 0 ? `${erro} (${mmss(left)})` : erro}>
        <PasswordInput id="nc" value={conf} onChange={setConf} autoComplete="new-password" />
      </Field>
      <button type="submit" className="btn primary" disabled={busy || left > 0}>
        {busy ? <><span className="spin" /> Conferindo…</> : 'Trocar a senha e entrar'}
      </button>
      <div className="auth-links" style={{ marginTop: 4 }}>
        <button type="button" className="link inline" onClick={onVoltar}><ArrowLeft size={15} /> Lembrei a senha</button>
      </div>
    </form>
  );
}

function Importar({ api, info, onVoltar, onFeito }) {
  const [segredo, setSegredo] = useState('');
  const [via, setVia] = useState('senha');
  const [substituir, setSubstituir] = useState(false);
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    if (!segredo || busy) return;
    if (info.existe && !substituir) return setErro('Marque a opção de substituir para continuar.');
    setBusy(true);
    setErro('');
    const r = await api.importarConcluir({ token: info.token, segredo, via, substituir });
    setBusy(false);
    if (r?.ok) return onFeito(r.id);
    setErro((r && r.erro) || (via === 'senha' ? 'Essa senha não abre a cópia. Use a senha da época em que a cópia foi feita.' : 'Esse código não abre a cópia.'));
  };

  return (
    <form onSubmit={enviar} className="stack">
      <div>
        <h2>Restaurar cópia</h2>
        <p className="muted" style={{ margin: 0 }}>
          Cópia da conta de <strong>{info.nome}</strong>{info.atualizadoEm ? `, salva em ${fmtDataHora(info.atualizadoEm)}` : ''}.
        </p>
      </div>
      <div className="seg" role="group" aria-label="Como abrir a cópia" style={{ alignSelf: 'flex-start' }}>
        <button type="button" aria-pressed={via === 'senha'} onClick={() => setVia('senha')}>Com a senha</button>
        <button type="button" aria-pressed={via === 'recuperacao'} onClick={() => setVia('recuperacao')}>Com o código</button>
      </div>
      <Field label={via === 'senha' ? 'Senha da cópia' : 'Código de recuperação'} id="seg" error={erro}>
        {via === 'senha' ? (
          <PasswordInput id="seg" value={segredo} onChange={setSegredo} autoFocus />
        ) : (
          <input id="seg" className="input mono" value={segredo} onChange={(e) => setSegredo(e.target.value)} autoFocus spellCheck={false} maxLength={40} />
        )}
      </Field>
      {info.existe && (
        <label className="check">
          <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} />
          <span>Essa conta já está neste computador. Substituir pelos dados da cópia (a versão atual fica guardada na pasta da conta).</span>
        </label>
      )}
      <button type="submit" className="btn primary" disabled={!segredo || busy}>
        {busy ? <><span className="spin" /> Conferindo…</> : 'Restaurar'}
      </button>
      <div className="auth-links" style={{ marginTop: 4 }}>
        <button type="button" className="link inline" onClick={onVoltar}><ArrowLeft size={15} /> Voltar</button>
      </div>
    </form>
  );
}
