// npm test
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse, evaluate, compile, tryEvaluate, variablesOf, FormulaError } from '../src/lib/formula.js';
import { makePeriodo, makeMateria, suggestSigla, normalize, emptyData, makeEtapas, uid } from '../src/lib/model.js';
import { etapaResult, finalResult, situacao, serieDesempenho, FINAL, etapaAtual, mediaGeral } from '../src/lib/grades.js';
import { contagemPorDia, contagemIntervalo, conflitos, frequencia, totalAulas } from '../src/lib/schedule.js';
import { ocorrencias, eventosNoIntervalo, agendaDeAvisos, proximos } from '../src/lib/events.js';
import { forcaSenha, erroSenha, erroPin } from '../src/lib/strength.js';
import { parseNum, fmtNota } from '../src/lib/format.js';
import { relatorioHTML } from '../src/lib/report.js';
import { promptNotas, promptHorario, extrairJSON, analisarNotas, aplicarNotas, analisarHorario, aplicarHorario, lerDia, lerHora, casarParte, ImportError } from '../src/lib/importar.js';

const require = createRequire(import.meta.url);
const vault = require('../vault.js');

let fails = 0;
let total = 0;
const eq = (name, got, want) => {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(ok ? 'ok    ' : 'FALHOU', name, ok ? '' : `\n       veio     ${JSON.stringify(got)}\n       esperado ${JSON.stringify(want)}`);
};
const near = (name, got, want) => eq(name, got === null || got === undefined ? got : Math.round(got * 1000) / 1000, want);
const calc = (f, vars = {}) => evaluate(parse(f), vars);
const erro = (f) => {
  try {
    parse(f);
    return null;
  } catch (e) {
    return e instanceof FormulaError ? e.message : 'OUTRO: ' + e.message;
  }
};

// formulas
near('soma simples', calc('1 + 2 * 3'), 7);
near('parênteses', calc('(1 + 2) * 3'), 9);
near('ponderada', calc('(P1*2 + P2*3)/5', { P1: 8, P2: 6 }), 6.8);
near('vírgula decimal', calc('P1*0,4 + P2*0,6', { P1: 10, P2: 5 }), 7);
near('ponto decimal', calc('P1*.4 + P2*.6', { P1: 10, P2: 5 }), 7);
near('porcentagem', calc('P1*40% + P2*60%', { P1: 10, P2: 5 }), 7);
near('minúsculas e acento', calc('média + p1', { MEDIA: 5, P1: 1 }), 6);
near('potência', calc('2^3^2'), 512);
near('menos unário', calc('-2^2'), -4);
near('× e ÷', calc('6 × 2 ÷ 4'), 3);
near('max com ;', calc('max(P1; P2; 3)', { P1: 2, P2: 9 }), 9);
near('max com vírgula entre variáveis', calc('max(P1, P2)', { P1: 2, P2: 9 }), 9);
near('maior/menor', calc('maior(1;5) - menor(4;2)'), 3);
near('media()', calc('media(P1; P2; P3)', { P1: 6, P2: 7, P3: 8 }), 7);
near('soma()', calc('soma(1; 2; 3,5)'), 6.5);
near('arred', calc('arred(7,45; 1)'), 7.5);
near('arred sem casas', calc('arred(7,5)'), 8);
near('arredmeio', calc('arredmeio(6,74)'), 6.5);
near('arredmeio sobe', calc('arredmeio(6,76)'), 7);
near('se verdadeiro', calc('se(M >= 6; M; (M + REC)/2)', { M: 7 }), 7);
near('se falso usa REC', calc('se(M >= 6; M; (M + REC)/2)', { M: 4, REC: 8 }), 6);
eq('se não calcula o lado não usado', tryEvaluate(parse('se(M >= 6; M; REC)'), { M: 7 }), { value: 7 });
eq('variável faltando', tryEvaluate(parse('(P1+P2)/2'), { P1: 7 }), { missing: ['P2'] });
eq('divisão por zero', tryEvaluate(parse('P1/0'), { P1: 7 }), { error: 'Divisão por zero.' });
eq('variáveis usadas', variablesOf(parse('se(MEDIA>=6; MEDIA; max(P1;REC))')), ['MEDIA', 'P1', 'REC']);
near('comparação igual', calc('se(P1 = 10; 1; 0)', { P1: 10 }), 1);
near('diferente', calc('P1 <> 10', { P1: 9 }), 1);
eq('erro: parêntese aberto', erro('(P1 + P2'), 'Falta fechar um parêntese.');
eq('erro: parêntese sobrando', erro('P1 + P2)'), 'Tem um parêntese fechando sem ter aberto.');
eq('erro: termina no operador', erro('P1 +'), 'A fórmula terminou no meio. Falta um número ou uma variável no fim.');
eq('erro: função que não existe', erro('raiz(4)'), 'Não existe a função raiz().');
eq('erro: dois valores sem operador', erro('P1 P2'), 'Falta um operador (+ - * /) entre dois valores.');
eq('erro: número grudado', erro('2P1'), 'Número grudado em letra perto de "2P". Use * para multiplicar.');
eq('erro: caractere estranho', erro('P1 & P2'), 'Caractere que a fórmula não entende: "&"');
eq('erro: vazia', erro('   '), 'A fórmula está vazia.');
eq('erro: se() com 2 valores', erro('se(1; 2)'), 'se() recebe 3 valores separados por ponto e vírgula.');
eq('erro: não executa código', erro('constructor.constructor("alert(1)")()'), 'Caractere que a fórmula não entende: "."');
eq('compile guarda erro', compile('(').ok, false);
eq('erro: comparação dupla', erro('1 < 2 < 3'), 'Use se() para juntar duas comparações.');

