import { useEffect, useState } from "react";
import type { RiskCategory } from "../types";

export const RISK_COLOR: Record<RiskCategory, string> = {
  LOW: "#1D7A50",
  MODERATE: "#A17000",
  HIGH: "#BF4E12",
  EXTREME: "#AF2318",
};

/**
 * The risk gauge, drawn like a ship's instrument: a fine tick ring, an ink
 * arc, threshold marks at the band edges, and a serif numeral that counts up
 * so the verdict lands with weight.
 */
export default function RiskDial({
  score,
  category,
  size = 138,
}: {
  score: number;
  category: RiskCategory;
  size?: number;
}) {
  const [shown, setShown] = useState(0);
  const color = RISK_COLOR[category];
  const c = size / 2;
  const rArc = c - 13;
  const circumference = 2 * Math.PI * rArc;

  useEffect(() => {
    const duration = 750;
    let raf = 0;
    const start = performance.now();
    const from = shown;

    const tick = (now: number) => {
      // rAF's timestamp can predate the performance.now() captured above, which
      // made t negative and briefly rendered a negative score. Clamp both ends.
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (score - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // FAIL-SAFE: requestAnimationFrame is suspended while a tab is hidden or
    // not compositing, which would leave the dial reading 0 for a 92/100
    // EXTREME verdict. The animation is decoration; the number is safety
    // information, so it must land whether or not any frame is ever painted.
    const settle = window.setTimeout(() => setShown(score), duration + 120);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  // Outer instrument ticks: a mark every 2 points, a major every 10.
  const ticks = Array.from({ length: 50 }, (_, i) => {
    const a = (i / 50) * 2 * Math.PI - Math.PI / 2;
    const major = i % 5 === 0;
    const r1 = major ? c - 5.5 : c - 3.5;
    return {
      x1: c + r1 * Math.cos(a),
      y1: c + r1 * Math.sin(a),
      x2: c + (c - 1) * Math.cos(a),
      y2: c + (c - 1) * Math.sin(a),
      major,
    };
  });

  // Band thresholds marked on the ring, as an instrument prints its red-lines.
  const thresholds = [
    { v: 25, col: RISK_COLOR.LOW },
    { v: 50, col: RISK_COLOR.MODERATE },
    { v: 79, col: RISK_COLOR.HIGH },
  ].map(({ v, col }) => {
    const a = (v / 100) * 2 * Math.PI - Math.PI / 2;
    return {
      x1: c + (c - 8) * Math.cos(a),
      y1: c + (c - 8) * Math.sin(a),
      x2: c + (c - 1) * Math.cos(a),
      y2: c + (c - 1) * Math.sin(a),
      col,
    };
  });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {ticks.map((tk, i) => (
          <line
            key={i}
            x1={tk.x1}
            y1={tk.y1}
            x2={tk.x2}
            y2={tk.y2}
            stroke="#12212D"
            strokeWidth={tk.major ? 1.3 : 0.6}
            opacity={tk.major ? 0.7 : 0.35}
          />
        ))}
        {thresholds.map((th, i) => (
          <line
            key={`t${i}`}
            x1={th.x1}
            y1={th.y1}
            x2={th.x2}
            y2={th.y2}
            stroke={th.col}
            strokeWidth={2.4}
          />
        ))}
        <circle cx={c} cy={c} r={rArc} fill="#FBF7ED" stroke="rgba(18,33,45,0.2)" strokeWidth={7} />
        <circle
          cx={c}
          cy={c}
          r={rArc}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="butt"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
          style={{ transition: "stroke-dashoffset .12s linear" }}
          transform={`rotate(-90 ${c} ${c})`}
        />
        <circle cx={c} cy={c} r={rArc - 6.5} fill="none" stroke="rgba(18,33,45,0.3)" strokeWidth={0.8} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none">
          <div
            className="font-display text-[38px] font-black tabular-nums tracking-tight"
            style={{ color }}
          >
            {Math.max(0, shown)}
          </div>
          <div className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-400">
            / 100
          </div>
        </div>
      </div>
    </div>
  );
}
