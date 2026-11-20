// html do boletim p/ pdf
import { finalResult, situacao, SITUACAO_TEXTO, tipoDe } from './grades.js';
import { frequencia } from './schedule.js';
import { fmtNota, fmtData, hojeISO } from './format.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CSS = `
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #182039; font-size: 11pt; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #2547C0; padding-bottom: 8px; margin-bottom: 14px; }
  h1 { font-size: 20pt; margin: 0; }
  .who { color: #4b5672; font-size: 10pt; }
  h2 { font-size: 13pt; margin: 18px 0 6px; }
  .meta { color: #4b5672; font-size: 9.5pt; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th { text-align: left; font-size: 9pt; color: #4b5672; border-bottom: 1px solid #c5d0df; padding: 5px 6px; background: #f6f8fb; }
  td { padding: 5px 6px; border-bottom: 1px solid #dfe6f0; font-size: 10pt; }
  .c { text-align: center; }
  .low { color: #c4303a; font-weight: 600; }
  .fin { font-weight: 700; }
  .ok { color: #1d7a4f; font-weight: 600; }
  .bad { color: #c4303a; font-weight: 600; }
  .parc { color: #737e97; }
  footer { margin-top: 18px; font-size: 8.5pt; color: #737e97; }
  section { page-break-inside: avoid; }
`;

function tabelaPeriodo(data, periodo, casas) {
  const materias = data.materias.filter((m) => m.periodoId === periodo.id);
  const linhas = materias.map((m) => {
    const r = finalResult(data, periodo, m);
    const sit = situacao(periodo, r);
    const f = frequencia(data, periodo, m);
    const cls = sit === 'aprovado' ? 'ok' : sit === 'abaixo' || sit === 'risco' ? 'bad' : '';
    return `<tr>
      <td>${esc(m.nome)}</td>
      ${r.etapas.map((e) => `<td class="c ${e.valor !== null && e.valor + 1e-9 < periodo.mediaMinima ? 'low' : ''} ${e.parcial ? 'parc' : ''}">${esc(fmtNota(e.valor, casas))}</td>`).join('')}
      <td class="c">${esc(r.finais.filter((n) => n.valor !== null).map((n) => (tipoDe(n) === 'oficial' ? `escola ${fmtNota(n.valor, casas)}` : tipoDe(n) === 'bonus' ? `${n.sigla} ${n.valor > 0 ? '+' : ''}${fmtNota(n.valor, casas)}` : `${n.sigla} ${fmtNota(n.valor, casas)}`)).join(', ') || '—')}</td>
      <td class="c fin ${r.valor !== null && r.valor + 1e-9 < periodo.mediaMinima ? 'low' : ''}">${esc(fmtNota(r.valor, casas))}</td>
      <td class="c">${f.total ? `${Math.round(f.percentual)}%` : f.faltas ? `${f.faltas} faltas` : '—'}</td>
      <td class="${cls}">${esc(SITUACAO_TEXTO[sit])}</td>
    </tr>`;
  }).join('');
  return `<section>
    <h2>${esc(periodo.nome)}</h2>
    <div class="meta">Média para passar: ${esc(fmtNota(periodo.mediaMinima, casas))} de ${esc(fmtNota(periodo.notaMaxima, 0))}. Média final: ${esc(periodo.formulaFinal)}.${periodo.concluido ? ' Período concluído.' : ''}</div>
    <table>
      <thead><tr><th>Matéria</th>${periodo.etapas.map((e) => `<th class="c">${esc(e.codigo)}</th>`).join('')}<th class="c">Notas finais</th><th class="c">Final</th><th class="c">Frequência</th><th>Situação</th></tr></thead>
      <tbody>${linhas || `<tr><td colspan="${periodo.etapas.length + 5}">Sem matérias.</td></tr>`}</tbody>
    </table>
  </section>`;
}

export function relatorioHTML(data, periodos, titulo) {
  const casas = data.settings.casas;
  const nome = data.profile.nome;
  const escola = data.profile.escola;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${esc(titulo)}</title><style>${CSS}</style></head><body>
    <header><div><h1>${esc(titulo)}</h1><div class="who">${esc(nome)}${escola ? `, ${esc(escola)}` : ''}</div></div><div class="who">Gerado em ${esc(fmtData(hojeISO()))}</div></header>
    ${periodos.map((p) => tabelaPeriodo(data, p, casas)).join('')}
    <footer>Valores em cinza são parciais (ainda há avaliação sem nota). Feito com a Caderneta.</footer>
  </body></html>`;
}