eq('sigla Prova 1', suggestSigla('Prova 1'), 'P1');
eq('sigla Prova numerada', suggestSigla('Prova', ['P1']), 'P2');
eq('sigla Trabalho', suggestSigla('Trabalho'), 'TRAB');
eq('sigla Recuperação', suggestSigla('Recuperação'), 'REC');
eq('sigla Prova bimestral 2', suggestSigla('Prova bimestral 2'), 'PB2');
eq('sigla vazia', suggestSigla(''), 'N1');
eq('sigla repetida', suggestSigla('Trabalho', ['TRAB']), 'TRAB1');
eq('sigla Trabalho em grupo', suggestSigla('Trabalho em grupo'), 'TG');

eq('parse 7,5', parseNum('7,5'), 7.5);
eq('parse vazio', parseNum('  '), null);
eq('parse inválido', Number.isNaN(parseNum('7,5,1')), true);
eq('formata nota', fmtNota(7.25, 1), '7,3');
eq('formata nada', fmtNota(null), '—');

// medias
const periodo = makePeriodo({ nome: '2026', tipo: 'trimestre' });
eq('3 trimestres', periodo.etapas.map((e) => e.codigo), ['T1', 'T2', 'T3']);
eq('nomes das etapas', periodo.etapas.map((e) => e.nome), ['1º trimestre', '2º trimestre', '3º trimestre']);
eq('24 etapas no máximo', makePeriodo({ tipo: 'semestre', quantidade: 40 }).etapas.length, 24);
eq('pelo menos 1 etapa', makePeriodo({ tipo: 'bimestre', quantidade: 0 }).etapas.length, 1);
const reetapas = makeEtapas('bimestre', 4, periodo.etapas);
eq('trocar tipo mantém id e renomeia', [reetapas[0].id === periodo.etapas[0].id, reetapas[0].nome, reetapas[3].codigo], [true, '1º bimestre', 'B4']);

const mat = makeMateria(periodo.id, 'Matemática');
const [t1, t2, t3] = periodo.etapas;
const nota = (etapa, sigla, valor, extra = {}) => ({ id: uid(), materiaId: mat.id, etapaId: etapa.id || etapa, nome: sigla, sigla, valor, vale: null, peso: 1, data: '', ...extra });
const data = { ...emptyData('Ana'), periodos: [periodo], materias: [mat], notas: [] };

data.notas = [nota(t1, 'P1', 8), nota(t1, 'P2', 6)];
let r = etapaResult(data, periodo, mat, t1);
near('média simples da etapa', r.valor, 7);
eq('etapa completa não é parcial', r.parcial, false);

data.notas = [nota(t1, 'P1', 8), nota(t1, 'P2', 6, { peso: 3 })];
near('média com peso', etapaResult(data, periodo, mat, t1).valor, 6.5);

data.notas = [nota(t1, 'P1', 5), nota(t1, 'TRAB', 1.5, { vale: 2 })];
near('MEDIA converte o "vale"', etapaResult(data, periodo, mat, t1).valor, 6.25);

periodo.etapas[0].formula = 'SOMA';
data.notas = [nota(t1, 'P1', 5), nota(t1, 'TRAB', 1.5, { vale: 2 })];
near('SOMA dos pontos', etapaResult(data, periodo, mat, t1).valor, 6.5);
periodo.etapas[0].formula = 'MEDIA';

data.notas = [nota(t1, 'P1', 4), nota(t1, 'P2', null)];
r = etapaResult(data, periodo, mat, t1);
eq('pendente deixa parcial', [r.valor, r.parcial, r.faltam], [4, true, ['P2']]);
eq('quanto preciso na P2', [r.precisa.status, r.precisa.value], ['possivel', 8]);

periodo.etapas[0].formula = '(P1*2 + P2*3)/5';
data.notas = [nota(t1, 'P1', 3)];
r = etapaResult(data, periodo, mat, t1);
eq('fórmula com sigla não cadastrada', [r.valor, r.faltam], [null, ['P2']]);
eq('quanto preciso (ponderada)', r.precisa, { status: 'possivel', value: 8 });

data.notas = [nota(t1, 'P1', 0)];
eq('com P1 = 0 ainda dá (P2 tem peso 3)', etapaResult(data, periodo, mat, t1).precisa, { status: 'possivel', value: 10 });
periodo.etapas[0].formula = 'MEDIA';
data.notas = [nota(t1, 'P1', 0), nota(t1, 'P2', 0), nota(t1, 'P3', null)];
eq('impossível alcançar', etapaResult(data, periodo, mat, t1).precisa.status, 'impossivel');
data.notas = [nota(t1, 'P1', 10, { peso: 4 }), nota(t1, 'P2', null)];
eq('já garantido', etapaResult(data, periodo, mat, t1).precisa.status, 'garantido');

periodo.etapas[0].formula = '(P1 + ';
data.notas = [nota(t1, 'P1', 7)];
eq('fórmula com erro', etapaResult(data, periodo, mat, t1).erro, 'A fórmula terminou no meio. Falta um número ou uma variável no fim.');
periodo.etapas[0].formula = 'MEDIA';

