import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";

import { getToken } from "@/lib/api";
import styles from "@/styles/dashboard.module.css";
import ins from "@/styles/insights.module.css";

const STEPS = [
  {
    icon: "🔍",
    title: "選手を検索する",
    desc: "ポジション・地域・スコアで公開選手を横断検索。まずは条件を入れて探してみましょう。",
    href: "/scout/search",
    cta: "検索をはじめる",
  },
  {
    icon: "⭐",
    title: "気になる選手をウォッチ",
    desc: "有望な選手はウォッチリストに保存。タグ・メモで整理できます。",
    href: "/scout/watchlist",
    cta: "ウォッチリストを見る",
  },
  {
    icon: "🔔",
    title: "検索条件を保存してアラート",
    desc: "条件を保存すると、新しく合致した選手を「新着」で受け取れます。",
    href: "/scout/saved",
    cta: "保存条件を見る",
  },
  {
    icon: "📋",
    title: "商談パイプラインで管理",
    desc: "接触〜獲得までをカンバンで管理。チームで所見を共有できます。",
    href: "/scout/pipeline",
    cta: "パイプラインを見る",
  },
  {
    icon: "💳",
    title: "プランを選ぶ",
    desc: "無料枠で試して、必要に応じてアップグレード。請求書払い（B2B）にも対応。",
    href: "/pricing",
    cta: "料金プランを見る",
  },
] as const;

export default function ScoutOnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      void router.replace("/auth/login");
    }
  }, [router]);

  return (
    <>
      <Head>
        <title>はじめかた | sports-tech スカウト</title>
      </Head>
      <div className={styles.page}>
        <header className={styles.header}>
          <span className={styles.brand}>
            <span className={styles.brandMark}>⚽</span>
            sports-tech スカウト
          </span>
          <Link className={styles.link} href="/scout/search">
            ダッシュボードへ →
          </Link>
        </header>

        <div className={styles.container}>
          <h1 className={styles.pageTitle}>ようこそ！はじめかた</h1>
          <p className={styles.pageLead}>
            5つのステップで、才能の発掘から商談管理までを体験できます。
            上から順に進めるのがおすすめです。
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className={ins.panel}
                style={{ flexDirection: "row", alignItems: "center", gap: "var(--space-4)" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 48,
                    height: 48,
                    borderRadius: "var(--radius-full)",
                    background: "var(--color-accent-050)",
                    fontSize: 24,
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "var(--text-xs)",
                      color: "var(--color-text-subtle)",
                      fontWeight: 700,
                    }}
                  >
                    STEP {i + 1}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--text-lg)",
                      fontWeight: 700,
                      color: "var(--color-primary)",
                    }}
                  >
                    {s.title}
                  </div>
                  <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                    {s.desc}
                  </div>
                </div>
                <Link
                  href={s.href}
                  className={ins.btn}
                  style={{
                    whiteSpace: "nowrap",
                    padding: "var(--space-2) var(--space-4)",
                    borderRadius: "var(--radius-sm)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {s.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
