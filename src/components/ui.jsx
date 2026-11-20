import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { X, Eye, EyeOff, CircleCheck, CircleAlert, TriangleAlert, Clock } from 'lucide-react';

// logo
export function Logo({ size = 30 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#2547C0" />
      <rect x="7" y="6" width="19" height="21" rx="2.5" fill="#fff" />
      <rect x="12.2" y="15.3" width="11.6" height="3.4" rx="1" fill="#FFE45E" />
      <path d="M13.4 12.5h9.6M13.4 17h9.6M13.4 21.5h6.6" stroke="#9DB0E6" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11 6v21" stroke="#E35B60" strokeWidth="1.3" />
    </svg>
  );
}

const AVATAR = ['#2547C0', '#1d7a4f', '#b4472a', '#6250d6', '#0f7c8c', '#a2397a', '#7a5a1c'];
export function Avatar({ nome, cor = 0, size }) {
  const letra = String(nome || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="avatar" style={{ background: AVATAR[cor % AVATAR.length], ...(size ? { width: size, height: size } : null) }} aria-hidden="true">
      {letra}
    </span>
  );
}
export const AVATAR_CORES = AVATAR.length;

export function Field({ label, hint, error, children, id, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {error ? <div className="err" role="alert">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function PasswordInput({ id, value, onChange, placeholder, autoFocus, invalid, autoComplete = 'current-password', onKeyDown }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pwd">
      <input
        id={id}
        className={`input ${invalid ? 'bad' : ''}`}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        spellCheck={false}
        onKeyDown={onKeyDown}
        maxLength={200}
      />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Esconder senha' : 'Mostrar senha'} title={show ? 'Esconder senha' : 'Mostrar senha'}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" className="switch" aria-checked={Boolean(checked)} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} />
  );
}

export function Seg({ value, options, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="empty">
      {Icon && <Icon />}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

const STATUS_ICON = { aprovado: CircleCheck, abaixo: CircleAlert, risco: TriangleAlert, erro: CircleAlert, andamento: Clock, vazio: Clock, aviso: TriangleAlert };
export function Status({ tipo, children }) {
  const Icon = STATUS_ICON[tipo] || Clock;
  return (
    <span className={`status ${tipo}`}>
      <Icon aria-hidden="true" />
      {children}
    </span>
  );
}

/* modal */
export function Modal({ title, sub, onClose, children, footer, size = '', initialFocus = true }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement;
    if (initialFocus && ref.current) {
      const first = ref.current.querySelector('[data-autofocus], .modal-body input:not([type=checkbox]), .modal-body select, .modal-body textarea');
      (first || ref.current).focus();
    }
    return () => prev && prev.focus && prev.focus();
  }, [initialFocus]);
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
    if (e.key === 'Tab' && ref.current) {
      // prende o tab dentro
      const els = [...ref.current.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={onKey}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {sub && <div className="sub">{sub}</div>}
          </div>
          <button type="button" className="btn ghost icon small" onClick={onClose} aria-label="Fechar" title="Fechar (Esc)">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

const UiContext = createContext(null);
export const useUi = () => useContext(UiContext);

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [ask, setAsk] = useState(null);

  const toast = useCallback((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, msg, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.undo ? 7000 : 3600);
  }, []);
  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  const confirm = useCallback((opts) => new Promise((resolve) => setAsk({ ...opts, resolve })), []);
  const answer = (v) => {
    ask.resolve(v);
    setAsk(null);
  };

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tipo === 'erro' ? 'bad' : ''}`}>
            <span>{t.msg}</span>
            {t.undo && (
              <button type="button" onClick={() => { t.undo(); dismiss(t.id); }}>
                Desfazer
              </button>
            )}
          </div>
        ))}
      </div>
      {ask && (
        <Modal
          title={ask.title}
          size="narrow"
          onClose={() => answer(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => answer(false)}>
                {ask.cancelLabel || 'Cancelar'}
              </button>
              <button type="button" className={`btn ${ask.danger ? 'danger solid' : 'primary'}`} onClick={() => answer(true)} data-autofocus>
                {ask.confirmLabel || 'Confirmar'}
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }} className="muted">{ask.message}</p>
        </Modal>
      )}
    </UiContext.Provider>
  );
}

export function Popover({ open, onClose, children, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="popover" ref={ref} style={style} role="menu">
      {children}
    </div>
  );
}