mat.formulaEtapa = 'max(P1; P2)';
data.notas = [nota(t1, 'P1', 3), nota(t1, 'P2', 9)];
near('fórmula própria da matéria', etapaResult(data, periodo, mat, t1).valor, 9);
mat.formulaEtapa = '';

data.notas = [nota(t1, 'P1', 6), nota(t2, 'P1', 7), nota(t3, 'P1', 8)];
r = finalResult(data, periodo, mat);
eq('final simples', [r.valor, r.parcial, situacao(periodo, r)], [7, false, 'aprovado']);

periodo.formulaFinal = '(T1 + T2*2 + T3*3)/6';
near('final com pesos crescentes', finalResult(data, periodo, mat).valor, 7.333);

data.notas = [nota(t1, 'P1', 4), nota(t2, 'P1', 5)];
r = finalResult(data, periodo, mat);
eq('final falta T3', [r.valor, r.faltam], [null, ['T3']]);
eq('quanto preciso no T3 (pesos 1, 2, 3)', r.precisa, { status: 'possivel', value: 7.4 });

periodo.formulaFinal = 'MEDIA';
r = finalResult(data, periodo, mat);
eq('final MEDIA parcial', [r.valor, r.parcial, situacao(periodo, r)], [4.5, true, 'risco']);
eq('quanto preciso no T3 (MEDIA)', r.precisa, { status: 'possivel', value: 9 });

periodo.formulaFinal = 'se(MEDIA >= 6; MEDIA; (MEDIA + REC)/2)';
data.notas = [nota(t1, 'P1', 7), nota(t2, 'P1', 7), nota(t3, 'P1', 7)];
r = finalResult(data, periodo, mat);
eq('aprovado sem precisar de REC', [r.valor, r.parcial, situacao(periodo, r)], [7, false, 'aprovado']);

data.notas = [nota(t1, 'P1', 4), nota(t2, 'P1', 5), nota(t3, 'P1', 6)];
r = finalResult(data, periodo, mat);
eq('precisa de REC', [r.valor, r.faltam], [null, ['REC']]);
eq('quanto preciso na REC', r.precisa, { status: 'possivel', value: 7 });
eq('sem REC e abaixo: situação de risco', situacao(periodo, r), 'risco');

data.notas.push(nota(FINAL, 'REC', 8));
r = finalResult(data, periodo, mat);
eq('com REC lançada', [r.valor, situacao(periodo, r)], [6.5, 'aprovado']);
data.notas.pop();
data.notas.push(nota(FINAL, 'REC', 6));
eq('REC insuficiente', situacao(periodo, finalResult(data, periodo, mat)), 'abaixo');
periodo.formulaFinal = 'MEDIA';

data.notas = [];
eq('sem notas', situacao(periodo, finalResult(data, periodo, mat)), 'vazio');

data.notas = [nota(t1, 'P1', 8, { data: '2026-03-10' }), nota(t1, 'TRAB', 1, { vale: 2, data: '2026-03-01' }), nota(t2, 'P1', 6)];
eq('série por avaliação (ordem e escala)', serieDesempenho(data, periodo, mat, 'avaliacoes').map((p) => [p.rotulo, p.valor]), [['TRAB', 5], ['P1', 8], ['P1', 6]]);
eq('série por etapa', serieDesempenho(data, periodo, mat, 'etapas').map((p) => [p.rotulo, p.valor]), [['T1', 6.5], ['T2', 6]]);
eq('etapa atual = última com nota', etapaAtual(data, periodo, '2026-05-01').codigo, 'T2');

periodo.etapas[0].formula = 'MEDIA';
periodo.formulaFinal = 'MEDIA';
data.notas = [nota(t1, 'P1', 7), nota(t1, 'P2', 6), nota(t1, 'PART', 0.5, { tipo: 'bonus' })];
r = etapaResult(data, periodo, mat, t1);
eq('bônus soma na média', [Math.round(r.valor * 100) / 100, r.bonus, r.comBonus], [7, 0.5, true]);
data.notas = [nota(t1, 'P1', 9.8), nota(t1, 'PART', 1, { tipo: 'bonus' })];
eq('bônus não passa da nota máxima', etapaResult(data, periodo, mat, t1).valor, 10);
data.notas = [nota(t1, 'P1', 7), nota(t1, 'ATR', -1, { tipo: 'bonus' })];
eq('bônus negativo desconta', etapaResult(data, periodo, mat, t1).valor, 6);
data.notas = [nota(t1, 'P1', 7), nota(t1, 'P2', 6), nota(t1, 'PART', 1, { tipo: 'bonus' })];
periodo.etapas[0].formula = 'MEDIA + BONUS/2';
near('fórmula com BONUS decide sozinha', etapaResult(data, periodo, mat, t1).valor, 7);
periodo.etapas[0].formula = 'MEDIA';
data.notas = [nota(t1, 'P1', 4), nota(t1, 'P2', null), nota(t1, 'PART', 1, { tipo: 'bonus' })];
r = etapaResult(data, periodo, mat, t1);
eq('quanto preciso conta o bônus', [r.precisa.status, r.precisa.value], ['possivel', 6]);
data.notas = [nota(t1, 'PART', 1, { tipo: 'bonus' })];
eq('só bônus: ainda sem média', [etapaResult(data, periodo, mat, t1).vazio, etapaResult(data, periodo, mat, t1).valor], [true, null]);
data.notas = [nota(t1, 'P1', 4), nota(t1, 'P2', 5), nota(t1, 'OFICIAL', 6.5, { tipo: 'oficial' })];
r = etapaResult(data, periodo, mat, t1);
eq('média da escola substitui a conta', [r.valor, r.calculado, r.parcial, Boolean(r.oficial)], [6.5, 4.5, false, true]);
data.notas = [nota(t1, 'OFICIAL', 8, { tipo: 'oficial' }), nota(t2, 'OFICIAL', 6, { tipo: 'oficial' }), nota(t3, 'OFICIAL', 7, { tipo: 'oficial' })];
r = finalResult(data, periodo, mat);
eq('médias da escola fecham o ano', [r.valor, r.parcial, situacao(periodo, r)], [7, false, 'aprovado']);
data.notas.push(nota(FINAL, 'OFICIAL', 6.8, { tipo: 'oficial' }));
eq('média final da escola substitui a do app', finalResult(data, periodo, mat).valor, 6.8);
data.notas = [nota(t1, 'P1', 6), nota(t2, 'P1', 6), nota(t3, 'P1', 5), nota(FINAL, 'EXTRA', 0.5, { tipo: 'bonus' })];
near('bônus na média final', finalResult(data, periodo, mat).valor, 6.167);
eq('bônus e média da escola fora do gráfico de avaliações', serieDesempenho({ ...data, notas: [...data.notas, nota(t1, 'OFICIAL', 6, { tipo: 'oficial' })] }, periodo, mat, 'avaliacoes').length, 3);

