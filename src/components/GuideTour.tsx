/**
 * 営業デモ用ガイドツアー（スポットライト＋ツールチップ・依存なし）。
 *
 * 各ステップは対象要素を CSS セレクタで指すか、selector 省略で中央表示。
 * 対象要素の位置を実測してスポットライトとツールチップを配置し、
 * リサイズ/スクロールに追従する。完了・スキップは localStorage に記録。
 */

import { useCallback, useEffect, useState } from "react";

import styles from "@/styles/tour.module.css";

export interface TourStep {
  selector?: string;
  title: string;
  body: string;
}

interface Props {
  steps: TourStep[];
  storageKey: string;
  /** 未完了なら初回自動起動 */
  autoStart?: boolean;
  /** 外部からの起動トリガー（値が変わると起動） */
  startSignal?: number;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

export default function GuideTour({ steps, storageKey, autoStart, startSignal }: Props) {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = active ? steps[index] : null;

  const measure = useCallback(() => {
    if (!step?.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  // 自動起動（未完了時のみ）
  useEffect(() => {
    if (!autoStart) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(storageKey) === "done") return;
    const t = setTimeout(() => {
      setIndex(0);
      setActive(true);
    }, 600);
    return () => clearTimeout(t);
  }, [autoStart, storageKey]);

  // 外部トリガー起動
  useEffect(() => {
    if (startSignal && startSignal > 0) {
      void Promise.resolve().then(() => {
        setIndex(0);
        setActive(true);
      });
    }
  }, [startSignal]);

  // 位置計測（ステップ変更・リサイズ・スクロール）
  useEffect(() => {
    if (!active) return;
    const onChange = () => measure();
    void Promise.resolve().then(measure);
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    const t = setInterval(measure, 400); // レイアウト遅延に追従
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
      clearInterval(t);
    };
  }, [active, measure]);

  const finish = useCallback(() => {
    setActive(false);
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, "done");
  }, [storageKey]);

  if (!active || !step) return null;

  // ツールチップ位置: 対象の下、はみ出すなら上/中央
  let tooltipStyle: React.CSSProperties = {};
  let centered = false;
  if (rect) {
    const below = rect.top + rect.height + 14;
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - 352);
    if (spaceBelow > 220) {
      tooltipStyle = { top: below, left };
    } else {
      tooltipStyle = { top: Math.max(12, rect.top - 220), left };
    }
  } else {
    centered = true;
  }

  const isLast = index === steps.length - 1;

  return (
    <div className={styles.overlay} aria-live="polite">
      {rect ? (
        <div
          className={styles.spotlight}
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
          }}
        />
      ) : (
        <div className={styles.dim} />
      )}

      <div
        className={`${styles.tooltip} ${centered ? styles.centered : ""}`}
        style={centered ? undefined : tooltipStyle}
      >
        <div className={styles.counter}>
          STEP {index + 1} / {steps.length}
        </div>
        <div className={styles.title}>{step.title}</div>
        <div className={styles.body}>{step.body}</div>
        <div className={styles.dots}>
          {steps.map((_, i) => (
            <span key={i} className={`${styles.dot} ${i === index ? styles.dotActive : ""}`} />
          ))}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={finish}>
            スキップ
          </button>
          <div className={styles.navBtns}>
            {index > 0 ? (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                戻る
              </button>
            ) : null}
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
            >
              {isLast ? "はじめる" : "次へ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
