import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type CheckoutResult,
  getToken,
  listPlans,
  type Plan,
  requestInvoice,
  startCheckout,
} from "@/lib/api";
import styles from "@/styles/dashboard.module.css";
import bill from "@/styles/billing.module.css";

type Method = "card" | "invoice";

const FEATURE_LABELS: Record<string, string> = {
  basic_score: "基本スコア・レーダー",
  score_history: "スコア履歴グラフ",
  compare: "複数選手の比較",
  report_export: "レポート出力(PDF/Excel)",
  growth_prediction: "成長予測",
  saved_search_alert: "保存検索・新着アラート",
  watchlist: "ウォッチリスト",
  api_access: "API連携",
  sso: "SSO / SAML",
  priority_support: "優先サポート",
};

function priceText(p: Plan): string {
  if (p.monthly_price_jpy == null) return "個別見積";
  if (p.monthly_price_jpy === 0) return "¥0";
  return `¥${p.monthly_price_jpy.toLocaleString()}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const tierParam = typeof router.query.tier === "string" ? router.query.tier : "pro";

  const [plans, setPlans] = useState<Plan[]>([]);
  const [methodOverride, setMethodOverride] = useState<Method | null>(null);
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ method: Method; result?: CheckoutResult } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      void router.replace("/auth/login");
      return;
    }
    void Promise.resolve().then(() =>
      listPlans().then(setPlans, () => setError("プランの取得に失敗しました"))
    );
  }, [router]);

  const plan = useMemo(() => plans.find((p) => p.tier === tierParam), [plans, tierParam]);

  // カード決済可否（Enterprise は個別見積のため請求書のみ）
  const cardAvailable = plan ? plan.monthly_price_jpy != null && plan.monthly_price_jpy > 0 : false;
  const invoiceAvailable = plan ? plan.invoice_payment : false;

  // 支払い方法: ユーザー選択があればそれ、無ければプランに応じた既定値（派生）
  const method: Method = methodOverride ?? (cardAvailable ? "card" : "invoice");
  const setMethod = setMethodOverride;

  const submit = useCallback(() => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    if (method === "card") {
      void startCheckout(plan.tier)
        .then((result) => {
          if (result.checkout_url) {
            window.location.href = result.checkout_url; // 本番: Stripe へ遷移
          } else {
            setDone({ method: "card", result });
          }
        })
        .catch(() => setError("決済の開始に失敗しました"))
        .finally(() => setBusy(false));
    } else {
      if (!company.trim() || !email.trim()) {
        setError("会社名と担当者メールは必須です");
        setBusy(false);
        return;
      }
      void requestInvoice({
        tier: plan.tier,
        company_name: company.trim(),
        contact_email: email.trim(),
        note: note.trim() || undefined,
      })
        .then(() => setDone({ method: "invoice" }))
        .catch(() => setError("請求書払いの申込に失敗しました"))
        .finally(() => setBusy(false));
    }
  }, [plan, method, company, email, note]);

  const canSubmit =
    !busy &&
    plan != null &&
    (method === "card" ? cardAvailable : company.trim() !== "" && email.trim() !== "");

  return (
    <>
      <Head>
        <title>お申し込み | sports-tech</title>
      </Head>
      <div className={styles.page}>
        <header className={styles.header}>
          <span className={styles.brand}>
            <span className={styles.brandMark}>⚽</span>
            sports-tech
          </span>
          <Link className={styles.link} href="/pricing">
            ← 料金プランに戻る
          </Link>
        </header>

        <div className={styles.container}>
          {!plan ? (
            <p className={styles.loading}>{error ?? "読み込み中…"}</p>
          ) : done ? (
            <div className={bill.card}>
              <div className={bill.done}>
                <div className={bill.doneIcon}>✓</div>
                <div className={bill.doneTitle}>
                  {done.method === "invoice"
                    ? "請求書払いのお申し込みを受け付けました"
                    : "お申し込みが完了しました"}
                </div>
                <p className={bill.doneMsg}>
                  {done.method === "invoice" ? (
                    <>
                      <strong>{plan.name}</strong> プランを請求書払いで開始しました。
                      <br />
                      担当より <strong>{email || "ご登録のメール"}</strong>{" "}
                      宛に請求書と利用開始のご案内をお送りします（月末締め・翌月末払い）。
                    </>
                  ) : (
                    <>
                      <strong>{plan.name}</strong> プランを開始しました。
                      {done.result?.mode === "demo" ? (
                        <>
                          <br />
                          <span style={{ color: "var(--color-text-subtle)" }}>
                            ※ {done.result.message}
                          </span>
                        </>
                      ) : null}
                    </>
                  )}
                </p>
                <Link
                  className={bill.cta}
                  href="/billing"
                  style={{ display: "inline-block", width: "auto", padding: "12px 32px" }}
                >
                  契約状況を確認する
                </Link>
              </div>
            </div>
          ) : (
            <>
              <h1 className={styles.pageTitle}>お申し込み</h1>

              {/* ステッパー */}
              <div className={bill.stepper}>
                <span className={`${bill.step} ${bill.stepDone}`}>
                  <span className={bill.stepNum}>✓</span>プラン選択
                </span>
                <span className={bill.stepBar} />
                <span className={`${bill.step} ${bill.stepActive}`}>
                  <span className={bill.stepNum}>2</span>お支払い方法
                </span>
                <span className={bill.stepBar} />
                <span className={bill.step}>
                  <span className={bill.stepNum}>3</span>完了
                </span>
              </div>

              <div className={bill.layout}>
                {/* 本体: 支払い方法 */}
                <div>
                  <div className={bill.card}>
                    <div className={bill.sectionTitle}>お支払い方法を選択</div>
                    {error ? <p className={styles.error}>{error}</p> : null}
                    <div className={bill.methods}>
                      {/* カード */}
                      <div
                        className={`${bill.method} ${method === "card" ? bill.methodActive : ""} ${
                          !cardAvailable ? bill.methodDisabled : ""
                        }`}
                        onClick={() => cardAvailable && setMethod("card")}
                        role="button"
                        tabIndex={0}
                      >
                        <span className={bill.radio} />
                        <div className={bill.methodBody}>
                          <div className={bill.methodTitle}>💳 クレジットカード決済</div>
                          <div className={bill.methodDesc}>
                            {cardAvailable
                              ? "毎月自動で課金されます。すぐに利用開始できます。"
                              : "このプランはカード決済の対象外です（個別見積）。"}
                          </div>
                        </div>
                      </div>

                      {/* 請求書払い */}
                      <div
                        className={`${bill.method} ${
                          method === "invoice" ? bill.methodActive : ""
                        } ${!invoiceAvailable ? bill.methodDisabled : ""}`}
                        onClick={() => invoiceAvailable && setMethod("invoice")}
                        role="button"
                        tabIndex={0}
                      >
                        <span className={bill.radio} />
                        <div className={bill.methodBody}>
                          <div className={bill.methodTitle}>
                            🧾 請求書払い（銀行振込）
                            <span className={bill.methodTag}>B2B</span>
                          </div>
                          <div className={bill.methodDesc}>
                            {invoiceAvailable
                              ? "月末締め・翌月末払い。クラブ・協会・自治体の経理フローに対応。"
                              : "このプランは請求書払いの対象外です。"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 請求書払いフォーム */}
                  {method === "invoice" ? (
                    <div className={bill.card}>
                      <div className={bill.sectionTitle}>請求先情報</div>
                      <div className={bill.field}>
                        <label className={bill.label} htmlFor="company">
                          会社・団体名<span className={bill.req}>*</span>
                        </label>
                        <input
                          id="company"
                          className={bill.input}
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="例: ○○フットボールクラブ"
                        />
                      </div>
                      <div className={bill.field}>
                        <label className={bill.label} htmlFor="email">
                          担当者メールアドレス<span className={bill.req}>*</span>
                        </label>
                        <input
                          id="email"
                          type="email"
                          className={bill.input}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="keiri@example.com"
                        />
                        <p className={bill.hint}>請求書と利用開始のご案内をお送りします。</p>
                      </div>
                      <div className={bill.field}>
                        <label className={bill.label} htmlFor="note">
                          備考（任意）
                        </label>
                        <textarea
                          id="note"
                          className={bill.textarea}
                          rows={3}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="発注書番号・請求書の宛名・支払サイトのご指定など"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* サイド: 注文サマリー */}
                <aside className={bill.summary}>
                  <div className={bill.summaryPlan}>{plan.name} プラン</div>
                  <div className={bill.summaryPrice}>
                    {priceText(plan)}
                    {plan.monthly_price_jpy ? <small> /月(税抜)</small> : null}
                  </div>
                  <ul className={bill.summaryList}>
                    <li>
                      <span>選手数</span>
                      <strong>{plan.max_athletes == null ? "無制限" : `${plan.max_athletes}人`}</strong>
                    </li>
                    <li>
                      <span>分析/月</span>
                      <strong>
                        {plan.monthly_analyses == null ? "無制限" : `${plan.monthly_analyses}本`}
                      </strong>
                    </li>
                    {plan.overage_price_jpy ? (
                      <li>
                        <span>超過単価</span>
                        <strong>¥{plan.overage_price_jpy}/本</strong>
                      </li>
                    ) : null}
                    <li>
                      <span>お支払い</span>
                      <strong>{method === "card" ? "カード決済" : "請求書払い"}</strong>
                    </li>
                  </ul>
                  <div style={{ marginBottom: "var(--space-3)" }}>
                    {plan.features.map((f) => (
                      <div
                        key={f}
                        style={{ fontSize: "var(--text-sm)", padding: "1px 0" }}
                      >
                        ✓ {FEATURE_LABELS[f] ?? f}
                      </div>
                    ))}
                  </div>
                  <button className={bill.cta} onClick={submit} disabled={!canSubmit}>
                    {busy
                      ? "処理中…"
                      : method === "card"
                        ? "決済して開始する"
                        : "請求書払いで申し込む"}
                  </button>
                  <p className={bill.ctaNote}>
                    お申し込みで
                    <Link className={styles.link} href="/pricing">
                      利用規約
                    </Link>
                    に同意したものとみなされます。いつでも変更・解約できます。
                  </p>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