const fis = { ...makeMateria(periodo.id, 'Física'), formulasEtapa: { [t3.id]: 'P1*0,4 + TRAB*0,6' } };
data.materias = [mat, fis];
const nf = (etapa, sigla, valor) => ({ ...nota(etapa, sigla, valor), materiaId: fis.id });
data.notas = [nf(t1, 'P1', 5), nf(t1, 'TRAB', 9), nf(t3, 'P1', 5), nf(t3, 'TRAB', 10)];
eq('fórmula própria só no T3', [etapaResult(data, periodo, fis, t1).valor, etapaResult(data, periodo, fis, t3).valor], [7, 8]);
fis.formulaEtapa = 'max(P1; TRAB)';
eq('própria da parte vence a própria de todas', [etapaResult(data, periodo, fis, t1).valor, etapaResult(data, periodo, fis, t3).valor], [9, 8]);
data.notas = [nota(t1, 'P1', 10), nf(t1, 'P1', 2)];
fis.foraDaMedia = true;
eq('matéria fora da média geral', mediaGeral(data, periodo, [mat, fis]), 10);
data.materias = [mat];
eq('normalize: tipo da nota', normalize({ notas: [{ id: 'a', materiaId: 'm', etapaId: 'e', tipo: 'bonus' }, { id: 'b', materiaId: 'm', etapaId: 'e', tipo: 'xyz' }] }).notas.map((n) => n.tipo), ['bonus', 'avaliacao']);

