import Head from "next/head";
import Link from "next/link";
import { useRef, useState } from "react";

import styles from "@/styles/dashboard.module.css";
import bill from "@/styles/billing.module.css";
import ins from "@/styles/insights.module.css";

type Phase = "guide" | "select" | "processing" | "done";

const GUIDE = [
  { icon: "📱", text: "横向き（ランドスケープ）で撮影する" },
  { icon: "🧍", text: "選手の全身が常に画面に入るように引きで撮る" },
  { icon: "🎯", text: "三脚などで固定し、手ブレ・過度なズームを避ける" },
  { icon: "☀️", text: "明るい順光で（逆光・暗所は避ける）" },
  { icon: "⏱️", text: "1プレー＝1動画・5分以内にする" },
];

export default function AthleteUploadPage() {
  const [phase, setPhase] = useState<Phase>("guide");
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFileName(f.name);
  };

  const startUpload = () => {
    setPhase("processing");
    setProgress(0);
    // アップロード→解析の進捗を疑似的に進める
    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.random() * 18 + 6;
        if (next >= 100) {
          clearInterval(timer);
          setTimeout(() => setPhase("done"), 400);
          return 100;
        }
        return next;
      });
    }, 350);
  };

  const stepIndex = phase === "guide" ? 0 : phase === "select" ? 1 : phase === "processing" ? 2 : 3;

  return (
    <>
      <Head>
        <title>動画アップロード | sports-tech</title>
      </Head>
      <div className={styles.page}>
        <header className={styles.header}>
          <span className={styles.brand}>
            <span className={styles.brandMark}>⚽</span>
            sports-tech
          </span>
          <Link className={styles.link} href="/athlete/dashboard">
            ← マイダッシュボード
          </Link>
        </header>

        <div className={styles.container} style={{ maxWidth: 720 }}>
          <h1 className={styles.pageTitle}>練習動画をアップロード</h1>

          {/* ステッパー */}
          <div className={bill.stepper}>
            {["撮影ガイド", "動画を選択", "AI解析", "完了"].map((label, i) => (
              <span
                key={label}
                className={`${bill.step} ${
                  i < stepIndex ? bill.stepDone : i === stepIndex ? bill.stepActive : ""
                }`}
              >
                <span className={bill.stepNum}>{i < stepIndex ? "✓" : i + 1}</span>
                {label}
                {i < 3 ? <span className={bill.stepBar} /> : null}
              </span>
            ))}
          </div>

          {/* 撮影ガイド */}
          {phase === "guide" ? (
            <div className={bill.card}>
              <div className={bill.sectionTitle}>撮影のポイント（5原則）</div>
              <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
                精度の高い分析のため、以下を守って撮影してください。
              </p>
              {GUIDE.map((g) => (
                <div
                  key={g.text}
                  style={{
                    display: "flex",
                    gap: "var(--space-3)",
                    alignItems: "center",
                    padding: "var(--space-3) 0",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{g.icon}</span>
                  <span style={{ fontSize: "var(--text-base)" }}>{g.text}</span>
                </div>
              ))}
              <button
                className={bill.cta}
                style={{ marginTop: "var(--space-5)" }}
                onClick={() => setPhase("select")}
              >
                確認した・動画を選ぶ
              </button>
            </div>
          ) : null}

          {/* 動画選択 */}
          {phase === "select" ? (
            <div className={bill.card}>
              <div className={bill.sectionTitle}>動画を選択</div>
              <div
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                style={{
                  border: "2px dashed var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "var(--space-7) var(--space-4)",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "var(--color-surface-2)",
                }}
              >
                <div style={{ fontSize: 40, marginBottom: "var(--space-2)" }}>🎥</div>
                <div style={{ fontWeight: 700 }}>
                  {fileName ?? "クリックして動画ファイルを選択"}
                </div>
                <div
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-subtle)",
                    marginTop: 4,
                  }}
                >
                  MP4 / MOV・横向き・5分以内推奨
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  hidden
                  onChange={onPick}
                />
              </div>
              <button
                className={bill.cta}
                style={{ marginTop: "var(--space-5)" }}
                onClick={startUpload}
                disabled={!fileName}
              >
                アップロードして解析する
              </button>
              <p className={bill.ctaNote}>
                アップロードした動画は解析後、保存期間（90日）を過ぎると自動削除されます。
              </p>
            </div>
          ) : null}

          {/* 解析中 */}
          {phase === "processing" ? (
            <div className={bill.card}>
              <div className={bill.sectionTitle}>AI が解析しています…</div>
              <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
                姿勢推定でスプリント・ボールコントロール・ポジショニング・身体の使い方を
                スコア化しています。
              </p>
              <div className={bill.usageTrack} style={{ height: 12 }}>
                <div
                  className={bill.usageFill}
                  style={{ width: `${progress}%`, background: "var(--color-accent)" }}
                />
              </div>
              <p
                style={{
                  textAlign: "center",
                  marginTop: "var(--space-3)",
                  fontWeight: 700,
                  color: "var(--color-primary)",
                }}
              >
                {Math.min(100, Math.round(progress))}%
              </p>
            </div>
          ) : null}

          {/* 完了 */}
          {phase === "done" ? (
            <div className={bill.card}>
              <div className={bill.done}>
                <div className={bill.doneIcon}>✓</div>
                <div className={bill.doneTitle}>解析が完了しました</div>
                <p className={bill.doneMsg}>
                  スコアとレーダーチャート、成長予測が更新されました。
                  <br />
                  マイダッシュボードで結果を確認できます。
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-3)",
                    justifyContent: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <Link
                    className={bill.cta}
                    href="/athlete/dashboard"
                    style={{ display: "inline-block", width: "auto", padding: "12px 28px" }}
                  >
                    結果を見る
                  </Link>
                  <button
                    type="button"
                    className={ins.btnGhost}
                    style={{
                      padding: "12px 24px",
                      borderRadius: "var(--radius-md)",
                      fontWeight: 700,
                      cursor: "pointer",
                      background: "transparent",
                    }}
                    onClick={() => {
                      setFileName(null);
                      setProgress(0);
                      setPhase("select");
                    }}
                  >
                    続けてアップロード
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
