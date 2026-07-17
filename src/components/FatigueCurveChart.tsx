/**
 * 疲労耐性カーブ（SVG・依存なし）。
 *
 * 試合経過（0〜90分・15分刻み）に対するパフォーマンス維持率(%)を
 * 面グラフ＋折れ線で表示。80%の閾値参照線と終盤維持率の注釈を添える。
 */

interface Props {
  /** 0〜90分（15分刻み・計6点）の維持率(%) */
  curve: number[];
  width?: number;
  height?: number;
}

const ACCENT = "#2563eb";

export default function FatigueCurveChart({ curve, width = 520, height = 220 }: Props) {
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const yMin = 50;
  const yMax = 100;
  const n = curve.length;
  const stepX = plotW / Math.max(1, n - 1);

  const x = (i: number) => padL + stepX * i;
  const y = (v: number) =>
    padT + plotH - ((Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin)) * plotH;

  const linePts = curve.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const areaPts = `${padL},${padT + plotH} ${linePts} ${x(n - 1)},${padT + plotH}`;

  const endurance = curve[curve.length - 1];
  const endColor = endurance >= 90 ? "#16a34a" : endurance >= 80 ? ACCENT : "#d97706";

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="疲労耐性カーブ"
      style={{ maxWidth: width, display: "block" }}
    >
      <defs>
        <linearGradient id="fatigueArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
          <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Y軸グリッド */}
      {[50, 60, 70, 80, 90, 100].map((v) => (
        <g key={v}>
          <line
            x1={padL}
            y1={y(v)}
            x2={width - padR}
            y2={y(v)}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
          <text x={padL - 8} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--color-text-subtle)">
            {v}%
          </text>
        </g>
      ))}

      {/* 80% 閾値参照線 */}
      <line
        x1={padL}
        y1={y(80)}
        x2={width - padR}
        y2={y(80)}
        stroke="#d97706"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <text x={width - padR} y={y(80) - 5} fontSize={10} textAnchor="end" fill="#d97706">
        維持ライン 80%
      </text>

      {/* 面・折れ線 */}
      <polygon points={areaPts} fill="url(#fatigueArea)" />
      <polyline points={linePts} fill="none" stroke={ACCENT} strokeWidth={2.5} strokeLinejoin="round" />

      {/* データ点＋X軸ラベル */}
      {curve.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={3.5} fill="#fff" stroke={ACCENT} strokeWidth={2} />
          <text
            x={x(i)}
            y={height - 10}
            fontSize={10}
            textAnchor="middle"
            fill="var(--color-text-muted)"
          >
            {i * 15}分
          </text>
        </g>
      ))}

      {/* 終盤維持率の注釈 */}
      <circle cx={x(n - 1)} cy={y(endurance)} r={5} fill={endColor} />
      <text
        x={x(n - 1) - 6}
        y={y(endurance) - 10}
        fontSize={12}
        fontWeight={700}
        textAnchor="end"
        fill={endColor}
      >
        終盤 {endurance}%
      </text>
    </svg>
  );
}
