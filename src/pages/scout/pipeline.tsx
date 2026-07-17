import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type Contact,
  CONTACT_STAGES,
  type ContactStage,
  deleteContact,
  getToken,
  listContacts,
  updateContact,
} from "@/lib/api";
import styles from "@/styles/dashboard.module.css";
import ins from "@/styles/insights.module.css";

const STAGE_COLOR: Record<ContactStage, string> = {
  interested: "#6b7280",
  contacted: "#2563eb",
  trial: "#0ea5a4",
  offer: "#d97706",
  signed: "#16a34a",
  dropped: "#9ca3af",
};

export default function PipelinePage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    return listContacts().then(
      (list) => {
        setContacts(list);
        setError(null);
        setLoading(false);
      },
      () => {
        setError("パイプラインの取得に失敗しました");
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    if (!getToken()) {
      void router.replace("/auth/login");
      return;
    }
    void Promise.resolve().then(() => load());
  }, [router, load]);

  const byStage = useMemo(() => {
    const map: Record<ContactStage, Contact[]> = {
      interested: [],
      contacted: [],
      trial: [],
      offer: [],
      signed: [],
      dropped: [],
    };
    for (const c of contacts) map[c.stage]?.push(c);
    return map;
  }, [contacts]);

  const move = (c: Contact, dir: -1 | 1) => {
    const order = CONTACT_STAGES.map((s) => s.value);
    const idx = order.indexOf(c.stage);
    const next = order[idx + dir];
    if (!next) return;
    // 楽観的更新
    setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, stage: next } : x)));
    void updateContact(c.id, { stage: next }).catch(() => load());
  };

  const remove = (c: Contact) => {
    setContacts((prev) => prev.filter((x) => x.id !== c.id));
    void deleteContact(c.id).catch(() => load());
  };

  const total = contacts.length;
  const activeCount = contacts.filter(
    (c) => c.stage !== "signed" && c.stage !== "dropped"
  ).length;

  return (
    <>
      <Head>
        <title>商談パイプライン | sports-tech スカウト</title>
      </Head>
      <div className={styles.page}>
        <header className={styles.header}>
          <span className={styles.brand}>
            <span className={styles.brandMark}>⚽</span>
            sports-tech スカウト
          </span>
          <span style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
            <Link className={styles.link} href="/scout/watchlist">
              ウォッチリスト
            </Link>
            <Link className={styles.link} href="/scout/search">
              ← 検索に戻る
            </Link>
          </span>
        </header>

        <div className={styles.container}>
          <h1 className={styles.pageTitle}>商談パイプライン</h1>
          <p className={styles.pageLead}>
            注目 → 接触 → 練習参加 → オファー → 獲得の各段階で選手を管理します。
            カード下の矢印でステージを移動できます。
          </p>

          {loading ? <p className={styles.loading}>読み込み中…</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}

          {!loading && !error ? (
            <>
              {/* ファネル サマリー */}
              <div className={ins.funnel}>
                <div className={ins.funnelCell}>
                  <div className={ins.funnelCount}>{total}</div>
                  <div className={ins.funnelLabel}>登録件数</div>
                </div>
                <div className={ins.funnelCell}>
                  <div className={ins.funnelCount}>{activeCount}</div>
                  <div className={ins.funnelLabel}>進行中（獲得/見送りを除く）</div>
                </div>
                {CONTACT_STAGES.map((s) => (
                  <div key={s.value} className={ins.funnelCell}>
                    <div className={ins.funnelCount}>{byStage[s.value].length}</div>
                    <div className={ins.funnelLabel}>
                      <span
                        className={ins.stageDot}
                        style={{ background: STAGE_COLOR[s.value] }}
                      />
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* カンバン */}
              <div className={ins.board}>
                {CONTACT_STAGES.map((s, si) => {
                  const cards = byStage[s.value];
                  return (
                    <div
                      key={s.value}
                      className={ins.column}
                      style={{ ["--stage-color" as string]: STAGE_COLOR[s.value] }}
                    >
                      <div className={ins.columnHead}>
                        <span className={ins.columnTitle}>
                          <span
                            className={ins.stageDot}
                            style={{ background: STAGE_COLOR[s.value] }}
                          />
                          {s.label}
                        </span>
                        <span className={ins.columnCount}>{cards.length}</span>
                      </div>
                      <div className={ins.cards}>
                        {cards.length === 0 ? (
                          <div className={ins.emptyCol}>—</div>
                        ) : (
                          cards.map((c) => (
                            <div key={c.id} className={ins.dealCard}>
                              <div className={ins.dealTop}>
                                <span style={{ minWidth: 0 }}>
                                  <Link
                                    className={ins.dealName}
                                    href={`/scout/athletes/${c.athlete_profile_id}`}
                                  >
                                    {c.athlete_name ?? "選手"}
                                  </Link>
                                  <div className={ins.dealMeta}>
                                    {[c.athlete_position].filter(Boolean).join(" ") || "—"}
                                  </div>
                                </span>
                                {c.athlete_total_score != null ? (
                                  <span className={ins.dealScore}>{c.athlete_total_score}</span>
                                ) : null}
                              </div>
                              {c.note ? <div className={ins.dealNote}>{c.note}</div> : null}
                              <div className={ins.dealActions}>
                                <button
                                  type="button"
                                  className={ins.moveBtn}
                                  onClick={() => move(c, -1)}
                                  disabled={si === 0}
                                  aria-label="前のステージへ"
                                  title="前のステージへ"
                                >
                                  ◀
                                </button>
                                <button
                                  type="button"
                                  className={ins.moveBtn}
                                  onClick={() => move(c, 1)}
                                  disabled={si === CONTACT_STAGES.length - 1}
                                  aria-label="次のステージへ"
                                  title="次のステージへ"
                                >
                                  ▶
                                </button>
                                <button
                                  type="button"
                                  className={ins.delBtn}
                                  onClick={() => remove(c)}
                                >
                                  削除
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {total === 0 ? (
                <p className={styles.empty} style={{ marginTop: "var(--space-5)" }}>
                  まだ商談がありません。選手詳細ページの「商談に追加」から登録できます。
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
