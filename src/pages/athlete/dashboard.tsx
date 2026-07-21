import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import RadarChart, { type RadarAxis } from "@/components/RadarChart";
import ScoreHistoryChart from "@/components/ScoreHistoryChart";
import ScoreRing from "@/components/ScoreRing";
import {
  type AthleteScores,
  getAthleteScores,
  getGuardianConsent,
  getMyProfileViews,
  type GuardianConsent,
  type ProfileViewSummary,
  setGuardianConsent,
} from "@/lib/api";
import styles from "@/styles/dashboard.module.css";
import bill from "@/styles/billing.module.css";
import ins from "@/styles/insights.module.css";

const METRICS = [
  { key: "sprint_score", label: "スプリント" },
  { key: "ball_control_score", label: "ボール" },
  { key: "positioning_score", label: "ポジ" },
  { key: "body_usage_score", label: "身体" },
] as const;

// デモでは d1 を「本人（お子さま）」として表示
const SELF_ID = "d1";

function relDays(iso: string): string {
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (d <= 0) return "今日";
  if (d === 1) return "昨日";
  if (d < 30) return `${d}日前`;
  return `${Math.floor(d / 30)}ヶ月前`;
}

export default function AthleteDashboardPage() {
  const [scores, setScores] = useState<AthleteScores | null>(null);
  const [views, setViews] = useState<ProfileViewSummary | null>(null);
  const [consent, setConsent] = useState<GuardianConsent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    void getAthleteScores(SELF_ID).then(setScores, () => setError("データの取得に失敗しました"));
    void getMyProfileViews().then(setViews, () => undefined);
    void getGuardianConsent().then(setConsent, () => undefined);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const toggleConsent = () => {
    if (!consent) return;
    const next = !consent.consent_granted;
    if (!next && !window.confirm("同意を取り消すと、スカウトへの公開が停止されます。よろしいですか？")) {
      return;
    }
    setBusy(true);
    void setGuardianConsent(next)
      .then(setConsent)
      .finally(() => setBusy(false));
  };

  const axes: RadarAxis[] = scores?.latest
    ? METRICS.map((m) => ({ label: m.label, value: scores.latest![m.key] }))
    : [];

  const growth =
    scores && scores.history.length >= 2
      ? Math.round(
          (scores.history[scores.history.length - 1].total_score -
            scores.history[0].total_score) *
            10
        ) / 10
      : null;

  return (
    <>
      <Head>
        <title>マイダッシュボード | sports-tech</title>
      </Head>
      <div className={styles.page}>
        <header className={styles.header}>
          <span className={styles.brand}>
            <span className={styles.brandMark}>⚽</span>
            sports-tech
          </span>
          <span style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
            <Link className={styles.link} href="/athlete/upload">
              動画をアップロード
            </Link>
            <Link className={styles.link} href="/">
              ← トップ
            </Link>
          </span>
        </header>

        <div className={styles.container}>
          <h1 className={styles.pageTitle}>マイダッシュボード</h1>
          <p className={styles.pageLead}>
            選手本人・保護者向けの画面です。成長の記録、誰に見られているか、
            プライバシー設定をひとまとめに確認できます。
          </p>
          {error ? <p className={styles.error}>{error}</p> : null}

          {/* ── 成長サマリ ── */}
          {scores?.latest ? (
            <section className={styles.section}>
              <h2 className={styles.subheading}>成長サマリ</h2>
              <div className={ins.grid}>
                <div className={ins.panel}>
                  <div className={ins.panelHead}>
                    <span className={ins.panelTitle}>
                      <span className={ins.panelIcon}>⭐</span>
                      {scores.name}
                    </span>
                    <span className={ins.badge}>{scores.position ?? "—"}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-4)",
                      margin: "var(--space-2) 0",
                    }}
                  >
                    <div style={{ position: "relative", width: 96, height: 96 }}>
                      <ScoreRing value={scores.latest.total_score} size={96} stroke={7} />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span style={{ fontSize: "var(--text-2xl)", fontWeight: 800 }}>
                          {scores.latest.total_score}
                        </span>
                        <span
                          style={{ fontSize: "var(--text-xs)", color: "var(--color-text-subtle)" }}
                        >
                          総合(参考値)
                        </span>
                      </div>
                    </div>
                    <div>
                      {growth != null ? (
                        <div style={{ fontSize: "var(--text-base)" }}>
                          初回から{" "}
                          <strong
                            style={{
                              color:
                                growth >= 0 ? "var(--color-success)" : "var(--color-danger)",
                            }}
                          >
                            {growth >= 0 ? "+" : ""}
                            {growth}
                          </strong>{" "}
                          ポイント
                        </div>
                      ) : null}
                      {scores.prediction ? (
                        <div
                          style={{
                            fontSize: "var(--text-sm)",
                            color: "var(--color-text-muted)",
                            marginTop: 4,
                          }}
                        >
                          {scores.prediction.horizon}予測:{" "}
                          <strong>{scores.prediction.projected_total}</strong>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <RadarChart axes={axes} size={240} />
                </div>

                <div className={ins.panel}>
                  <div className={ins.panelHead}>
                    <span className={ins.panelTitle}>
                      <span className={ins.panelIcon}>📈</span>総合スコアの推移
                    </span>
                  </div>
                  <ScoreHistoryChart history={scores.history} />
                  {scores.prediction ? (
                    <p className={ins.comment}>{scores.prediction.comment}</p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : (
            <p className={styles.loading}>読み込み中…</p>
          )}

          {/* ── 閲覧履歴の開示（C#30） ── */}
          <section className={styles.section}>
            <h2 className={styles.subheading}>誰に見られているか（閲覧履歴）</h2>
            <p className={styles.pageLead} style={{ marginTop: 0 }}>
              あなたのカルテを閲覧したスカウト/コーチの記録です。透明性のため、
              個人は特定せず「役割」と日時のみ開示します。
            </p>
            {views ? (
              <>
                <div className={bill.subGrid}>
                  <div className={bill.subStat}>
                    <div className={bill.subStatVal}>{views.total_views}</div>
                    <div className={bill.subStatLabel}>累計の閲覧回数</div>
                  </div>
                  <div className={bill.subStat}>
                    <div className={bill.subStatVal}>{views.views_last_30d}</div>
                    <div className={bill.subStatLabel}>直近30日の閲覧</div>
                  </div>
                  <div className={bill.subStat}>
                    <div className={bill.subStatVal}>
                      {views.recent.filter((v) => v.viewer_role === "scout").length}
                    </div>
                    <div className={bill.subStatLabel}>スカウトからの関心</div>
                  </div>
                </div>
                <div className={ins.panel}>
                  <div className={ins.panelHead}>
                    <span className={ins.panelTitle}>
                      <span className={ins.panelIcon}>👀</span>最近の閲覧
                    </span>
                  </div>
                  {views.recent.map((v, i) => (
                    <div key={i} className={ins.similarRow}>
                      <span className={ins.similarMain}>
                        <span className={ins.similarRank}>
                          {v.viewer_role === "scout" ? "S" : "C"}
                        </span>
                        <span>
                          <span className={ins.similarName}>
                            {v.viewer_role === "scout" ? "スカウト" : "コーチ"}
                          </span>
                          <span className={ins.similarMeta}> があなたのカルテを閲覧</span>
                        </span>
                      </span>
                      <span className={ins.similarSimLabel}>{relDays(v.viewed_at)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.loading}>読み込み中…</p>
            )}
          </section>

          {/* ── 同意・プライバシー（D#32/33/35） ── */}
          {consent ? (
            <section className={styles.section}>
              <h2 className={styles.subheading}>同意・プライバシー</h2>
              <div className={ins.grid}>
                {/* 保護者同意 */}
                <div className={ins.panel}>
                  <div className={ins.panelHead}>
                    <span className={ins.panelTitle}>
                      <span className={ins.panelIcon}>🛡️</span>保護者同意
                    </span>
                    <span
                      className={bill.statusPill}
                      style={{
                        background: consent.consent_granted
                          ? "var(--color-success-bg)"
                          : "var(--color-danger-bg)",
                        color: consent.consent_granted
                          ? "var(--color-success)"
                          : "var(--color-danger)",
                      }}
                    >
                      ● {consent.consent_granted ? "同意済み" : "未同意"}
                    </span>
                  </div>
                  <p className={ins.comment} style={{ marginTop: 0, borderTop: "none" }}>
                    {consent.is_minor
                      ? "18歳未満のため、スカウトへの公開には保護者の同意が必要です。"
                      : "成人のため、公開はご本人の意思で管理できます。"}
                    {consent.guardian_name ? `（同意者: ${consent.guardian_name}）` : ""}
                  </p>
                  <button
                    type="button"
                    className={ins.btn}
                    onClick={toggleConsent}
                    disabled={busy}
                    style={
                      consent.consent_granted
                        ? { background: "var(--color-danger)" }
                        : undefined
                    }
                  >
                    {consent.consent_granted ? "同意を取り消す（公開停止）" : "同意して公開する"}
                  </button>
                </div>

                {/* データ保護 */}
                <div className={ins.panel}>
                  <div className={ins.panelHead}>
                    <span className={ins.panelTitle}>
                      <span className={ins.panelIcon}>🔒</span>データの管理
                    </span>
                  </div>
                  <div className={ins.factorRow}>
                    <span>動画の保存期間</span>
                    <strong>{consent.video_retention_days}日で自動削除</strong>
                  </div>
                  <p className={ins.comment}>
                    保存期間を過ぎた動画は自動削除されます。データのエクスポート・削除請求は
                    いつでも可能です（開示請求対応）。
                  </p>
                  <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className={ins.btnGhost}
                      style={{
                        padding: "var(--space-2) var(--space-4)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "var(--text-sm)",
                        fontWeight: 600,
                        cursor: "pointer",
                        background: "transparent",
                      }}
                      onClick={() => alert("デモ: データのエクスポート要求を受け付けました。")}
                    >
                      データをエクスポート
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "var(--space-2) var(--space-4)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "var(--text-sm)",
                        fontWeight: 600,
                        cursor: "pointer",
                        background: "transparent",
                        border: "1px solid var(--color-danger)",
                        color: "var(--color-danger)",
                      }}
                      onClick={() =>
                        window.confirm("デモ: すべてのデータ削除を請求しますか？")
                      }
                    >
                      データ削除を請求
                    </button>
                  </div>
                </div>
              </div>
              <p className={ins.footnote}>
                ※ スコアはAIによる参考値です。評価の唯一の根拠として使用されるものではありません。
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
