import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

import { getSubscription, getToken, resetSubscriptionDemo, type Subscription } from "@/lib/api";
import styles from "@/styles/dashboard.module.css";
import bill from "@/styles/billing.module.css";

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: "利用中", bg: "var(--color-success-bg)", color: "var(--color-success)" },
  trialing: {
    label: "利用開始（請求準備中）",
    bg: "var(--color-accent-050)",
    color: "var(--color-accent-600)",
  },
  past_due: { label: "支払い遅延", bg: "var(--color-danger-bg)", color: "var(--color-danger)" },
  canceled: { label: "解約済み", bg: "var(--color-surface-2)", color: "var(--color-text-muted)" },
};

export default function BillingPage() {
  const router = useRouter();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const applied = router.query.applied === "1";

  const load = useCallback(() => {
    return getSubscription().then(setSub, () => setError("契約状況の取得に失敗しました"));
  }, []);

  useEffect(() => {
    if (!getToken()) {
      void router.replace("/auth/login");
      return;
    }
    void Promise.resolve().then(() => load());
  }, [router, load]);

  const usagePct =
    sub && sub.monthly_analyses
      ? Math.min(100, Math.round((sub.analyses_used / sub.monthly_analyses) * 100))
      : 0;
  const usageColor =
    usagePct >= 90 ? "var(--color-danger)" : usagePct >= 70 ? "var(--color-warning)" : "var(--color-accent)";

  const status = sub ? (STATUS_STYLE[sub.status] ?? STATUS_STYLE.active) : null;

  const handleReset = () => {
    void resetSubscriptionDemo().then(setSub);
  };

  return (
    <>
      <Head>
        <title>契約状況 | sports-tech</title>
      </Head>
      <div className={styles.page}>
        <header className={styles.header}>
          <span className={styles.brand}>
            <span className={styles.brandMark}>⚽</span>
            sports-tech
          </span>
          <span style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
            <Link className={styles.link} href="/pricing">
              料金プラン
            </Link>
            <Link className={styles.link} href="/scout/search">
              ダッシュボード
            </Link>
          </span>
        </header>

        <div className={styles.container}>
          <h1 className={styles.pageTitle}>契約状況</h1>
          {applied ? (
            <p
              style={{
                background: "var(--color-success-bg)",
                color: "var(--color-success)",
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-md)",
                marginBottom: "var(--space-4)",
                fontWeight: 600,
              }}
            >
              ✓ お申し込みが反映されました。
            </p>
          ) : null}
          {error ? <p className={styles.error}>{error}</p> : null}

          {sub ? (
            <>
              {/* 現在のプラン */}
              <div className={bill.card}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                      現在のプラン
                    </div>
                    <div className={bill.summaryPlan}>{sub.plan_name}</div>
                  </div>
                  {status ? (
                    <span
                      className={bill.statusPill}
                      style={{ background: status.bg, color: status.color }}
                    >
                      ● {status.label}
                    </span>
                  ) : null}
                </div>
                <div style={{ marginTop: "var(--space-2)", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
                  お支払い方法: {sub.billing_type === "invoice" ? "請求書払い（銀行振込）" : "クレジットカード"}
                </div>
              </div>

              {/* 利用状況 */}
              <div className={bill.card}>
                <div className={bill.sectionTitle}>今月の利用状況</div>
                <div className={bill.subGrid}>
                  <div className={bill.subStat}>
                    <div className={bill.subStatVal}>{sub.analyses_used}</div>
                    <div className={bill.subStatLabel}>分析実行数（今月）</div>
                  </div>
                  <div className={bill.subStat}>
                    <div className={bill.subStatVal}>
                      {sub.monthly_analyses == null ? "無制限" : sub.monthly_analyses}
                    </div>
                    <div className={bill.subStatLabel}>月間の基本枠</div>
                  </div>
                  <div className={bill.subStat}>
                    <div className={bill.subStatVal}>
                      {sub.analyses_remaining == null ? "—" : sub.analyses_remaining}
                    </div>
                    <div className={bill.subStatLabel}>残り枠</div>
                  </div>
                  <div className={bill.subStat}>
                    <div className={bill.subStatVal}>
                      {sub.max_athletes == null ? "無制限" : sub.max_athletes}
                    </div>
                    <div className={bill.subStatLabel}>選手登録上限</div>
                  </div>
                </div>
                {sub.monthly_analyses != null ? (
                  <>
                    <div className={bill.usageTrack}>
                      <div
                        className={bill.usageFill}
                        style={{ width: `${usagePct}%`, background: usageColor }}
                      />
                    </div>
                    <p className={bill.hint} style={{ marginTop: "var(--space-2)" }}>
                      基本枠の {usagePct}% を使用
                      {usagePct >= 90 ? "。枠の超過が近づいています。" : ""}
                    </p>
                  </>
                ) : (
                  <p className={bill.hint}>無制限プランのため枠の制限はありません。</p>
                )}
              </div>

              {/* プラン変更 */}
              <div className={bill.card}>
                <div className={bill.sectionTitle}>プランの変更</div>
                <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-4)" }}>
                  より多くの選手・分析枠が必要な場合はアップグレードできます。
                </p>
                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <Link
                    href="/pricing"
                    className={bill.cta}
                    style={{ width: "auto", padding: "12px 28px", textDecoration: "none" }}
                  >
                    プランを比較・変更
                  </Link>
                  <button
                    type="button"
                    onClick={handleReset}
                    style={{
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      color: "var(--color-text-muted)",
                      borderRadius: "var(--radius-md)",
                      padding: "12px 20px",
                      cursor: "pointer",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    （デモ）Freeに戻す
                  </button>
                </div>
              </div>
            </>
          ) : !error ? (
            <p className={styles.loading}>読み込み中…</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