// importar
{
  const per = makePeriodo({ nome: '2026', tipo: 'trimestre' });
  const [i1, i2] = per.etapas;
  const mMat = makeMateria(per.id, 'Matemática');
  const mPor = makeMateria(per.id, 'Português');
  const mArt = makeMateria(per.id, 'Artes');
  const base = { ...emptyData('Ana'), periodos: [per], materias: [mMat, mPor, mArt], notas: [{ id: 'x1', tipo: 'avaliacao', materiaId: mMat.id, etapaId: i1.id, nome: 'Prova 1', sigla: 'P1', valor: 7, vale: null, peso: 1, data: '' }] };

  eq('prompt cita as matérias e as partes', ['Matemática, Português, Artes', 'T1 para o 1º trimestre', '"FINAL"'].every((t) => promptNotas(base, per).includes(t)), true);
  eq('prompt do horário pede HH:MM', promptHorario(base, per).includes('HH:MM'), true);

  const resposta = 'Claro! Aqui está:\n```json\n{ "caderneta": "notas", "notas": [\n' +
    '{ "materia": "MATEMÁTICA", "parte": "1º Trimestre", "avaliacao": "Prova 1", "nota": 8.5 },\n' +
    '{ "materia": "Matemática", "parte": "T1", "avaliacao": "Trabalho", "nota": "1,5", "vale": 2 },\n' +
    '{ "materia": "Língua Portuguesa", "parte": "Trimestre II", "avaliacao": "Prova", "nota": 6 },\n' +
    '{ "materia": "Química", "parte": "T1", "avaliacao": "Prova 1", "nota": 12 },\n' +
    '{ "materia": "Matemática", "parte": "T1", "avaliacao": "Trabalho", "nota": "1,5", "vale": 2 },\n' +
    '{ "materia": "Arte", "parte": "quarto bimestre", "avaliacao": "Desenho", "nota": 9 },\n' +
    '{ "materia": "Matemática", "parte": "T2", "nota": 7 }\n' +
    '], "medias": [{ "materia": "Matemática", "parte": "T1", "media": 8.1 }],\n' +
    '"bonus": [{ "materia": "Matemática", "parte": "T1", "motivo": "Participação", "pontos": 0.5 }] }\n```\nEspero ter ajudado!';
  const obj = extrairJSON(resposta);
  const a = analisarNotas(obj, base, per);
  const st = a.linhas.map((l) => l.status);
  eq('importar: estados das linhas', st, ['atualiza', 'nova', 'nova', 'erro', 'repetida', 'erro', 'nova', 'nova', 'nova']);
  eq('importar: acha a matéria sem acento e por apelido', [a.linhas[0].materiaId, a.linhas[2].materiaId, a.linhas[5].materiaId], [mMat.id, mPor.id, mArt.id]);
  eq('importar: vírgula decimal e vale', [a.linhas[1].valor, a.linhas[1].vale, a.linhas[1].sigla], [1.5, 2, 'TRAB']);
  eq('importar: matéria nova e nota acima do máximo', [a.linhas[3].materiaId, a.linhas[3].erro.includes('passa de 10')], ['nova', true]);
  eq('importar: parte que não existe', a.partesDesconhecidas.map((p) => p.texto), ['quarto bimestre']);
  eq('importar: nome automático', a.linhas[6].nome, 'Nota 1');
  eq('importar: média da escola e bônus', [a.linhas[7].tipo, a.linhas[7].sigla, a.linhas[8].tipo, a.linhas[8].sigla], ['oficial', 'ESCOLA', 'bonus', 'PART']);

  const mapeada = analisarNotas(obj, base, per, { partes: { 'QUARTO BIMESTRE': i2.id }, materias: { QUIMICA: 'ignorar' } });
  eq('importar: escolha da pessoa vale', [mapeada.linhas[5].status, mapeada.linhas[5].etapaId === i2.id, mapeada.linhas[3].status], ['nova', true, 'erro']);

  const d2 = structuredClone(base);
  const marcadas = new Set(a.linhas.filter((l) => l.sel).map((l) => l.i));
  const res = aplicarNotas(d2, a, per.id, marcadas);
  eq('importar: grava', [res.novas, res.atualizadas, res.materiasNovas, d2.notas.length], [5, 1, 0, 6]);
  eq('importar: atualiza a P1', d2.notas.find((n) => n.id === 'x1').valor, 8.5);
  r = etapaResult(d2, per, mMat, i1);
  eq('importar: média da escola manda no T1', r.valor, 8.1);

  let msg = null;
  try { extrairJSON('não consegui ler a imagem, desculpe'); } catch (e) { msg = e instanceof ImportError; }
  eq('importar: texto sem dados avisa', msg, true);
  eq('importar: conserta aspas curvas e vírgula sobrando', extrairJSON('{“notas”: [{“materia”: “Física”, “nota”: 7,5},]}').notas[0].nota, 7.5);
  eq('importar: lista solta', analisarNotas(extrairJSON('[{"materia":"Matemática","parte":"T3","nota":10}]'), base, per).resumo.novas, 1);
  eq('importar: formato por matéria', analisarNotas({ materias: [{ nome: 'Português', notas: [{ parte: 'T1', avaliacao: 'P1', nota: 5 }] }] }, base, per).linhas[0].materiaId, mPor.id);

  eq('dias da semana', ['segunda', 'Terça-feira', 'QUA', '5ª feira', 'Friday', 'sábado', 'domingo', 1, 'xyz'].map(lerDia), [1, 2, 3, 4, 5, 6, 0, 1, null]);
  eq('horas', ['7:00', '07h30', '7h', '13.45', 8, '25:00', 'manhã'].map(lerHora), ['07:00', '07:30', '07:00', '13:45', '08:00', null, null]);
  eq('partes', ['T2', '2º trimestre', 'Trimestre III', 'segundo', 'Recuperação final', 'Exame', '9º', ''].map((t) => { const x = casarParte(t, per); return x === FINAL ? 'F' : x ? per.etapas.findIndex((e) => e.id === x) + 1 : null; }), [2, 2, 3, 2, 'F', 'F', null, null]);

  const h = analisarHorario(extrairJSON(JSON.stringify({ aulas: [
    { dia: 'segunda', inicio: '07:00', fim: '07:50', materia: 'Matemática', sala: '12', professor: 'Carla' },
    { dia: 'segunda', inicio: '07:50', materia: 'Física' },
    { dia: 'terça', horario: '08:00 - 08:50', materia: 'Português' },
    { dia: 'segunda', inicio: '07:00', fim: '07:50', materia: 'Matemática' },
    { dia: 'feriado', inicio: '07:00', materia: 'Artes' },
  ] })), base, per);
  eq('horário: estados', h.linhas.map((l) => l.status), ['nova', 'nova', 'nova', 'repetida', 'erro']);
  eq('horário: fim estimado e faixa', [h.linhas[1].fim, h.linhas[1].fimEstimado, h.linhas[2].inicio, h.linhas[2].fim], ['08:40', true, '08:00', '08:50']);
  const d3 = { ...structuredClone(base), aulas: [{ id: 'old', periodoId: per.id, materiaId: mMat.id, dia: 5, inicio: '10:00', fim: '10:50', sala: '' }] };
  const rh = aplicarHorario(d3, h, per.id, new Set(h.linhas.filter((l) => l.sel).map((l) => l.i)), { substituir: true });
  eq('horário: substitui e cria matéria', [rh.aulas, rh.removidas, rh.materiasNovas, d3.aulas.length, d3.materias.find((m) => m.id === mMat.id).professor], [3, 1, 1, 3, 'Carla']);
}

const consertado = normalize({ periodos: [{ id: 'p', tipo: 'xyz', etapas: [], notaMaxima: -1 }], materias: [{ id: 'm', periodoId: 'p', cor: 'roxo-neon' }], notas: [{ id: 'n' }] });
eq('normalize conserta', [consertado.periodos[0].tipo, consertado.periodos[0].etapas.length, consertado.periodos[0].notaMaxima, consertado.materias[0].cor, consertado.notas.length, consertado.settings.periodoAtualId], ['etapa', 1, 10, 'azul', 0, 'p']);
eq('normalize de lixo', normalize(null).periodos, []);

