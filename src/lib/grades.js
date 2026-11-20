// medias (etapa e final) + quanto preciso
// tipos: avaliacao | bonus | oficial (media da escola, substitui a conta)
import { compile, tryEvaluate, solveMinimum, normalizeName } from './formula.js';

export const FINAL = 'final'; // rec final / exame

const nmax = (p) => (p && p.notaMaxima > 0 ? p.notaMaxima : 10);
export const valeDe = (nota, p) => (nota.vale > 0 ? nota.vale : nmax(p));
export const tipoDe = (n) => (n && (n.tipo === 'bonus' || n.tipo === 'oficial') ? n.tipo : 'avaliacao');

// ordem: da parte > da materia > do periodo
export function formulaEtapaDe(periodo, materia, etapa) {
  const f = etapa && materia?.formulasEtapa?.[etapa.id];
  if (typeof f == 'string' && f.trim()) return f.trim();
  return materia?.formulaEtapa?.trim() || etapa?.formula?.trim() || 'MEDIA';
}
export const formulaFinalDe = (periodo, materia) =>
  (materia && materia.formulaFinal && materia.formulaFinal.trim()) || (periodo && periodo.formulaFinal && periodo.formulaFinal.trim()) || 'MEDIA';
export const temFormulaPropria = (materia) =>
  Boolean(materia && (materia.formulaEtapa || materia.formulaFinal || Object.keys(materia.formulasEtapa || {}).length));

export const notasDe = (data, materiaId, etapaId) =>
  data.notas.filter((n) => n.materiaId === materiaId && (etapaId === undefined || n.etapaId === etapaId));

export const RESERVADAS = new Set(['MEDIA', 'SOMA', 'BONUS']);
const usaTodas = (vars) => vars.includes('MEDIA') || vars.includes('SOMA');
const uniq = (xs) => [...new Set(xs)];

function separar(notas) {
  const avaliacoes = [];
  const bonus = [];
  let oficial = null;
  for (const n of notas) {
    const t = tipoDe(n);
    if (t === 'bonus') bonus.push(n);
    else if (t === 'oficial') {
      if (!oficial || (oficial.valor === null && n.valor !== null)) oficial = n;
    } else avaliacoes.push(n);
  }
  return { avaliacoes, bonus, oficial };
}
const somaBonus = (bonus) => bonus.reduce((s, n) => s + (n.valor || 0), 0);

// bonus automatico, a n ser q a formula use BONUS
function comBonus(formula, c, bonus, p) {
  if (!bonus.length) return { c, auto: false };
  if (c.vars.includes('BONUS') || bonus.some((n) => c.vars.includes(normalizeName(n.sigla)))) return { c, auto: false };
  const w = compile(`max(0; min(${nmax(p)}; (${formula}) + BONUS))`);
  return w.ok ? { c: w, auto: true } : { c, auto: false };
}

function mediaPonderada(itens, p) {
  let soma = 0;
  let pesos = 0;
  for (const n of itens) {
    soma += (n.valor / valeDe(n, p)) * nmax(p) * n.peso;
    pesos += n.peso;
  }
  return pesos ? soma / pesos : null;
}

// com x: as q faltam viram x
function etapaVars(notas, bonus, p, x, extras = []) {
  const vars = {};
  const usadas = x === undefined ? notas.filter((n) => n.valor !== null) : notas.map((n) => (n.valor !== null ? n : { ...n, valor: (x * valeDe(n, p)) / nmax(p) }));
  for (const n of usadas) vars[normalizeName(n.sigla)] = n.valor;
  for (const n of bonus) if (n.valor !== null) vars[normalizeName(n.sigla)] = n.valor;
  vars.BONUS = somaBonus(bonus);
  if (x !== undefined) for (const name of extras) if (vars[name] === undefined) vars[name] = x;
  const media = mediaPonderada(usadas, p);
  if (media !== null) {
    vars.MEDIA = media;
    vars.SOMA = usadas.reduce((s, n) => s + n.valor, 0);
  }
  return vars;
}

function quantoPrecisa(ast, apply, periodo) {
  const r = solveMinimum(ast, apply, periodo.mediaMinima, 0, nmax(periodo));
  if (r.status === 'possivel') r.value = Math.ceil(r.value * 10 - 1e-6) / 10; // pra cima (5,51 -> 5,6)
  return r;
}

