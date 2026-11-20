// parser das formulas, sem eval
// 7,5 = decimal | ; (ou , c/ espaço) separa args | nomes ignoram acento/maiusc

const EPS = 1e-9;

export class FormulaError extends Error {
  constructor(message, pos = null) {
    super(message);
    this.pos = pos;
  }
}

export class MissingVar extends Error {
  constructor(name) {
    super(`Falta o valor de ${name}`);
    this.varName = name;
  }
}

export const normalizeName = (s) =>
  String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

const isDigit = (c) => c >= '0' && c <= '9';
const isLetter = (c) => /\p{L}/u.test(c) || c === '_';
const isIdentChar = (c) => isLetter(c) || isDigit(c);

const MAX_LENGTH = 500;

export function tokenize(src) {
  const s = String(src ?? '');
  if (s.length > MAX_LENGTH) throw new FormulaError(`A fórmula passou de ${MAX_LENGTH} caracteres.`);
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (isDigit(c) || (c === '.' && isDigit(s[i + 1] || ''))) {
      let j = i;
      while (isDigit(s[j] || '')) j++;
      if ((s[j] === '.' || s[j] === ',') && isDigit(s[j + 1] || '')) {
        j++;
        while (isDigit(s[j] || '')) j++;
      }
      const text = s.slice(i, j).replace(',', '.');
      toks.push({ t: 'num', v: parseFloat(text.startsWith('.') ? '0' + text : text), pos: i });
      if (isLetter(s[j] || '')) throw new FormulaError(`Número grudado em letra perto de "${s.slice(i, j + 1)}". Use * para multiplicar.`, j);
      i = j;
      continue;
    }
    if (isLetter(c)) {
      let j = i;
      while (j < s.length && isIdentChar(s[j])) j++;
      toks.push({ t: 'id', v: normalizeName(s.slice(i, j)), raw: s.slice(i, j), pos: i });
      i = j;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (['<=', '>=', '<>', '!=', '=='].includes(two)) {
      toks.push({ t: 'op', v: two === '!=' ? '<>' : two === '==' ? '=' : two, pos: i });
      i += 2;
      continue;
    }
    if ('+-*/^<>='.includes(c)) { toks.push({ t: 'op', v: c, pos: i }); i++; continue; }
    if (c === '×') { toks.push({ t: 'op', v: '*', pos: i }); i++; continue; }
    if (c === '÷') { toks.push({ t: 'op', v: '/', pos: i }); i++; continue; }
    if (c === '%') { toks.push({ t: 'pct', pos: i }); i++; continue; }
    if (c === '(') { toks.push({ t: '(', pos: i }); i++; continue; }
    if (c === ')') { toks.push({ t: ')', pos: i }); i++; continue; }
    if (c === ';' || c === ',') { toks.push({ t: 'sep', pos: i }); i++; continue; }
    throw new FormulaError(`Caractere que a fórmula não entende: "${c}"`, i);
  }
  return toks;
}

// nome: [min, max] de args
const FUNCS = {
  MAX: [1, 99], MAIOR: [1, 99], MIN: [1, 99], MENOR: [1, 99],
  MEDIA: [1, 99], SOMA: [1, 99], ARRED: [1, 2], ARREDMEIO: [1, 1],
  SE: [3, 3], ABS: [1, 1],
};
export const FUNCTION_NAMES = Object.keys(FUNCS);

const COMPARE = ['<', '<=', '>', '>=', '=', '<>'];

export function parse(src) {
  const toks = tokenize(src);
  if (!toks.length) throw new FormulaError('A fórmula está vazia.');
  let k = 0;
  const peek = () => toks[k];
  const next = () => toks[k++];
  const isOp = (t, ...ops) => t && t.t === 'op' && ops.includes(t.v);
  const where = (t) => (t ? t.pos : String(src).length);

  function expr() {
    const a = additive();
    if (isOp(peek(), ...COMPARE)) {
      const op = next().v;
      const b = additive();
      if (isOp(peek(), ...COMPARE)) throw new FormulaError('Use se() para juntar duas comparações.', where(peek()));
      return { k: 'bin', op, a, b };
    }
    return a;
  }
  function additive() {
    let a = term();
    while (isOp(peek(), '+', '-')) {
      const op = next().v;
      a = { k: 'bin', op, a, b: term() };
    }
    return a;
  }
  function term() {
    let a = unary();
    while (isOp(peek(), '*', '/')) {
      const op = next().v;
      a = { k: 'bin', op, a, b: unary() };
    }
    return a;
  }
  function unary() {
    if (isOp(peek(), '-')) { next(); return { k: 'neg', a: unary() }; }
    if (isOp(peek(), '+')) { next(); return unary(); }
    return power();
  }
  function power() {
    const a = postfix();
    if (isOp(peek(), '^')) { next(); return { k: 'bin', op: '^', a, b: unary() }; }
    return a;
  }
  function postfix() {
    let a = primary();
    while (peek() && peek().t === 'pct') { next(); a = { k: 'pct', a }; }
    return a;
  }
  function primary() {
    const t = next();
    if (!t) throw new FormulaError('A fórmula terminou no meio. Falta um número ou uma variável no fim.', where(t));
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'id') {
      if (peek() && peek().t === '(') {
        if (!FUNCS[t.v]) throw new FormulaError(`Não existe a função ${t.raw}().`, t.pos);
        next();
        const args = [];
        if (peek() && peek().t === ')') {
          next();
        } else {
          for (;;) {
            args.push(expr());
            const sep = next();
            if (sep && sep.t === 'sep') continue;
            if (sep && sep.t === ')') break;
            throw new FormulaError(`Falta fechar o parêntese de ${t.raw}(.`, where(sep));
          }
        }
        const [min, max] = FUNCS[t.v];
        if (args.length < min || args.length > max) {
          const want = min === max ? `${min}` : max === 99 ? `pelo menos ${min}` : `${min} ou ${max}`;
          throw new FormulaError(`${t.raw}() recebe ${want} ${min === 1 && max === 1 ? 'valor' : 'valores'} separados por ponto e vírgula.`, t.pos);
        }
        return { k: 'call', name: t.v, args, pos: t.pos };
      }
      return { k: 'var', name: t.v, pos: t.pos };
    }
    if (t.t === '(') {
      const e = expr();
      const close = next();
      if (!close || close.t !== ')') throw new FormulaError('Falta fechar um parêntese.', where(close));
      return e;
    }
    if (t.t === ')') throw new FormulaError('Tem um parêntese fechando sem ter aberto.', t.pos);
    if (t.t === 'sep') throw new FormulaError('Ponto e vírgula fora de uma função.', t.pos);
    throw new FormulaError(`"${t.v ?? '%'}" fora do lugar.`, t.pos);
  }

  const ast = expr();
  if (k < toks.length) {
    const t = toks[k];
    if (t.t === ')') throw new FormulaError('Tem um parêntese fechando sem ter aberto.', t.pos);
    if (t.t === 'sep') throw new FormulaError('Ponto e vírgula fora de uma função.', t.pos);
    throw new FormulaError('Falta um operador (+ - * /) entre dois valores.', t.pos);
  }
  return ast;
}