const dRel = { ...emptyData('Ana <b>'), periodos: [periodo], materias: [{ ...mat, nome: '<script>alert(1)</script>' }], notas: [nota(t1, 'P1', 7)] };
const html = relatorioHTML(dRel, [periodo], 'Boletim');
eq('boletim escapa o texto', html.includes('<script>alert') || html.includes('Ana <b>'), false);
eq('boletim traz a nota', html.includes('&lt;script&gt;') && html.includes('7,0'), true);

const aula = (dia, inicio, fim, materiaId = mat.id) => ({ id: uid(), periodoId: periodo.id, materiaId, dia, inicio, fim, sala: '' });
const aulas = [aula(1, '07:00', '07:50'), aula(1, '07:50', '08:40'), aula(2, '07:00', '07:50'), aula(5, '10:00', '10:50'), aula(6, '08:00', '09:00')];
eq('aulas por dia', contagemPorDia(aulas), [0, 2, 1, 0, 0, 1, 1]);
eq('de segunda a sexta', contagemIntervalo(aulas, 1, 5), 4);
eq('de sexta a segunda (volta)', contagemIntervalo(aulas, 5, 1), 4);
eq('conflito de horário', conflitos(aulas, { id: 'x', dia: 1, inicio: '07:30', fim: '08:00' }).length, 2);
eq('encostado não conflita', conflitos(aulas, { id: 'x', dia: 1, inicio: '08:40', fim: '09:30' }).length, 0);

const pf = { ...periodo, inicio: '2026-03-02', fim: '2026-03-29', frequenciaMinima: 75 };
const dataF = { ...data, aulas: [aula(1, '07:00', '07:50'), aula(3, '07:00', '07:50')], faltas: [{ id: 'f', materiaId: mat.id, data: '2026-03-02', quantidade: 2 }], eventos: [] };
eq('total de aulas pela grade', totalAulas(dataF, pf, mat), { total: 8, estimado: true });
dataF.eventos = [{ id: 'fer', titulo: 'Feriado', tipo: 'feriado', data: '2026-03-04' }];
eq('feriado tira aula', totalAulas(dataF, pf, mat).total, 7);
const fr = frequencia(dataF, pf, mat);
eq('frequência', [fr.faltas, fr.limite, fr.podeFaltar, Math.round(fr.percentual)], [2, 1, -1, 71]);
eq('total digitado vence', totalAulas(dataF, pf, { ...mat, totalAulas: 80 }), { total: 80, estimado: false });