function calcularEtapa(formula, c0, avaliacoes, bonus, periodo) {
  const { c, auto } = comBonus(formula, c0, bonus, periodo);
  const out = { valor: null, parcial: false, faltam: [], erro: null, precisa: null, comBonus: auto };
  const pendentes = avaliacoes.filter((n) => n.valor === null).map((n) => n.sigla);
  const conhecidas = new Set([...avaliacoes, ...bonus].map((n) => normalizeName(n.sigla)));
  const semCadastro = c0.vars.filter((v) => !RESERVADAS.has(v) && !conhecidas.has(v));

  const r = tryEvaluate(c.ast, etapaVars(avaliacoes, bonus, periodo));
  if (r.error) return { ...out, erro: r.error };
  if (r.value !== undefined) {
    out.valor = r.value;
    if (usaTodas(c0.vars)) out.faltam = pendentes;
  } else {
    const citadas = pendentes.filter((s) => c0.vars.includes(normalizeName(s)));
    out.faltam = uniq([...(usaTodas(c0.vars) ? pendentes : citadas), ...semCadastro]);
    if (!out.faltam.length) out.faltam = r.missing;
  }
  out.parcial = out.valor !== null && out.faltam.length > 0;
  if (out.faltam.length) out.precisa = quantoPrecisa(c.ast, (x) => etapaVars(avaliacoes, bonus, periodo, x, semCadastro), periodo);
  return out;
}

// -> {valor, parcial, faltam, precisa, bonus, oficial, calculado}
export function etapaResult(data, periodo, materia, etapa) {
  const notas = notasDe(data, materia.id, etapa.id);
  const { avaliacoes, bonus, oficial } = separar(notas);
  const formula = formulaEtapaDe(periodo, materia, etapa);
  const c0 = compile(formula);
  const base = {
    formula, notas, avaliacoes, bonus: somaBonus(bonus), bonusNotas: bonus, comBonus: false, oficial: null, calculado: null,
    valor: null, parcial: false, faltam: [], erro: null, precisa: null, vazio: false,
  };
  const calc = c0.ok && avaliacoes.length ? calcularEtapa(formula, c0, avaliacoes, bonus, periodo) : null;

  // media da escola ganha
  if (oficial && oficial.valor !== null) return { ...base, oficial, valor: oficial.valor, calculado: calc ? calc.valor : null };
  if (!c0.ok) return { ...base, erro: c0.error };
  if (!calc) return { ...base, vazio: true };
  return { ...base, ...calc };
}

export function finalResult(data, periodo, materia) {
  const formula = formulaFinalDe(periodo, materia);
  const c0 = compile(formula);
  const etapas = periodo.etapas.map((e) => ({ etapa: e, ...etapaResult(data, periodo, materia, e) }));
  const finais = notasDe(data, materia.id, FINAL);
  const { avaliacoes: recs, bonus, oficial } = separar(finais);
  const out = {
    formula, etapas, finais, valor: null, parcial: false, faltam: [], erro: null, precisa: null, vazio: false,
    bonus: somaBonus(bonus), comBonus: false, oficial: null, calculado: null,
  };
  const comValor = etapas.filter((e) => e.valor !== null);
  out.mediaEtapas = comValor.length ? comValor.reduce((s, e) => s + e.valor, 0) / comValor.length : null;

  const calcular = () => {
    const conhecidas = new Set([
      ...etapas.map((e) => normalizeName(e.etapa.codigo)),
      ...recs.map((n) => normalizeName(n.sigla)),
      ...bonus.map((n) => normalizeName(n.sigla)),
    ]);
    const semCadastro = c0.vars.filter((v) => !RESERVADAS.has(v) && !conhecidas.has(v));
    const { c, auto } = comBonus(formula, c0, bonus, periodo);
    const res = { valor: null, parcial: false, faltam: [], erro: null, precisa: null, comBonus: auto };

    const varsWith = (x) => {
      const vars = {};
      const valores = [];
      for (const e of etapas) {
        const v = e.valor !== null ? e.valor : x;
        if (v === undefined) continue;
        vars[normalizeName(e.etapa.codigo)] = v;
        valores.push(v);
      }
      for (const n of recs) {
        if (n.valor !== null) vars[normalizeName(n.sigla)] = n.valor;
        else if (x !== undefined) vars[normalizeName(n.sigla)] = (x * valeDe(n, periodo)) / nmax(periodo);
      }
      for (const n of bonus) if (n.valor !== null) vars[normalizeName(n.sigla)] = n.valor;
      vars.BONUS = somaBonus(bonus);
      if (x !== undefined) for (const name of semCadastro) vars[name] = x;
      if (valores.length) {
        vars.MEDIA = valores.reduce((s, v) => s + v, 0) / valores.length;
        vars.SOMA = valores.reduce((s, v) => s + v, 0);
      }
      return vars;
    };

    const todas = usaTodas(c0.vars);
    const etapasFaltando = etapas.filter((e) => e.valor === null && (todas || c0.vars.includes(normalizeName(e.etapa.codigo)))).map((e) => e.etapa.codigo);
    const etapaParcial = etapas.some((e) => e.parcial && (todas || c0.vars.includes(normalizeName(e.etapa.codigo))));

    const r = tryEvaluate(c.ast, varsWith());
    if (r.error) return { ...res, erro: r.error };
    if (r.value !== undefined) {
      res.valor = r.value;
      res.faltam = etapasFaltando;
      res.parcial = etapasFaltando.length > 0 || etapaParcial;
    } else {
      const recsPendentes = recs.filter((n) => n.valor === null && c0.vars.includes(normalizeName(n.sigla))).map((n) => n.sigla);
      res.faltam = uniq([...etapasFaltando, ...recsPendentes, ...semCadastro]);
      if (!res.faltam.length) res.faltam = r.missing;
    }
    if (res.faltam.length) res.precisa = quantoPrecisa(c.ast, varsWith, periodo);
    return res;
  };

  const semNada = etapas.every((e) => e.vazio) && !recs.length && !bonus.length;
  const calc = c0.ok && !semNada ? calcular() : null;
  if (oficial && oficial.valor !== null) return { ...out, oficial, valor: oficial.valor, calculado: calc ? calc.valor : null };
  if (!c0.ok) return { ...out, erro: c0.error };
  if (!calc) return { ...out, vazio: true };
  return { ...out, ...calc };
}

