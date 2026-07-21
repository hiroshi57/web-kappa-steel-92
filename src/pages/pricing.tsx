import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

import { listPlans, type Plan } from "@/lib/api";
import styles from "@/styles/dashboard.module.css";

const FEATURE_LABELS: Record<string, string> = {
  basic_score: "基本スコア・レーダー",
  score_history: "スコア履歴グラフ",
  compare: "複数選手の比較",
  report_export: "レポート出力(PDF/Excel)",
  growth_prediction: "成長予測(B#20)",
  saved_search_alert: "保存検索・新着アラート",
  watchlist: "ウォッチリスト",
  api_access: "API連携",
  sso: "SSO / SAML",
  priority_support: "優先サポート",
};

function priceLabel(p: Plan): string {
  if (p.monthly_price_jpy === null) return "個別見積";
  if (p.monthly_price_jpy === 0) return "¥0";
  return `¥${p.monthly_price_jpy.toLocaleString()}`;
}

function quotaLabel(v: number | null): string {
  return v === null ? "無制限" : String(v);
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.resolve().then(() =>
      listPlans().then(
        (list) => {
          setPlans(list);
          setLoading(false);
        },
        () => {
          setError("料金プランの取得に失敗しました");
          setLoading(false);
        }
      )
    );
  }, []);

  return (
    <>
      <Head>
        <title>料金プラン | sports-tech</title>
      </Head>
      <div className={styles.page}>
        <header className={styles.header}>
          <span className={styles.brand}>
            <span className={styles.brandMark}>⚽</span>
            sports-tech
          </span>
          <Link className={styles.link} href="/">
            ← トップに戻る
          </Link>
        </header>

        <div className={styles.container}>
          <h1 className={styles.pageTitle}>料金プラン</h1>
          <p className={styles.pageLead}>
            選手数と分析本数に応じたハイブリッド課金。無料で試して、必要に応じて拡張できます。
            Pro / Enterprise は請求書払い（B2B）に対応します。
          </p>

          {loading ? <p className={styles.loading}>読み込み中…</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "var(--space-4)",
              marginTop: "var(--space-4)",
            }}
          >
            {plans.map((p) => {
              const featured = p.tier === "pro";
              return (
                <div
                  key={p.tier}
                  className={styles.card}
                  style={{
                    alignItems: "stretch",
                    border: featured
                      ? "2px solid var(--color-primary)"
                      : "1px solid var(--color-border)",
                    position: "relative",
                  }}
                >
                  <div className={styles.cardBody} style={{ width: "100%" }}>
                    {featured ? (
                      <span
                        style={{
                          position: "absolute",
                          top: -12,
                          right: 16,
                          background: "var(--color-primary)",
                          color: "#fff",
                          borderRadius: "var(--radius-full)",
                          padding: "2px 12px",
                          fontSize: "var(--text-xs)",
                          fontWeight: 700,
                        }}
                      >
                        人気
                      </span>
                    ) : null}
                    <div className={styles.cardName} style={{ fontSize: "var(--text-lg)" }}>
                      {p.name}
                    </div>
                    <div style={{ margin: "var(--space-2) 0" }}>
                      <span style={{ fontSize: "var(--text-2xl)", fontWeight: 700 }}>
                        {priceLabel(p)}
                      </span>
                      {p.monthly_price_jpy && p.monthly_price_jpy > 0 ? (
                        <span style={{ color: "var(--color-text-muted)" }}> /月(税抜)</span>
                      ) : null}
                    </div>
                    <p className={styles.cardMeta} style={{ minHeight: 40 }}>
                      {p.description}
                    </p>

                    <ul style={{ listStyle: "none", padding: 0, margin: "var(--space-3) 0" }}>
                      <li style={{ padding: "2px 0" }}>👥 選手数: {quotaLabel(p.max_athletes)}</li>
                      <li style={{ padding: "2px 0" }}>
                        🎬 分析/月: {quotaLabel(p.monthly_analyses)}
                        {p.overage_price_jpy ? `（超過¥${p.overage_price_jpy}/本）` : ""}
                      </li>
                      <li style={{ padding: "2px 0" }}>
                        🧾 請求書払い: {p.invoice_payment ? "対応" : "―"}
                      </li>
                    </ul>

                    <div
                      style={{
                        borderTop: "1px solid var(--color-border)",
                        paddingTop: "var(--space-2)",
                        marginTop: "var(--space-2)",
                      }}
                    >
                      {p.features.map((f) => (
                        <div key={f} style={{ padding: "1px 0", fontSize: "var(--text-sm)" }}>
                          ✓ {FEATURE_LABELS[f] ?? f}
                        </div>
                      ))}
                    </div>

                    <Link
                      className={styles.cardSelect}
                      href={p.tier === "free" ? "/auth/login" : `/billing/checkout?tier=${p.tier}`}
                      style={{
                        display: "block",
                        textAlign: "center",
                        marginTop: "var(--space-3)",
                        background: featured ? "var(--color-primary)" : "transparent",
                        color: featured ? "#fff" : "var(--color-primary)",
                        border: `1px solid var(--color-primary)`,
                        borderRadius: "var(--radius-md)",
                        padding: "var(--space-2)",
                      }}
                    >
                      {p.tier === "free"
                        ? "無料で始める"
                        : p.tier === "enterprise"
                          ? "請求書払いで申し込む"
                          : "申し込む"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
