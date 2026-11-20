// smoke test
// npm run build && npx electron scripts/smoke.cjs <saida>
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app } = require('electron');

const outDir = path.resolve(process.argv[2] || path.join(os.tmpdir(), 'caderneta-smoke'));
const userData = path.join(outDir, 'userData');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(userData, { recursive: true });
process.env.CADERNETA_USER_DATA = userData;
app.setPath('userData', userData);
fs.writeFileSync(path.join(userData, 'janela.json'), JSON.stringify({ tema: 'caderno' }), 'utf8');

const vault = require('../vault.js');
const SENHA = 'minha prova de quimica';

// dados de teste
const p2 = (n) => String(n).padStart(2, '0');
const now = new Date();
const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const dia = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return iso(d); };
const ano = now.getFullYear();
let k = 0;
const id = () => `id${++k}x${Math.random().toString(36).slice(2, 8)}`;

function exemplo() {
  const etapas = [
    { id: 'e1', nome: '1º trimestre', codigo: 'T1', formula: 'MEDIA', inicio: dia(-260), fim: dia(-170) },
    { id: 'e2', nome: '2º trimestre', codigo: 'T2', formula: 'MEDIA', inicio: dia(-169), fim: dia(-60) },
    { id: 'e3', nome: '3º trimestre', codigo: 'T3', formula: 'MEDIA', inicio: dia(-59), fim: dia(30) },
  ];
  const periodo = { id: 'p1', nome: String(ano), tipo: 'trimestre', etapas, formulaFinal: 'se(MEDIA >= 6; MEDIA; (MEDIA + REC) / 2)', notaMaxima: 10, mediaMinima: 6, frequenciaMinima: 75, inicio: dia(-260), fim: dia(30), concluido: false };
  const anterior = {
    id: 'p0', nome: String(ano - 1), tipo: 'trimestre', concluido: true, formulaFinal: 'MEDIA', notaMaxima: 10, mediaMinima: 6, frequenciaMinima: 75, inicio: '', fim: '',
    etapas: [{ id: 'a1', nome: '1º trimestre', codigo: 'T1', formula: 'MEDIA' }, { id: 'a2', nome: '2º trimestre', codigo: 'T2', formula: 'MEDIA' }, { id: 'a3', nome: '3º trimestre', codigo: 'T3', formula: 'MEDIA' }],
  };
  const M = (mid, nome, cor, professor, periodoId = 'p1') => ({ id: mid, periodoId, nome, cor, professor, sala: '', formulaEtapa: '', formulaFinal: '', totalAulas: null });
  const materias = [
    M('mat', 'Matemática', 'azul', 'Prof.ª Carla'), M('por', 'Português', 'laranja', 'Prof. Ivan'), { ...M('fis', 'Física', 'agua', 'Prof. Davi'), formulasEtapa: { e3: 'P1*0,4 + P2*0,6' } },
    M('his', 'História', 'amarelo', 'Prof.ª Lúcia'), M('qui', 'Química', 'rosa', 'Prof. Bruno'), M('ing', 'Inglês', 'verde', 'Prof.ª Ana'),
    M('bio', 'Biologia', 'violeta', ''), M('edf', 'Educação Física', 'vermelho', ''),
    M('mat0', 'Matemática', 'azul', '', 'p0'), M('por0', 'Português', 'laranja', '', 'p0'), M('fis0', 'Física', 'agua', '', 'p0'),
  ];
  const N = (materiaId, etapaId, sigla, valor, extra = {}) => ({ id: id(), materiaId, etapaId, nome: { P1: 'Prova 1', P2: 'Prova 2', TRAB: 'Trabalho', REC: 'Recuperação', SIM: 'Simulado' }[sigla] || sigla, sigla, valor, vale: null, peso: 1, data: '', criadoEm: new Date().toISOString(), ...extra });
  const notas = [
    N('mat', 'e1', 'P1', 10, { data: dia(-240) }), N('mat', 'e1', 'P2', 8, { data: dia(-200) }), N('mat', 'e1', 'TRAB', 1.8, { vale: 2, data: dia(-190) }),
    N('mat', 'e2', 'P1', 7, { data: dia(-150) }), N('mat', 'e2', 'P2', 8.5, { data: dia(-100) }),
    N('mat', 'e3', 'P1', 9, { data: dia(-30) }), N('mat', 'e3', 'P2', null, { data: dia(2) }),
    N('por', 'e1', 'P1', 6.5), N('por', 'e1', 'P2', 7), N('por', 'e2', 'P1', 5), N('por', 'e2', 'P2', 6), N('por', 'e3', 'P1', 4), N('por', 'e3', 'TRAB', null, { vale: 2 }),
    N('fis', 'e1', 'P1', 5), N('fis', 'e1', 'P2', 4.5), N('fis', 'e2', 'P1', 6), N('fis', 'e2', 'P2', 5.5), N('fis', 'e3', 'P1', 3.5), N('fis', 'e3', 'P2', 5),
    N('his', 'e1', 'P1', 9), N('his', 'e1', 'TRAB', 2, { vale: 2 }), N('his', 'e2', 'P1', 8), N('his', 'e3', 'P1', 8.5),
    N('qui', 'e1', 'P1', 7), N('qui', 'e2', 'P1', 6.5), N('qui', 'e3', 'SIM', 7.5, { peso: 2 }),
    N('qui', 'e3', 'PART', 0.5, { tipo: 'bonus', nome: 'Participação' }), N('his', 'e2', 'ESCOLA', 8.3, { tipo: 'oficial', nome: 'Média da escola' }),
    N('ing', 'e1', 'P1', 9.5), N('ing', 'e2', 'P1', 10), N('ing', 'e3', 'P1', 9),
    N('bio', 'e1', 'P1', 6), N('bio', 'e2', 'P1', 7),
    N('mat0', 'a1', 'P1', 8), N('mat0', 'a2', 'P1', 7.5), N('mat0', 'a3', 'P1', 8.2),
    N('por0', 'a1', 'P1', 6), N('por0', 'a2', 'P1', 5.5), N('por0', 'a3', 'P1', 7),
    N('fis0', 'a1', 'P1', 4), N('fis0', 'a2', 'P1', 5), N('fis0', 'a3', 'P1', 5.5),
  ];
  const slots = [['07:00', '07:50'], ['07:50', '08:40'], ['08:40', '09:30'], ['09:50', '10:40'], ['10:40', '11:30'], ['11:30', '12:20']];
  const grade = {
    1: ['mat', 'mat', 'por', 'fis', 'his', 'ing'],
    2: ['qui', 'bio', 'mat', 'por', 'por', 'edf'],
    3: ['fis', 'fis', 'his', 'mat', 'ing', 'qui'],
    4: ['bio', 'por', 'mat', 'mat', 'qui', 'his'],
    5: ['ing', 'fis', 'por', 'bio', 'edf', null],
  };
  const aulas = [];
  for (const [d, mats] of Object.entries(grade)) mats.forEach((m, i) => m && aulas.push({ id: id(), periodoId: 'p1', materiaId: m, dia: Number(d), inicio: slots[i][0], fim: slots[i][1], sala: m === 'edf' ? 'Quadra' : '12' }));
  const eventos = [
    { id: 'ev1', titulo: 'Prova de funções', tipo: 'prova', materiaId: 'mat', data: dia(2), hora: '08:00', aviso: 1440, repetir: 'nao', obs: 'Capítulos 7 e 8, função quadrática.' },
    { id: 'ev2', titulo: 'Trabalho sobre a Revolução Francesa', tipo: 'trabalho', materiaId: 'his', data: dia(5), hora: '', aviso: 2880, repetir: 'nao' },
    { id: 'ev3', titulo: 'Lista de exercícios de Física', tipo: 'tarefa', materiaId: 'fis', data: dia(1), hora: '', aviso: 60, repetir: 'semanal', ate: dia(60) },
    { id: 'ev4', titulo: 'Simulado ENEM', tipo: 'evento', materiaId: null, data: dia(12), hora: '13:30', aviso: 1440, repetir: 'nao' },
    { id: 'ev5', titulo: 'Feriado', tipo: 'feriado', materiaId: null, data: dia(6), hora: '', aviso: null, repetir: 'nao' },
    { id: 'ev6', titulo: 'Semana de provas', tipo: 'prova', materiaId: null, data: dia(20), fim: dia(24), hora: '', aviso: 10080, repetir: 'nao' },
    { id: 'ev7', titulo: 'Entregar redação', tipo: 'tarefa', materiaId: 'por', data: dia(0), hora: '18:00', aviso: 60, repetir: 'nao', feito: true },
  ];
  const faltas = [
    { id: id(), materiaId: 'fis', data: dia(-40), quantidade: 2 }, { id: id(), materiaId: 'fis', data: dia(-20), quantidade: 2 },
    { id: id(), materiaId: 'edf', data: dia(-15), quantidade: 6 }, { id: id(), materiaId: 'edf', data: dia(-8), quantidade: 6 },
  ];
  return {
    version: 1, profile: { nome: 'Renzo', escola: 'Colégio Estadual' }, onboarded: true,
    settings: { theme: 'caderno', casas: 1, autoLockMin: 10, avisos: true, avisoDetalhes: true, avisoAulas: false, avisoAulasMin: 5, protegerCaptura: false, segundoPlano: true, periodoAtualId: 'p1' },
    periodos: [anterior, periodo], materias, notas, aulas, eventos, faltas,
  };
}