export function variablesOf(ast) {
  const out = [];
  (function walk(n) {
    if (!n) return;
    if (n.k === 'var') { if (!out.includes(n.name)) out.push(n.name); return; }
    if (n.k === 'call') return n.args.forEach(walk);
    walk(n.a);
    walk(n.b);
  })(ast);
  return out;
}

const roundTo = (x, casas) => {
  const f = 10 ** casas;
  return Math.round((x + Number.EPSILON * Math.sign(x)) * f) / f;
};

export function evaluate(ast, vars) {
  function ev(n) {
    switch (n.k) {
      case 'num': return n.v;
      case 'var': {
        const v = vars[n.name];
        if (v === undefined || v === null || Number.isNaN(v)) throw new MissingVar(n.name);
        return v;
      }
      case 'neg': return -ev(n.a);
      case 'pct': return ev(n.a) / 100;
      case 'bin': {
        const a = ev(n.a);
        const b = ev(n.b);
        switch (n.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/':
            if (b === 0) throw new FormulaError('Divisão por zero.');
            return a / b;
          case '^': return a ** b;
          case '<': return a < b ? 1 : 0;
          case '<=': return a <= b + EPS ? 1 : 0;
          case '>': return a > b ? 1 : 0;
          case '>=': return a + EPS >= b ? 1 : 0;
          case '=': return Math.abs(a - b) < EPS ? 1 : 0;
          case '<>': return Math.abs(a - b) >= EPS ? 1 : 0;
        }
        throw new FormulaError(`Operador desconhecido ${n.op}`);
      }
      case 'call': {
        // se(): so calcula o lado escolhido
        if (n.name === 'SE') return ev(n.args[0]) !== 0 ? ev(n.args[1]) : ev(n.args[2]);
        const xs = n.args.map(ev);
        switch (n.name) {
          case 'MAX': case 'MAIOR': return Math.max(...xs);
          case 'MIN': case 'MENOR': return Math.min(...xs);
          case 'SOMA': return xs.reduce((s, x) => s + x, 0);
          case 'MEDIA': return xs.reduce((s, x) => s + x, 0) / xs.length;
          case 'ARRED': return roundTo(xs[0], Math.max(0, Math.min(6, Math.round(xs[1] ?? 0))));
          case 'ARREDMEIO': return Math.round(xs[0] * 2 + EPS) / 2;
          case 'ABS': return Math.abs(xs[0]);
        }
      }
    }
    throw new FormulaError('Fórmula inválida.');
  }
  const r = ev(ast);
  if (!Number.isFinite(r)) throw new FormulaError('O resultado não é um número.');
  return r;
}

// cache
const cache = new Map();
export function compile(src) {
  const key = String(src ?? '');
  if (cache.has(key)) return cache.get(key);
  let out;
  try {
    const ast = parse(key);
    out = { ok: true, ast, vars: variablesOf(ast) };
  } catch (e) {
    if (!(e instanceof FormulaError)) throw e;
    out = { ok: false, error: e.message, pos: e.pos };
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, out);
  return out;
}

export function tryEvaluate(ast, vars) {
  try {
    return { value: evaluate(ast, vars) };
  } catch (e) {
    if (e instanceof MissingVar) return { missing: [e.varName] };
    if (e instanceof FormulaError) return { error: e.message };
    throw e;
  }
}

// quanto preciso tirar: menor x em [lo,hi] q chega no target
export function solveMinimum(ast, apply, target, lo, hi) {
  const f = (x) => {
    const r = tryEvaluate(ast, apply(x));
    return r.value === undefined ? null : r.value;
  };
  const atLo = f(lo);
  if (atLo !== null && atLo + EPS >= target) return { status: 'garantido' };
  const steps = 200;
  let prev = lo;
  for (let i = 1; i <= steps; i++) {
    const x = lo + ((hi - lo) * i) / steps;
    const v = f(x);
    if (v !== null && v + EPS >= target) {
      let a = prev;
      let b = x;
      for (let j = 0; j < 40; j++) {
        const m = (a + b) / 2;
        const vm = f(m);
        if (vm !== null && vm + EPS >= target) b = m;
        else a = m;
      }
      return { status: 'possivel', value: b };
    }
    prev = x;
  }
  return { status: 'impossivel' };
}