// aprovado|abaixo|andamento|risco|vazio|erro
export function situacao(periodo, fr) {
  if (fr.erro) return 'erro';
  if (fr.vazio) return 'vazio';
  if (fr.valor === null) return fr.mediaEtapas != null && fr.mediaEtapas + 1e-9 < periodo.mediaMinima ? 'risco' : 'andamento';
  const passa = fr.valor + 1e-9 >= periodo.mediaMinima;
  if (fr.parcial) return passa ? 'andamento' : 'risco';
  return passa ? 'aprovado' : 'abaixo';
}

export const SITUACAO_TEXTO = {
  aprovado: 'Aprovado',
  abaixo: 'Abaixo da média',
  andamento: 'Em andamento',
  risco: 'Abaixo da média até agora',
  vazio: 'Sem notas',
  erro: 'Fórmula com erro',
};

export function mediaGeral(data, periodo, materias) {
  const vals = materias.filter((m) => !m.foraDaMedia).map((m) => finalResult(data, periodo, m).valor).filter((v) => v !== null);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

// etapa atual: pela data, senao a ultima c/ nota, senao a 1a
export function etapaAtual(data, periodo, hojeISO) {
  if (!periodo) return null;
  const porData = periodo.etapas.find((e) => e.inicio && e.fim && e.inicio <= hojeISO && hojeISO <= e.fim);
  if (porData) return porData;
  const ids = new Set(data.materias.filter((m) => m.periodoId === periodo.id).map((m) => m.id));
  for (let i = periodo.etapas.length - 1; i >= 0; i--) {
    const e = periodo.etapas[i];
    if (data.notas.some((n) => n.etapaId === e.id && ids.has(n.materiaId))) return e;
  }
  return periodo.etapas[0];
}

// modo: 'avaliacoes' ou 'etapas'
export function serieDesempenho(data, periodo, materia, modo) {
  if (modo === 'etapas') {
    return periodo.etapas
      .map((e) => ({ etapa: e, r: etapaResult(data, periodo, materia, e) }))
      .filter((x) => x.r.valor !== null)
      .map((x) => ({ id: x.etapa.id, rotulo: x.etapa.codigo, detalhe: x.etapa.nome + (x.r.oficial ? ' (média da escola)' : x.r.parcial ? ' (parcial)' : ''), valor: x.r.valor }));
  }
  const ordemEtapa = new Map(periodo.etapas.map((e, i) => [e.id, i]));
  ordemEtapa.set(FINAL, periodo.etapas.length);
  return data.notas
    .filter((n) => n.materiaId === materia.id && n.valor !== null && tipoDe(n) === 'avaliacao' && ordemEtapa.has(n.etapaId))
    .map((n, i) => ({ n, i }))
    .sort((a, b) => ordemEtapa.get(a.n.etapaId) - ordemEtapa.get(b.n.etapaId) || (a.n.data || '').localeCompare(b.n.data || '') || a.i - b.i)
    .map(({ n }) => {
      const etapa = periodo.etapas.find((e) => e.id === n.etapaId);
      return {
        id: n.id,
        rotulo: n.sigla,
        grupo: etapa ? etapa.codigo : 'Final',
        detalhe: `${n.nome || n.sigla}, ${etapa ? etapa.nome : 'nota final'}`,
        valor: (n.valor / valeDe(n, periodo)) * nmax(periodo),
        bruto: n.valor,
        vale: valeDe(n, periodo),
        data: n.data,
      };
    });
}
