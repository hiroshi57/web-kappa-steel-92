/**
 * ラベル付き比較バー群（依存なし）。
 * 対人・局面・利き足・判断・セットプレーなど「複数指標を並べて見る」用途。
 * 評価カラーは lib/rating に統一。任意で参照マーカー（平均線など）を表示。
 */

import { rating } from "@/lib/rating";
import styles from "@/styles/insights.module.css";

export interface StatBarItem {
  label: string;
  value: number;
  /** 参照値（平均など）。指定時はトラック上にマーカー表示 */
  marker?: number;
}

interface Props {
  items: StatBarItem[];
}

export default function StatBars({ items }: Props) {
  return (
    <div className={styles.bars}>
      {items.map((it) => {
        const r = rating(it.value);
        return (
          <div key={it.label} className={styles.barRow}>
            <div className={styles.barHead}>
              <span className={styles.barLabel}>{it.label}</span>
              <span className={styles.barValue} style={{ color: r.color }}>
                {it.value}
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-subtle)",
                    fontWeight: 600,
                  }}
                >
                  {r.grade}
                </span>
              </span>
            </div>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${Math.min(100, Math.max(0, it.value))}%`, background: r.color }}
              />
              {it.marker != null ? (
                <span
                  className={styles.barMarker}
                  style={{ left: `${Math.min(100, Math.max(0, it.marker))}%` }}
                  title={`参照 ${it.marker}`}
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
