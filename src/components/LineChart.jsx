import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmtNota } from '../lib/format.js';

function useWidth(ref, fallback = 600) {
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const el = ref.current;
    setW(el.clientWidth || fallback);
    const ro = new ResizeObserver(() => setW(el.clientWidth || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fallback]);
  return w;
}

const passo = (max) => {
  const bruto = max / 5;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / pot;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pot;
};

// pontos = [{id, rotulo, grupo?, detalhe, valor, bruto?, vale?}]
export default function LineChart({ pontos, max, min, casas = 1, height = 280, mini = false, label, chaveAnimacao }) {
  const ref = useRef(null);
  const width = useWidth(ref, mini ? 220 : 640);
  const [hover, setHover] = useState(null);
  useEffect(() => setHover(null), [chaveAnimacao]);

  const pad = mini ? { l: 4, r: 8, t: 8, b: 6 } : { l: 34, r: 28, t: 22, b: pontos.some((p) => p.grupo) ? 48 : 30 };
  const iw = Math.max(10, width - pad.l - pad.r);
  const ih = Math.max(10, height - pad.t - pad.b);
  const n = pontos.length;
  const x = (i) => pad.l + (n <= 1 ? iw / 2 : (iw * (i + 0.5)) / n);
  const y = (v) => pad.t + ih - (Math.max(0, Math.min(max, v)) / max) * ih;

  const step = passo(max);
  const ticks = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);

  const d = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');

  // rotulo so no ultimo e nos extremos
  const rotulados = new Set();
  if (n && !mini) {
    rotulados.add(n - 1);
    let iMax = 0;
    let iMin = 0;
    pontos.forEach((p, i) => {
      if (p.valor > pontos[iMax].valor) iMax = i;
      if (p.valor < pontos[iMin].valor) iMin = i;
    });
    rotulados.add(iMax);
    rotulados.add(iMin);
  }

  const grupos = [];
  pontos.forEach((p, i) => {
    if (!p.grupo) return;
    const g = grupos[grupos.length - 1];
    if (g && g.nome === p.grupo) g.fim = i;
    else grupos.push({ nome: p.grupo, ini: i, fim: i });
  });

  const onMove = (e) => {
    if (mini || !n) return;
    const r = ref.current.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHover(best);
  };
  const onKey = (e) => {
    if (!n) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); setHover((h) => (h === null ? 0 : Math.min(n - 1, h + 1))); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setHover((h) => (h === null ? n - 1 : Math.max(0, h - 1))); }
    if (e.key === 'Escape') setHover(null);
  };

  const hp = hover !== null ? pontos[hover] : null;
  return (
    <div className="chart-wrap" ref={ref}>
      <svg
        className={`chart ${mini ? 'mini' : ''}`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        tabIndex={mini ? -1 : 0}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        style={{ display: 'block', outline: 'none' }}
      >
        <rect className="below" x={pad.l} y={y(min)} width={iw} height={Math.max(0, y(0) - y(min))} />
        {!mini && (
          <g className="grid">
            {ticks.map((t) => <line key={t} x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} />)}
          </g>
        )}
        {!mini && (
          <g className="axis">
            {ticks.map((t) => <text key={t} x={pad.l - 8} y={y(t) + 4} textAnchor="end">{fmtNota(t, t % 1 ? 1 : 0)}</text>)}
          </g>
        )}
        {!mini && grupos.length > 1 && grupos.slice(1).map((g) => {
          const sx = (x(g.ini - 1) + x(g.ini)) / 2;
          return <line key={g.nome + g.ini} className="group-sep" x1={sx} x2={sx} y1={pad.t} y2={pad.t + ih + 40} />;
        })}
        <line className="minline" x1={pad.l} x2={pad.l + iw} y1={y(min)} y2={y(min)} />
        {!mini && <text className="minlabel" x={pad.l + iw} y={y(min) - 6} textAnchor="end">para passar: {fmtNota(min, casas)}</text>}

        {n > 1 && <path key={chaveAnimacao} className="line draw" d={d} pathLength="1" />}

        {hp && <line className="cross" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} />}
        {pontos.map((p, i) => (
          <circle key={p.id + i} className={`pt ${p.valor + 1e-9 < min ? 'low' : ''}`} cx={x(i)} cy={y(p.valor)} r={hover === i ? 6.5 : mini ? 3.5 : 5} />
        ))}
        {pontos.map((p, i) => rotulados.has(i) && (
          <text key={'v' + p.id + i} className="vlabel" x={x(i)} y={y(p.valor) - (mini ? 7 : 11)} textAnchor={mini && i === n - 1 ? 'end' : 'middle'} style={mini ? { fontSize: 11 } : null}>
            {fmtNota(p.valor, casas)}
          </text>
        ))}

        {!mini && pontos.map((p, i) => (
          <text key={'x' + p.id + i} className="xlab" x={x(i)} y={pad.t + ih + 18} textAnchor="middle">{p.rotulo}</text>
        ))}
        {!mini && grupos.map((g) => (
          <text key={'g' + g.nome + g.ini} className="xgroup" x={(x(g.ini) + x(g.fim)) / 2} y={pad.t + ih + 36} textAnchor="middle">{g.nome}</text>
        ))}
      </svg>
      {hp && (
        <div className="chart-tip" style={{ left: x(hover), top: y(hp.valor) }}>
          <div className="v">{fmtNota(hp.valor, casas)}</div>
          <div className="k">{hp.detalhe}</div>
          {hp.vale && Math.abs(hp.vale - max) > 1e-9 && <div className="faint small">{fmtNota(hp.bruto, casas)} de {fmtNota(hp.vale, casas)}, convertida para 0 a {fmtNota(max, 0)}</div>}
        </div>
      )}
    </div>
  );
}