const errors = [];
const checks = [];
const check = (name, ok, extra = '') => {
  checks.push(ok);
  console.log(ok ? 'ok    ' : 'FALHOU', name, extra);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let contaId = null;
(async () => {
  const c = await vault.criar(userData, { nome: 'Renzo', senha: SENHA, cor: 0 });
  contaId = c.id;
  vault.salvar(userData, c.id, c.chave, JSON.stringify(exemplo()));
  require('../main.js');
})();

let mainWin = null;
app.on('browser-window-created', (_e, win) => {
  if (mainWin) return; // ignora a janela do pdf
  mainWin = win;
  win.webContents.on('console-message', (e) => {
    if (e.level === 'error' || e.level === 'warning') errors.push(`[${e.level}] ${e.message}`);
  });
  win.webContents.once('did-finish-load', () =>
    run(win).catch((err) => {
      console.error('SMOKE FALHOU:', err);
      app.exit(1);
    })
  );
});

async function run(win) {
  const wc = win.webContents;
  win.setSize(1280, 860);
  win.setIgnoreMouseEvents(true);
  const js = (code) => wc.executeJavaScript(code);
  let n = 0;
  const shot = async (name, ms = 500) => {
    await wait(ms);
    const img = await wc.capturePage();
    const file = `${String(++n).padStart(2, '0')}-${name}.png`;
    fs.writeFileSync(path.join(outDir, file), img.toPNG());
    console.log('captura:', file);
  };
  const clickWhen = async (finder, what) => {
    for (let i = 0; i < 40; i++) {
      if (await js(`(() => { const el = ${finder}; if (!el || el.disabled) return false; el.click(); return true; })()`)) return;
      await wait(100);
    }
    throw new Error(`não achei: ${what}`);
  };
  const click = (text, scope = 'document') =>
    clickWhen(`[...${scope}.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(text)}) || b.getAttribute('aria-label') === ${JSON.stringify(text)})`, text);
  const clickModal = (text) => click(text, `(document.querySelector('.modal') || document)`);
  const fill = async (sel, val) => {
    for (let i = 0; i < 30; i++) {
      const ok = await js(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false;
        const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(val)});
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); return true; })()`);
      if (ok) return;
      await wait(100);
    }
    throw new Error(`campo não achado: ${sel}`);
  };
  const text = () => js('document.body.innerText');
  const waitText = async (t, ms = 6000) => {
    for (let i = 0; i < ms / 100; i++) {
      if ((await text()).includes(t)) return true;
      await wait(100);
    }
    return false;
  };
  const nav = (nome) => clickWhen(`[...document.querySelectorAll('.nav button')].find(b => b.textContent.trim() === ${JSON.stringify(nome)})`, nome);
  const esc = async () => { wc.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' }); await wait(200); };
  const scrollMain = (y) => js(`document.querySelector('main') && document.querySelector('main').scrollTo(0, ${y}); true`);

  //login
  check('pede a senha da conta', await waitText('Oi, Renzo'));
  const fonte = await js(`document.fonts.ready.then(() => [...document.fonts].some(f => f.family.includes('Recursive') && f.status === 'loaded'))`);
  check('fonte Recursive carregada', fonte);
  const tnum = await js(`(() => { const s = document.createElement('span'); s.style.cssText = 'font-variant-numeric: tabular-nums; position:absolute; font-size: 40px'; document.body.append(s);
    s.textContent = '1111'; const a = s.offsetWidth; s.textContent = '0000'; const b = s.offsetWidth; s.remove(); return Math.abs(a - b) < 1; })()`);
  check('números alinhados (tabular-nums) funcionam na fonte', tnum);
  await shot('entrada-senha');
  await fill('#senha', 'senha errada 1');
  await click('Entrar');
  check('senha errada avisa', await waitText('Senha incorreta'), '');
  await shot('entrada-senha-errada');
  await fill('#senha', SENHA);
  await click('Entrar');
  check('entra com a senha certa', await waitText('Aulas de hoje', 8000));
  check('avisa da tentativa errada', await waitText('Alguém errou a senha'));
  await shot('inicio');
  await click('Fui eu');

  // notas
  await nav('Notas');
  check('notas: etapa atual é o 3º trimestre', await waitText('3º trimestre'));
  const t = await text();
  check('notas: Matemática parcial pede a P2', t.includes('tire pelo menos') && t.includes('P2'));
  await shot('notas-t3');
  await clickWhen(`[...document.querySelectorAll('.tabs button')].find(b => b.textContent.includes('1º'))`, 'aba T1');
  await shot('notas-t1');
  await clickWhen(`[...document.querySelectorAll('.tabs button')].find(b => b.textContent.includes('Período todo'))`, 'aba período');
  check('boletim mostra situação', await waitText('Em andamento'));
  await shot('notas-periodo');

  await clickWhen(`[...document.querySelectorAll('.tabs button')].find(b => b.textContent.includes('3º'))`, 'aba T3');
  await clickWhen(`document.querySelector('.page-head .btn.primary')`, 'botão + Nota');
  await wait(300);
  await fill('#n-mat', 'qui');
  await fill('#n-nome', 'Trabalho');
  await fill('#n-valor', '8,5');
  check('nota: sigla sugerida TRAB', (await js(`document.querySelector('#n-sigla').value`)) === 'TRAB');
  check('nota: prévia da média', await waitText('antes'));
  await shot('nota-modal');
  await fill('#n-valor', '12');
  await clickModal('Salvar');
  check('nota: recusa nota acima do máximo', await waitText('A nota vai de 0 a 10'));
  await fill('#n-valor', '8,5');
  await js(`[...document.querySelectorAll('.modal-foot button')].find(b => b.textContent.trim() === 'Salvar').click(); true`);
  check('nota: salva', await waitText('TRAB adicionada'));
  check('notas: bônus e conta própria aparecem', (await js(`!!document.querySelector('.chip.bonus')`)) && (await waitText('conta própria')));

  await clickWhen(`document.querySelector('.page-head .btn.primary')`, 'botão + Nota');
  await wait(300);
  await clickModal('Bônus');
  await fill('#n-mat', 'fis');
  await fill('#n-nome', 'Feira de ciências');
  await fill('#n-valor', '0,5');
  check('bônus: prévia soma na média', await waitText('de bônus'));
  await shot('bonus-modal');
  await esc();

  await clickWhen(`[...document.querySelectorAll('.tabs button')].find(b => b.textContent.includes('2º'))`, 'aba T2');
  check('média da escola aparece', await waitText('média da escola'));
  await clickWhen(`[...document.querySelectorAll('.tabs button')].find(b => b.textContent.includes('3º'))`, 'aba T3');

  await click('Fórmulas');
  await wait(300);
  await fill('#f-final', '(T1 + T2*2 + T3*3');
  check('fórmula: mostra o erro', await waitText('Falta fechar um parêntese'));
  await fill('#f-final', '(T1 + T2*2 + T3*3) / 6');
  check('fórmula: válida com exemplo', await waitText('Fórmula válida'));
  check('fórmulas: lista as matérias com conta própria', await waitText('T3: P1*0,4 + P2*0,6'));
  // provas de 5: tudo 7 passa de 10
  await fill('#f-todas', '((NOTA1+NOTA2)*0,4+(NOTA3)*0,6)');
  check('fórmula: explica quando tudo 7 não dá 7', await waitText('a conta dá 9,8 e não 7,0'));
  await shot('formula-tudo-7');
  await fill('#f-todas', 'P1*0,5 + TRAB*2,5');
  check('fórmula: exemplo respeita o "vale" de cada nota', (await waitText('TRAB 1,4 de 2')) && (await waitText('o resultado é 7,0')));
  await fill('#f-todas', 'MEDIA');
  await shot('formulas');
  await js(`document.querySelector('.modal-body').scrollTo(0, 9999); true`);
  await shot('formulas-materias', 300);
  await fill('#f-final', 'se(MEDIA >= 6; MEDIA; (MEDIA + REC) / 2)');
  await clickWhen(`[...document.querySelectorAll('.conta-list button')].find(b => b.textContent.includes('Dar conta própria'))`, 'dar conta própria');
  check('matéria: conta por trimestre', await waitText('A mesma em todos os trimestres'));
  await js(`document.querySelector('.modal .formula-box input[type=checkbox]').click(); true`);
  await wait(300);
  check('matéria: uma conta para cada trimestre', (await js(`document.querySelectorAll('.modal .formula-box .field').length`)) >= 4);
  await shot('materia-conta');
  await clickModal('Voltar');
  check('volta para as fórmulas', await waitText('Matérias com conta diferente'));
  await clickModal('Cancelar');

  await click('Importar');
  check('importar: passos', await waitText('Copiar pedido'));
  await click('Ver o pedido');
  check('importar: pedido cita as matérias', (await js(`document.querySelector('.prompt-box').value`)).includes('Matemática, Português'));
  await shot('importar-passo1');
  const respostaIA = 'Aqui está:\n```json\n' + JSON.stringify({ caderneta: 'notas', notas: [
    { materia: 'MATEMÁTICA', parte: '3º Trimestre', avaliacao: 'Prova 2', nota: 7.5 },
    { materia: 'Língua Portuguesa', parte: 'T3', avaliacao: 'Trabalho', nota: 1.5, vale: 2 },
    { materia: 'Artes', parte: 'T3', avaliacao: 'Desenho', nota: 9 },
    { materia: 'Biologia', parte: 'T3', avaliacao: 'Prova 1', nota: 11 },
  ], medias: [{ materia: 'Inglês', parte: 'T3', media: 9.2 }], bonus: [{ materia: 'Física', parte: 'T3', motivo: 'Olimpíada', pontos: 0.5 }] }, null, 1) + '\n```\nQualquer coisa, é só pedir.';
  await fill('#imp-texto', respostaIA);
  await clickModal('Conferir');
  check('importar: prévia', await waitText('Conferir as notas'));
  const prev = await text();
  check('importar: casou nomes e achou o erro', prev.includes('troca a fazer por 7,5') && prev.includes('A nota passa de 10') && (await js(`!!document.querySelector('.tag.novo')`)));
  await shot('importar-conferir');
  await clickWhen(`[...document.querySelectorAll('.modal-foot button')].find(b => b.textContent.startsWith('Importar'))`, 'importar');
  check('importar: gravou', await waitText('Importado'));
  check('importar: matéria nova na lista', await waitText('Artes'));
  await shot('notas-importadas');

  check('médias da escola: aviso com o botão', await waitText('médias da escola no lugar das suas fórmulas'));
  await click('Excluir médias da escola');
  check('médias da escola: pede confirmação', await waitText('As médias voltam a sair das suas fórmulas'));
  await shot('excluir-medias');
  await clickModal('Excluir médias');
  check('médias da escola: excluídas', await waitText('médias da escola excluídas'));
  await wait(400);
  check('médias da escola: aviso some e não sobra etiqueta', !(await js(`!!document.querySelector('.chip.oficial') || document.body.innerText.includes('no lugar das suas fórmulas')`)));

  await click('Matérias');
  await wait(300);
  await shot('materias');
  await clickModal('Pronto');

  // horario
  await nav('Horário');
  check('horário: contagem de aulas', await waitText('aulas'));
  await shot('horario');
  await clickWhen(`document.querySelector('.aula')`, 'bloco de aula');
  await wait(300);
  await shot('aula-modal');
  await esc();

  await click('Mudar a semana');
  check('semana: carregou os 6 horários', (await waitText('Montar o horário da semana')) && (await js(`document.querySelectorAll('.grade tbody tr').length`)) === 6);
  await shot('semana-tabela');
  await js(`(() => { const s = document.querySelector('.grade tbody tr select.cel'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'qui'); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  await clickModal('Salvar horário');
  check('semana: salvou', await waitText('Horário salvo'));

  await click('Importar');
  await fill('#imp-texto', JSON.stringify({ aulas: [
    { dia: 'segunda', inicio: '07:00', fim: '07:50', materia: 'Matemática', sala: '12' },
    { dia: 'segunda', inicio: '07:50', materia: 'Física' },
    { dia: 'terça', horario: '07:00 - 07:50', materia: 'Química' },
    { dia: 'quarta', inicio: '07:00', fim: '07:50', materia: 'Robótica' },
  ] }));
  await clickModal('Conferir');
  check('importar horário: prévia', (await waitText('Conferir o horário')) && (await waitText('Trocar o horário atual')));
  await shot('importar-horario');
  await clickWhen(`document.querySelector('.modal-head [aria-label="Fechar"]')`, 'fechar');

  // calendario
  await nav('Calendário');
  check('calendário: evento aparece', await waitText('Prova de funções'));
  await shot('calendario');
  await clickWhen(`[...document.querySelectorAll('.page-head button')].find(b => b.textContent.includes('Adicionar'))`, 'adicionar evento');
  await wait(300);
  await fill('#e-tit', 'Feira de ciências');
  await clickWhen(`[...document.querySelectorAll('.modal .toggle-chips button')].find(b => b.textContent.includes('Evento'))`, 'tipo evento');
  await shot('evento-modal');
  await js(`[...document.querySelectorAll('.modal-foot button')].find(b => b.textContent.trim() === 'Salvar').click(); true`);
  check('calendário: evento salvo', await waitText('Evento adicionado'));

  await nav('Desempenho');
  check('desempenho: gráfico', await waitText('Melhor nota'));
  await js(`(() => { const svg = document.querySelector('.chart:not(.mini)'); const r = svg.getBoundingClientRect();
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + r.width * 0.2, clientY: r.top + 100, bubbles: true })); })()`);
  await shot('desempenho', 900);
  await click('Ver como tabela');
  await scrollMain(380);
  await shot('desempenho-tabela', 400);
  await scrollMain(0);

  await nav('Histórico');
  check('histórico: período anterior', await waitText(String(ano - 1)));
  await shot('historico');
  await click('Todas as notas');
  await shot('historico-notas');

  const pdf = path.join(outDir, 'boletim.pdf');
  const r = await js(`window.caderneta.exportarPdf({ nome: 'x.pdf', html: '<!doctype html><h1>Boletim de teste</h1>', arquivo: ${JSON.stringify(pdf)} })`);
  check('PDF gerado', r && r.ok && fs.existsSync(pdf) && fs.statSync(pdf).size > 800);

  await clickWhen(`document.querySelector('.me')`, 'ajustes');
  check('ajustes: últimos acessos', await waitText('Senha errada'));
  await click('Testar aviso');
  await wait(400);
  const log = path.join(userData, 'avisos-teste.log');
  check('aviso do Windows sai', fs.existsSync(log) && fs.readFileSync(log, 'utf8').includes('Os avisos estão funcionando'));
  await shot('ajustes');

  // pin
  await click('Criar PIN');
  await wait(300);
  await fill('#pin-s', SENHA);
  await fill('#pin-n', '123456');
  await fill('#pin-c', '123456');
  await clickModal('Criar PIN');
  check('PIN fácil é recusado', await waitText('fácil de adivinhar'));
  await fill('#pin-n', '482913');
  await fill('#pin-c', '482913');
  await shot('pin-criar');
  await clickModal('Criar PIN');
  check('PIN criado', await waitText('PIN criado', 8000));
  check('pin.dat existe', fs.existsSync(path.join(userData, 'contas', contaId, 'pin.dat')));
  await clickWhen(`document.querySelector('[aria-label="Travar agora"]')`, 'travar');
  check('travado: pede o PIN', await waitText('Digite seu PIN', 8000));
  await shot('entrada-pin');
  await fill('#pin', '000000');
  check('PIN errado avisa', await waitText('PIN errado', 8000));
  await shot('entrada-pin-errado');
  await fill('#pin', '482913');
  check('entra com o PIN', await waitText('Aulas de hoje', 8000));
  await clickWhen(`document.querySelector('.me')`, 'ajustes');
  check('ajustes: PIN ligado', await waitText('Ligado, com 6 números'));
  await js(`document.querySelector('.settings section:nth-of-type(4)').scrollIntoView(); true`);
  await shot('ajustes-seguranca', 400);
  await scrollMain(0);

  await click('Lousa');
  await wait(500);
  check('tema escuro ligado', (await js(`document.documentElement.dataset.theme`)) === 'lousa');
  await shot('ajustes-lousa');
  for (const [v, nome] of [['Início', 'inicio'], ['Notas', 'notas'], ['Horário', 'horario'], ['Calendário', 'calendario'], ['Desempenho', 'desempenho'], ['Histórico', 'historico']]) {
    await nav(v);
    await shot(`${nome}-lousa`, nome === 'desempenho' ? 900 : 500);
  }

  win.setSize(900, 640);
  await nav('Notas');
  await shot('notas-900', 700);
  await nav('Horário');
  await shot('horario-900');
  await nav('Início');
  await shot('inicio-900');
  win.setSize(1280, 860);

  const cofre = fs.readFileSync(path.join(userData, 'contas', contaId, 'cofre.cad'), 'utf8');
  check('cofre não mostra os dados', !/Matem|Física|Prova de funções|Carla/.test(cofre));
  check('cópia do dia existe', fs.readdirSync(path.join(userData, 'contas', contaId, 'copias')).length >= 1);

  // travar
  await clickWhen(`document.querySelector('[aria-label="Travar agora"]')`, 'travar');
  check('travou e voltou para a senha', await waitText('Oi, Renzo', 8000));
  await wait(400);
  const vazou = await js(`document.body.innerText.includes('Matemática')`);
  check('tela travada não mostra notas', !vazou);
  await shot('travado-lousa');

  // 2a conta
  await click('Usar a senha');
  await click('Criar outra conta');
  await wait(300);
  await fill('#nome', 'Bia');
  await fill('#nova', '12345678');
  check('senha comum é recusada', await waitText('Muito fácil'));
  await fill('#nova', 'girassol na janela 7');
  await fill('#conf', 'girassol na janela 7');
  await shot('criar-conta');
  await click('Criar conta');
  check('mostra o código de recuperação', await waitText('Guarde seu código', 8000));
  const codigo = await js(`document.querySelector('.recovery').textContent`);
  check('código no formato certo', /^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/.test(codigo), codigo);
  await shot('codigo');
  await js(`document.querySelector('.auth .check input').click(); true`);
  await click('Continuar');
  check('primeiros passos', await waitText('Como sua escola divide o ano?'));
  await shot('onboarding-1');
  await clickWhen(`[...document.querySelectorAll('.choice')].find(b => b.textContent.includes('outro'))`, 'outro jeito');
  await fill('#tipo', 'semestre');
  await fill('#qtd', '8');
  await fill('#pn', 'Engenharia');
  await click('Continuar');
  check('escolher matérias', await waitText('Quais matérias'));
  for (const m of ['Matemática', 'Física', 'Química']) await clickWhen(`[...document.querySelectorAll('.toggle-chips button')].find(b => b.textContent.trim() === ${JSON.stringify(m)})`, m);
  await shot('onboarding-2');
  await click('Começar');
  check('entrou na conta nova', await waitText('Bia', 6000));
  await nav('Notas');
  check('8 semestres criados', (await js(`document.querySelectorAll('.tabs [role=tab]').length`)) === 9);
  await shot('conta-nova-notas');

  console.log(`\n${checks.filter(Boolean).length} de ${checks.length} verificações ok`);
  if (errors.length) console.log('Erros no console da tela:\n' + errors.join('\n'));
  app.exit(checks.every(Boolean) && !errors.length ? 0 : 1);
}
