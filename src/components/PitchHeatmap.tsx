/**
 * ピッチ型ゾーン占有ヒートマップ（SVG・依存なし）。
 *
 * 縦向きのサッカーピッチ（下=自陣 / 上=敵陣）にラインを描画し、
 * 3×3 ゾーンの占有率を強度カラーで重ねる。スカウトが「どこでプレーするか」を
 * 直感的に把握できるプロダクション品質の可視化。
 *
 * zones: [自陣行, 中盤行, 敵陣行] × [左, 中, 右] の占有率(%)。
 */

interface Props {
  zones: number[][];
  /** 行動範囲スコア(0-100)。ヘッダー表示に使う */
  coverage?: number;
  width?: number;
  height?: number;
}

const FIELD = "#1f7a46";
const FIELD_ALT = "#227f4a";
const LINE = "rgba(255,255,255,0.7)";

/** 占有率(0-1)を青→シアン→黄→赤のヒートカラーへ */
function heatColor(t: number): string {
  const stops: [number, [number, number, number]][] = [
    [0.0, [37, 99, 235]], // accent blue
    [0.45, [16, 185, 190]], // teal
    [0.7, [217, 160, 6]], // amber
    [1.0, [220, 38, 38]], // red
  ];
  const c = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (c <= stops[i][0]) {
      const [p0, a] = stops[i - 1];
      const [p1, b] = stops[i];
      const k = (c - p0) / (p1 - p0);
      const rgb = a.map((v, j) => Math.round(v + (b[j] - v) * k));
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    }
  }
  return "rgb(220,38,38)";
}

export default function PitchHeatmap({ zones, coverage, width = 360, height = 470 }: Props) {
  const pad = 14;
  const fieldW = width - pad * 2;
  const fieldH = height - pad * 2;
  const cellW = fieldW / 3;
  const cellH = fieldH / 3;
  const flat = zones.flat();
  const max = Math.max(1, ...flat);

  // 描画は上=敵陣にするため zones を逆順（配列先頭=自陣を下段へ）
  const rowsTopToBottom = [...zones].reverse(); // [敵陣, 中盤, 自陣]

  const box = { w: fieldW * 0.55, h: fieldH * 0.16 };
  const boxX = pad + (fieldW - box.w) / 2;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="ゾーン占有ヒートマップ"
      style={{ maxWidth: width, display: "block", margin: "0 auto" }}
    >
      <defs>
        <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={FIELD_ALT} />
          <stop offset="100%" stopColor={FIELD} />
        </linearGradient>
      </defs>

      {/* 芝生 */}
      <rect x={pad} y={pad} width={fieldW} height={fieldH} rx={8} fill="url(#pitchGrad)" />
      {/* 芝の横縞 */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x={pad}
          y={pad + (fieldH / 6) * i}
          width={fieldW}
          height={fieldH / 6}
          fill={i % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent"}
        />
      ))}

      {/* ヒートセル */}
      {rowsTopToBottom.map((row, ri) =>
        row.map((v, ci) => {
          const t = v / max;
          return (
            <g key={`${ri}-${ci}`}>
              <rect
                x={pad + cellW * ci}
                y={pad + cellH * ri}
                width={cellW}
                height={cellH}
                fill={heatColor(t)}
                opacity={0.12 + t * 0.62}
              />
              <text
                x={pad + cellW * ci + cellW / 2}
                y={pad + cellH * ri + cellH / 2 + 5}
                textAnchor="middle"
                fontSize={15}
                fontWeight={700}
                fill="#ffffff"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
              >
                {v}%
              </text>
            </g>
          );
        })
      )}

      {/* ピッチライン */}
      <g fill="none" stroke={LINE} strokeWidth={1.5}>
        <rect x={pad} y={pad} width={fieldW} height={fieldH} rx={8} />
        {/* センターライン */}
        <line x1={pad} y1={pad + fieldH / 2} x2={pad + fieldW} y2={pad + fieldH / 2} />
        <circle cx={width / 2} cy={pad + fieldH / 2} r={fieldW * 0.13} />
        {/* ペナルティエリア（上=敵陣ゴール / 下=自陣ゴール） */}
        <rect x={boxX} y={pad} width={box.w} height={box.h} />
        <rect x={boxX} y={pad + fieldH - box.h} width={box.w} height={box.h} />
        {/* ゴール */}
        <rect x={width / 2 - fieldW * 0.12} y={pad - 5} width={fieldW * 0.24} height={5} />
        <rect
          x={width / 2 - fieldW * 0.12}
          y={pad + fieldH}
          width={fieldW * 0.24}
          height={5}
        />
      </g>

      {/* 方向ラベル */}
      <text x={pad + 4} y={pad + 16} fontSize={11} fill="rgba(255,255,255,0.85)" fontWeight={600}>
        敵陣（攻撃方向）↑
      </text>
      <text
        x={pad + 4}
        y={pad + fieldH - 8}
        fontSize={11}
        fill="rgba(255,255,255,0.85)"
        fontWeight={600}
      >
        自陣
      </text>
      {coverage != null ? (
        <text
          x={pad + fieldW - 4}
          y={pad + 16}
          fontSize={11}
          textAnchor="end"
          fill="rgba(255,255,255,0.9)"
          fontWeight={600}
        >
          行動範囲 {coverage}
        </text>
      ) : null}
    </svg>
  );
}