const ev = { id: 'e1', titulo: 'Lista', tipo: 'tarefa', data: '2026-11-02', repetir: 'semanal', ate: '2026-11-23' };
eq('repete toda semana até a data', ocorrencias(ev, '2026-11-01', '2026-12-31'), ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
eq('mensal no dia 31', ocorrencias({ id: 'e2', data: '2026-01-31', repetir: 'mensal' }, '2026-01-01', '2026-04-30'), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
const varios = eventosNoIntervalo([{ id: 'e3', titulo: 'Semana de provas', tipo: 'prova', data: '2026-11-30', fim: '2026-12-02' }], '2026-12-01', '2026-12-31');
eq('evento de vários dias', [...varios.keys()], ['2026-12-01', '2026-12-02']);
eq('próximos ignora passado', proximos([{ id: 'a', titulo: 'A', data: '2026-11-01' }, { id: 'b', titulo: 'B', data: '2026-11-10' }], '2026-11-09').map((e) => e.id), ['b']);

const now = new Date(2026, 10, 9, 7, 0);
const dAv = { ...emptyData('Ana'), materias: [mat], eventos: [
  { id: 'p1', titulo: 'Prova de funções', tipo: 'prova', materiaId: mat.id, data: '2026-11-10', hora: '08:00', aviso: 1440 },
  { id: 'p2', titulo: 'Passou', tipo: 'prova', data: '2026-11-09', hora: '06:00', aviso: 0 },
  { id: 'p3', titulo: 'Feita', tipo: 'tarefa', data: '2026-11-11', aviso: 60, feito: true },
] };
let ag = agendaDeAvisos(dAv, now);
eq('aviso 1 dia antes', ag.map((a) => [a.title, a.body, new Date(a.at).getDate(), new Date(a.at).getHours()]), [['Prova: Prova de funções', 'Matemática. Começa amanhã, às 08:00', 9, 8]]);
eq('aviso que já passou não entra', ag.some((a) => a.id.includes('p2')), false);
dAv.settings = { ...dAv.settings, avisoDetalhes: false };
ag = agendaDeAvisos(dAv, now);
eq('aviso sem detalhes', [ag[0].title, ag[0].body], ['Caderneta', 'Você tem um lembrete. Abra a Caderneta para ver.']);
dAv.settings = { ...dAv.settings, avisos: false };
eq('avisos desligados', agendaDeAvisos(dAv, now).length, 0);

eq('senha curta', forcaSenha('abc').nivel, 0);
eq('senha comum', forcaSenha('12345678').nivel, 0);
eq('senha com o nome', forcaSenha('renzo2026', 'Renzo').texto, 'Fraca');
eq('frase forte', forcaSenha('minha prova de quimica').nivel >= 3, true);
eq('confirmação diferente', erroSenha('cavalo azul voa', 'cavalo azul vo'), 'As duas senhas estão diferentes.');
eq('senha ok', erroSenha('cavalo azul voa', 'cavalo azul voa'), null);
eq('PINs fáceis são recusados', ['123456', '111111', '121212', '987654', '12345', '25122008', '123123'].map((p) => erroPin(p) !== null), [true, true, true, true, true, true, true]);
eq('PIN bom', [erroPin('482913'), erroPin('482913', '482914') !== null], [null, true]);

// cofre
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'caderneta-teste-'));
const KDF_TESTE = { alg: 'scrypt', N: 2 ** 14, r: 8, p: 1 }; // mais leve p/ o teste
try {
  const c = await vault.criar(tmp, { nome: 'Ana', senha: 'senha forte 123' }, KDF_TESTE);
  eq('código de recuperação', /^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/.test(c.codigo), true);
  eq('conta listada', vault.listar(tmp).map((x) => x.nome), ['Ana']);

  const segredo = JSON.stringify({ notas: [{ sigla: 'P1', valor: 9.5, nome: 'Prova secreta de química' }] });
  vault.salvar(tmp, c.id, c.chave, segredo);
  const arquivo = fs.readFileSync(vault._interno.cofreFile(tmp, c.id), 'utf8');
  eq('arquivo não mostra os dados', arquivo.includes('química') || arquivo.includes('secreta') || arquivo.includes('9.5'), false);
  eq('arquivo não guarda a senha', arquivo.includes('senha forte'), false);

  eq('senha errada', (await vault.desbloquear(tmp, c.id, 'senha errada 123')).ok, false);
  const ok = await vault.desbloquear(tmp, c.id, 'senha forte 123');
  eq('senha certa abre', [ok.ok, ok.json], [true, segredo]);

  // arquivo mexido
  const h = JSON.parse(arquivo);
  const ct = Buffer.from(h.dados.ct, 'base64');
  ct[3] ^= 1;
  h.dados.ct = ct.toString('base64');
  fs.writeFileSync(vault._interno.cofreFile(tmp, c.id), JSON.stringify(h));
  let detectou = false;
  try {
    await vault.desbloquear(tmp, c.id, 'senha forte 123');
  } catch (e) {
    detectou = e.codigo === 'corrompido';
  }
  eq('alteração no arquivo é detectada', detectou, true);
  vault.salvar(tmp, c.id, c.chave, segredo);

  eq('trocar senha: atual errada', (await vault.trocarSenha(tmp, c.id, c.chave, 'nao e essa', 'senha nova 456')).ok, false);
  eq('trocar senha', (await vault.trocarSenha(tmp, c.id, c.chave, 'senha forte 123', 'senha nova 456')).ok, true);
  eq('senha antiga não abre mais', (await vault.desbloquear(tmp, c.id, 'senha forte 123')).ok, false);
  eq('senha nova abre', (await vault.desbloquear(tmp, c.id, 'senha nova 456')).json, segredo);

  eq('código errado', (await vault.recuperar(tmp, c.id, 'AAAAA-BBBBB-CCCCC-DDDDD', 'outra senha 789')).ok, false);
  const rec = await vault.recuperar(tmp, c.id, c.codigo.toLowerCase().replace(/-/g, ' '), 'outra senha 789');
  eq('recuperar com o código (minúsculo, com espaços)', [rec.ok, rec.json], [true, segredo]);
  eq('recuperação troca o código', rec.codigo !== c.codigo, true);
  eq('código antigo não serve mais', (await vault.recuperar(tmp, c.id, c.codigo, 'mais uma senha 1')).ok, false);
  eq('senha definida na recuperação abre', (await vault.desbloquear(tmp, c.id, 'outra senha 789')).ok, true);

  const t0 = 1_000_000;
  for (let i = 0; i < 4; i++) vault.registrarFalha(tmp, c.id, 'senha', t0);
  eq('4 erros ainda sem espera', vault.bloqueio(tmp, c.id, t0).bloqueado, false);
  const b5 = vault.registrarFalha(tmp, c.id, 'senha', t0);
  eq('5º erro: espera de 30 s', [b5.bloqueado, b5.restanteMs], [true, 30000]);
  eq('espera dobra', vault.registrarFalha(tmp, c.id, 'senha', t0).restanteMs, 60000);
  eq('depois da espera, libera', vault.bloqueio(tmp, c.id, t0 + 60001).bloqueado, false);
  const resumo = vault.registrarSucesso(tmp, c.id, 'senha', t0 + 70000);
  eq('avisa os erros desde o último acesso', resumo.falhasDesde, 6);
  eq('acertar zera', vault.bloqueio(tmp, c.id, t0 + 70000).falhas, 0);

  // pin (protetor fake no lugar do dpapi)
  const protetor = { disponivel: async () => true, fechar: async (t) => Buffer.from(Buffer.from(t, 'utf8').map((b) => b ^ 0x5a)), abrir: async (b) => ({ texto: Buffer.from(b.map((x) => x ^ 0x5a)).toString('utf8'), renovar: false }) };
  const outroPC = { disponivel: async () => true, fechar: protetor.fechar, abrir: async () => { throw new Error('DPAPI de outra conta'); } };
  eq('sem PIN no começo', (await vault.statusPin(tmp, c.id, protetor)).ativo, false);
  let pinRecusado = null;
  try { await vault.definirPin(tmp, c.id, rec.chave, 'outra senha 789', '1234', protetor, KDF_TESTE); } catch (e) { pinRecusado = e.codigo; }
  eq('PIN curto é recusado', pinRecusado, 'pin');
  eq('PIN pede a senha certa', (await vault.definirPin(tmp, c.id, rec.chave, 'senha errada', '482913', protetor, KDF_TESTE)).ok, false);
  eq('criar PIN', await vault.definirPin(tmp, c.id, rec.chave, 'outra senha 789', '482913', protetor, KDF_TESTE), { ok: true, digitos: 6 });
  const pinBruto = fs.readFileSync(vault._interno.pinFile(tmp, c.id));
  eq('pin.dat não mostra nada', pinBruto.includes('482913') || pinBruto.includes('caderneta-pin'), false);
  const comPin = await vault.entrarComPin(tmp, c.id, '482913', protetor);
  eq('entra com o PIN', [comPin.ok, comPin.json], [true, segredo]);
  eq('PIN de outro computador não vale', (await vault.statusPin(tmp, c.id, outroPC)).ativo, false);
  eq('PIN errado', await vault.entrarComPin(tmp, c.id, '000000', protetor), { ok: false, codigo: 'pin-errado', restantes: 4 });
  eq('PIN errado conta como tentativa', vault.historico(tmp, c.id)[0].via, 'pin');
  for (let i = 0; i < 3; i++) await vault.entrarComPin(tmp, c.id, '111111', protetor);
  eq('5º PIN errado desliga o PIN', (await vault.entrarComPin(tmp, c.id, '222222', protetor)).codigo, 'pin-desligado');
  eq('PIN desligado sumiu', [(await vault.statusPin(tmp, c.id, protetor)).ativo, fs.existsSync(vault._interno.pinFile(tmp, c.id))], [false, false]);
  eq('senha ainda entra', (await vault.desbloquear(tmp, c.id, 'outra senha 789')).ok, true);
  await vault.definirPin(tmp, c.id, rec.chave, 'outra senha 789', '482913', protetor, KDF_TESTE);
  const depois31 = Date.now() + 31 * 24 * 3600 * 1000;
  eq('depois de 30 dias pede a senha', (await vault.entrarComPin(tmp, c.id, '482913', protetor, depois31)).codigo, 'pin-expirado');
  vault.registrarSucesso(tmp, c.id, 'senha');
  eq('usou a senha: PIN volta', (await vault.entrarComPin(tmp, c.id, '482913', protetor)).ok, true);
  vault.registrarSucesso(tmp, c.id, 'pin', depois31 - 1000);
  eq('entrar com PIN não renova os 30 dias', (await vault.statusPin(tmp, c.id, protetor, depois31 + 2 * 24 * 3600 * 1000)).expirado, true);
  const copiaPin = path.join(tmp, 'copia-pin.cad');
  vault.exportar(tmp, c.id, copiaPin);
  eq('cópia de segurança não leva o PIN', Object.keys(JSON.parse(fs.readFileSync(copiaPin, 'utf8')).chaves), ['senha', 'recuperacao']);
  vault.removerPin(tmp, c.id);
  eq('desligar o PIN', (await vault.statusPin(tmp, c.id, protetor)).ativo, false);

  const copia = path.join(tmp, 'copia.cad');
  vault.exportar(tmp, c.id, copia);
  const outra = fs.mkdtempSync(path.join(os.tmpdir(), 'caderneta-teste-b-'));
  const cab = vault.lerCopia(copia);
  eq('importar com senha errada', (await vault.importar(outra, cab, 'errada errada')).ok, false);
  eq('importar', (await vault.importar(outra, cab, 'outra senha 789')).ok, true);
  eq('importar de novo pede pra substituir', (await vault.importar(outra, cab, 'outra senha 789')).existe, true);
  eq('importada abre', (await vault.desbloquear(outra, c.id, 'outra senha 789')).json, segredo);
  fs.rmSync(outra, { recursive: true, force: true });

  const lixo = path.join(tmp, 'lixo.cad');
  fs.writeFileSync(lixo, JSON.stringify({ formato: 'caderneta-cofre', versao: 1, id: c.id, kdf: { alg: 'scrypt', N: 2 ** 30, r: 8, p: 1 }, chaves: { senha: {}, recuperacao: {} } }));
  let recusou = false;
  try { vault.lerCopia(lixo); } catch (e) { recusou = e.codigo === 'formato'; }
  eq('recusa parâmetros que travariam o PC', recusou, true);
  let idRuim = false;
  try { vault.bloqueio(tmp, '../../Windows'); } catch (e) { idRuim = e.codigo === 'id'; }
  eq('id com caminho é recusado', idRuim, true);

  eq('apagar com senha errada', (await vault.apagar(tmp, c.id, rec.chave, 'errada errada')).ok, false);
  eq('apagar conta', (await vault.apagar(tmp, c.id, rec.chave, 'outra senha 789')).ok, true);
  eq('conta sumiu', vault.listar(tmp).length, 0);

  // scrypt de vdd
  const t = Date.now();
  await vault.criar(tmp, { nome: 'Bia', senha: 'senha real 12345' });
  const ms = Date.now() - t;
  console.log(`       (criar conta com o custo real levou ${ms} ms)`);
  eq('custo real abaixo de 5 s', ms < 5000, true);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${total - fails} de ${total} ok`);
if (fails) {
  console.log(`${fails} FALHARAM`);
  process.exit(1);
}
