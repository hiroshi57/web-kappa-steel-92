import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

import FatigueCurveChart from "@/components/FatigueCurveChart";
import PitchHeatmap from "@/components/PitchHeatmap";
import RadarChart, { type RadarAxis } from "@/components/RadarChart";
import ScoreHistoryChart from "@/components/ScoreHistoryChart";
import ScoreRing from "@/components/ScoreRing";
import StatBars from "@/components/StatBars";
import {
  ApiError,
  type AthleteNote,
  type AthleteScores,
  type Contact,
  createClip,
  createContact,
  createNote,
  type DeepAnalysis,
  deleteClip,
  deleteNote,
  demoVideoIdFor,
  getAthleteScores,
  getDeepAnalysis,
  getMarketValue,
  getSimilarAthletes,
  getToken,
  listClips,
  listContacts,
  listNotes,
  type MarketValue,
  type SimilarAthlete,
  updateContact,
  type VideoClip,
} from "@/lib/api";
import styles from "@/styles/dashboard.module.css";
import ins from "@/styles/insights.module.css";

const METRICS = [
  { key: "sprint_score", label: "スプリント" },
  { key: "ball_control_score", label: "ボールコントロール" },
  { key: "positioning_score", label: "ポジショニング" },
  { key: "body_usage_score", label: "身体の使い方" },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

/** 万円表記（¥1,200万 のように） */
function manYen(jpy: number): string {
  return `¥${(jpy / 10000).toLocaleString()}万`;
}

function ratingLabel(v: number): { text: string; color: string } {
  if (v >= 85) return { text: "S 非常に優秀", color: "var(--color-success)" };
  if (v >= 75) return { text: "A 優秀", color: "var(--color-success)" };
  if (v >= 60) return { text: "B 平均以上", color: "var(--color-accent)" };
  if (v >= 45) return { text: "C 平均的", color: "var(--color-warning)" };
  return { text: "D 要改善", color: "var(--color-danger)" };
}

export default function AthleteDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<AthleteScores | null>(null);
  const [deep, setDeep] = useState<DeepAnalysis | null>(null);
  const [similar, setSimilar] = useState<SimilarAthlete[]>([]);
  const [market, setMarket] = useState<MarketValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // スカウト業務（商談・ノート・クリップ）
  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState<AthleteNote[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [clipTitle, setClipTitle] = useState("");
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (athleteId: string) => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAthleteScores(athleteId));
      // 深掘り分析・類似選手・市場価値・業務データは失敗しても本体表示を妨げない
      void getDeepAnalysis(athleteId).then(setDeep, () => undefined);
      void getSimilarAthletes(athleteId).then(setSimilar, () => undefined);
      void getMarketValue(athleteId).then(setMarket, () => undefined);
      void listNotes(athleteId).then(setNotes, () => undefined);
      void listClips(demoVideoIdFor(athleteId)).then(setClips, () => undefined);
      void listContacts().then(
        (list) => setContact(list.find((c) => c.athlete_profile_id === athleteId) ?? null),
        () => undefined
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("選手が見つかりませんでした（非公開の可能性があります）。");
      } else {
        setError(err instanceof ApiError ? err.detail : "取得に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      void router.replace("/auth/login");
      return;
    }
    if (typeof id === "string") {
      const athleteId = id;
      void Promise.resolve().then(() => load(athleteId));
    }
  }, [id, router, load]);

  const axes: RadarAxis[] = data?.latest
    ? METRICS.map((m) => ({ label: m.label.slice(0, 4), value: data.latest![m.key] }))
    : [];

  // 強み・課題の自動抽出
  const insights = useMemo(() => {
    if (!data?.latest) return null;
    const scored = METRICS.map((m) => ({ label: m.label, value: data.latest![m.key] }));
    const sorted = [...scored].sort((a, b) => b.value - a.value);
    return { strength: sorted[0], weakness: sorted[sorted.length - 1] };
  }, [data]);

  // 成長（初回→最新の総合スコア差）
  const growth = useMemo(() => {
    if (!data || data.history.length < 2) return null;
    const first = data.history[0].total_score;
    const last = data.history[data.history.length - 1].total_score;
    return Math.round((last - first) * 10) / 10;
  }, [data]);

  // ── スカウト業務ハンドラ ──
  const athleteId = typeof id === "string" ? id : "";

  const handleAddToPipeline = () => {
    if (!athleteId || contact) return;
    setBusy(true);
    void createContact({ athlete_profile_id: athleteId, stage: "interested" })
      .then((c) => setContact(c))
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  const handleAdvanceStage = () => {
    if (!contact) return;
    const order = ["interested", "contacted", "trial", "offer", "signed"] as const;
    const idx = order.indexOf(contact.stage as (typeof order)[number]);
    const next = order[idx + 1];
    if (!next) return;
    setBusy(true);
    void updateContact(contact.id, { stage: next })
      .then((c) => setContact(c))
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  const handleAddNote = () => {
    const body = noteInput.trim();
    if (!athleteId || !body) return;
    setBusy(true);
    void createNote(athleteId, body)
      .then((n) => {
        setNotes((prev) => [n, ...prev]);
        setNoteInput("");
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    void deleteNote(noteId).catch(() => undefined);
  };

  const handleAddClip = () => {
    const start = Number(clipStart);
    const end = Number(clipEnd);
    const title = clipTitle.trim();
    if (!athleteId || !title || !(end > start) || start < 0) return;
    setBusy(true);
    void createClip(demoVideoIdFor(athleteId), { title, start_sec: start, end_sec: end })
      .then((c) => {
        setClips((prev) => [...prev, c].sort((a, b) => a.start_sec - b.start_sec));
        setClipTitle("");
        setClipStart("");
        setClipEnd("");
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  const handleDeleteClip = (clipId: string) => {
    setClips((prev) => prev.filter((c) => c.id !== clipId));
    void deleteClip(clipId).catch(() => undefined);
  };

  const stageLabel: Record<string, string> = {
    interested: "注目",
    contacted: "接触済み",
    trial: "練習参加",
    offer: "オファー",
    signed: "獲得",
    dropped: "見送り",
  };
  const fmtClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <>
      <Head>
        <title>{data ? `${data.name} | ` : ""}選手分析 | sports-tech スカウト</title>
      </Head>
      <div className={styles.page}>
        <header className={styles.header}>
          <span className={styles.brand}>
            <span className={styles.brandMark}>⚽</span>
            sports-tech スカウト
          </span>
          <span style={{ display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
            <Link className={styles.link} href="/scout/pipeline">
              商談パイプライン
            </Link>
            {typeof id === "string" ? (
              <Link className={styles.link} href={`/scout/athletes/${id}/report`}>
                🖨 レポート出力
              </Link>
            ) : null}
            <Link className={styles.link} href="/scout/search">
              ← 検索に戻る
            </Link>
          </span>
        </header>

        <div className={styles.container}>
          {loading ? <p className={styles.loading}>読み込み中…</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}

          {data ? (
            <>
              {/* ── ヘッダー ── */}
              <div className={styles.detailHead}>
                {data.latest ? (
                  <div className={styles.bigRing}>
                    <ScoreRing value={data.latest.total_score} size={96} stroke={7} />
                    <div className={styles.bigRingValue}>
                      <span className={styles.bigRingNum}>{data.latest.total_score}</span>
                      <span className={styles.bigRingLabel}>参考値</span>
                    </div>
                  </div>
                ) : (
                  <div className={styles.ringEmpty} style={{ width: 96, height: 96 }}>
                    分析なし
                  </div>
                )}
                <div>
                  <h1 className={styles.detailName}>{data.name}</h1>
                  <p className={styles.detailMeta}>
                    {[data.position, data.sport, data.location].filter(Boolean).join(" ・ ")}
                  </p>
                  <p className={styles.detailMeta}>
                    {[
                      data.height_cm ? `身長 ${data.height_cm}cm` : null,
                      data.weight_kg ? `体重 ${data.weight_kg}kg` : null,
                      data.bmi ? `BMI ${data.bmi}` : null,
                    ]
                      .filter(Boolean)
                      .join(" ・ ") || "身体データ未登録"}
                  </p>
                </div>
              </div>

              {data.latest ? (
                <>
                  {/* ── KPI アナリティクス ── */}
                  <div className={styles.analyticsGrid}>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiValue}>
                        {data.percentile != null ? `上位${100 - data.percentile}` : "—"}
                        {data.percentile != null ? <span className={styles.kpiUnit}>%</span> : null}
                      </div>
                      <div className={styles.kpiLabel}>同ポジション内の順位</div>
                      {data.benchmark ? (
                        <div
                          className={styles.kpiSub}
                          style={{ color: "var(--color-text-subtle)" }}
                        >
                          {data.benchmark.sample_size}人中
                        </div>
                      ) : null}
                    </div>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiValue}>
                        {data.benchmark ? data.benchmark.total_score : "—"}
                      </div>
                      <div className={styles.kpiLabel}>同ポジション平均</div>
                      {data.benchmark ? (
                        <div
                          className={`${styles.kpiSub} ${
                            data.latest.total_score >= data.benchmark.total_score
                              ? styles.deltaPos
                              : styles.deltaNeg
                          }`}
                        >
                          {data.latest.total_score >= data.benchmark.total_score ? "+" : ""}
                          {Math.round((data.latest.total_score - data.benchmark.total_score) * 10) /
                            10}{" "}
                          差
                        </div>
                      ) : null}
                    </div>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiValue}>{data.consistency ?? "—"}</div>
                      <div className={styles.kpiLabel}>安定性スコア</div>
                      <div className={styles.kpiSub} style={{ color: "var(--color-text-subtle)" }}>
                        高いほど好調が持続
                      </div>
                    </div>
                    <div className={styles.kpiCard}>
                      <div
                        className={`${styles.kpiValue} ${
                          growth != null && growth >= 0 ? styles.deltaPos : styles.deltaNeg
                        }`}
                      >
                        {growth != null ? `${growth >= 0 ? "+" : ""}${growth}` : "—"}
                      </div>
                      <div className={styles.kpiLabel}>成長（初回→最新）</div>
                    </div>
                  </div>

                  {/* ── 強み・課題 ── */}
                  {insights ? (
                    <div className={styles.insightRow} style={{ marginBottom: "var(--space-6)" }}>
                      <div className={`${styles.insightCard} ${styles.insightStrength}`}>
                        <div
                          className={styles.insightLabel}
                          style={{ color: "var(--color-success)" }}
                        >
                          💪 最大の強み
                        </div>
                        <div className={styles.insightMain}>{insights.strength.label}</div>
                        <div className={styles.insightSub}>
                          {insights.strength.value} 点 ・{" "}
                          {ratingLabel(insights.strength.value).text}
                        </div>
                      </div>
                      <div className={`${styles.insightCard} ${styles.insightWeak}`}>
                        <div
                          className={styles.insightLabel}
                          style={{ color: "var(--color-warning)" }}
                        >
                          🎯 伸びしろ
                        </div>
                        <div className={styles.insightMain}>{insights.weakness.label}</div>
                        <div className={styles.insightSub}>
                          {insights.weakness.value} 点 ・{" "}
                          {ratingLabel(insights.weakness.value).text}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* ── 項目別スコア（平均比較） ── */}
                  <section className={styles.section}>
                    <h2 className={styles.subheading}>項目別スコア（同ポジション平均との比較）</h2>
                    <div
                      className={styles.chartWrap}
                      style={{ display: "block", padding: "var(--space-5)" }}
                    >
                      {METRICS.map((m) => {
                        const v = data.latest![m.key as MetricKey];
                        const avg = data.benchmark
                          ? (data.benchmark[m.key as keyof typeof data.benchmark] as number)
                          : null;
                        const delta = avg != null ? Math.round((v - avg) * 10) / 10 : null;
                        const rating = ratingLabel(v);
                        return (
                          <div key={m.key} className={styles.metricRow}>
                            <div className={styles.metricHead}>
                              <span className={styles.metricName}>{m.label}</span>
                              <span>
                                <span
                                  className={styles.metricValue}
                                  style={{ color: rating.color }}
                                >
                                  {v}
                                </span>
                                {delta != null ? (
                                  <span
                                    className={`${styles.metricDelta} ${
                                      delta >= 0 ? styles.deltaPos : styles.deltaNeg
                                    }`}
                                  >
                                    ({delta >= 0 ? "+" : ""}
                                    {delta})
                                  </span>
                                ) : null}
                              </span>
                            </div>
                            <div className={styles.metricBarTrack}>
                              <div
                                className={styles.metricBarFill}
                                style={{ width: `${Math.min(100, v)}%`, background: rating.color }}
                              />
                              {avg != null ? (
                                <div
                                  className={styles.metricAvgMark}
                                  style={{ left: `${Math.min(100, avg)}%` }}
                                  title={`平均 ${avg}`}
                                />
                              ) : null}
                            </div>
                            <div className={styles.metricLegend}>
                              評価: {rating.text}
                              {avg != null ? ` ・ 平均 ${avg}（縦線）` : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* ── 多面評価（技術/フィジカル/メンタル/健康） ── */}
                  {data.abilities && data.abilities.length > 0 ? (
                    <section className={styles.section}>
                      <h2 className={styles.subheading}>詳細能力評価（14項目）</h2>
                      <div className={styles.catGrid}>
                        {(["技術", "フィジカル", "メンタル", "健康"] as const).map((cat) => {
                          const items = data.abilities!.filter((x) => x.category === cat);
                          if (items.length === 0) return null;
                          return (
                            <div key={cat} className={styles.catCard}>
                              <div className={styles.catTitle}>{cat}</div>
                              {items.map((ab) => {
                                const r = ratingLabel(ab.value);
                                return (
                                  <div key={ab.name} className={styles.abilityRow}>
                                    <div className={styles.abilityHead}>
                                      <span className={styles.abilityName}>{ab.name}</span>
                                      <span
                                        className={styles.abilityVal}
                                        style={{ color: r.color }}
                                      >
                                        {ab.value}
                                      </span>
                                    </div>
                                    <div className={styles.metricBarTrack}>
                                      <div
                                        className={styles.metricBarFill}
                                        style={{
                                          width: `${Math.min(100, ab.value)}%`,
                                          background: r.color,
                                        }}
                                      />
                                      {ab.avg != null ? (
                                        <div
                                          className={styles.metricAvgMark}
                                          style={{ left: `${Math.min(100, ab.avg)}%` }}
                                          title={`平均 ${ab.avg}`}
                                        />
                                      ) : null}
                                    </div>
                                    {ab.note ? (
                                      <div className={styles.abilityNote}>{ab.note}</div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {/* ── 能力バランス ── */}
                  <section className={styles.section}>
                    <h2 className={styles.subheading}>能力バランス</h2>
                    <div className={styles.chartWrap}>
                      <RadarChart axes={axes} />
                    </div>
                  </section>

                  {/* ── フィジカル推移・食事・予測・健康・海外適性 ── */}
                  <section className={styles.section}>
                    <h2 className={styles.subheading}>フィジカル推移・コンディション・将来予測</h2>
                    <div className={styles.infoGrid}>
                      {/* 身体データ推移 */}
                      {data.physical_history && data.physical_history.length > 0 ? (
                        <div className={styles.infoCard} style={{ gridColumn: "1 / -1" }}>
                          <div className={styles.infoTitle}>📏 身体データの推移</div>
                          <table className={styles.histTable}>
                            <thead>
                              <tr>
                                <th>時期</th>
                                <th>身長(cm)</th>
                                <th>体重(kg)</th>
                                <th>体脂肪(%)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.physical_history.map((p) => (
                                <tr key={p.date}>
                                  <td>{p.date}</td>
                                  <td>{p.height_cm}</td>
                                  <td>{p.weight_kg}</td>
                                  <td>{p.body_fat_pct}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}

                      {/* 食事・栄養 */}
                      {data.nutrition ? (
                        <div className={styles.infoCard}>
                          <div className={styles.infoTitle}>🍽 食事・栄養</div>
                          <div className={styles.infoStat}>
                            <span>平均摂取カロリー</span>
                            <span className={styles.infoStatVal}>
                              {data.nutrition.avg_calories} kcal
                            </span>
                          </div>
                          <div className={styles.infoStat}>
                            <span>たんぱく質</span>
                            <span className={styles.infoStatVal}>
                              {data.nutrition.protein_g} g/日
                            </span>
                          </div>
                          <div className={styles.infoStat}>
                            <span>食事充足度</span>
                            <span className={styles.infoStatVal}>
                              {data.nutrition.adequacy} / 100
                            </span>
                          </div>
                          <div className={styles.infoNote}>{data.nutrition.note}</div>
                        </div>
                      ) : null}

                      {/* 将来予測 */}
                      {data.prediction ? (
                        <div className={styles.infoCard}>
                          <div className={styles.infoTitle}>
                            📈 将来予測（{data.prediction.horizon}）
                          </div>
                          <div className={styles.infoStat}>
                            <span>予測総合スコア</span>
                            <span className={styles.infoStatVal}>
                              {data.prediction.projected_total}
                            </span>
                          </div>
                          <div className={styles.infoStat}>
                            <span>予測身長 / 体重</span>
                            <span className={styles.infoStatVal}>
                              {data.prediction.projected_height_cm}cm /{" "}
                              {data.prediction.projected_weight_kg}kg
                            </span>
                          </div>
                          <div className={styles.infoStat}>
                            <span>ポテンシャル（伸びしろ）</span>
                            <span className={styles.infoStatVal}>
                              {data.prediction.potential} / 100
                            </span>
                          </div>
                          <div className={styles.infoNote}>{data.prediction.comment}</div>
                        </div>
                      ) : null}

                      {/* 健康・可用性 */}
                      {data.health ? (
                        <div className={styles.infoCard}>
                          <div className={styles.infoTitle}>🩺 健康・可用性</div>
                          <div className={styles.infoStat}>
                            <span>怪我リスク</span>
                            <span
                              className={styles.infoStatVal}
                              style={{
                                color:
                                  data.health.injury_risk >= 45
                                    ? "var(--color-danger)"
                                    : "var(--color-success)",
                              }}
                            >
                              {data.health.injury_risk} / 100
                            </span>
                          </div>
                          <div className={styles.infoStat}>
                            <span>稼働可能率</span>
                            <span className={styles.infoStatVal}>
                              {data.health.availability_pct}%
                            </span>
                          </div>
                          <div className={styles.infoNote}>{data.health.note}</div>
                        </div>
                      ) : null}

                      {/* 海外適性 */}
                      {data.overseas ? (
                        <div className={styles.infoCard}>
                          <div className={styles.infoTitle}>
                            🌏 海外適性 {data.overseas.score}/100
                          </div>
                          <ul className={styles.factorList}>
                            {data.overseas.factors.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  {/* ── 戦術・プレースタイル分析（B#12-17,19） ── */}
                  {deep ? (
                    <section className={styles.section}>
                      <h2 className={styles.subheading}>戦術・プレースタイル分析</h2>
                      <div className={ins.grid}>
                        {/* 対人プレー */}
                        <div className={ins.panel}>
                          <div className={ins.panelHead}>
                            <span className={ins.panelTitle}>
                              <span className={ins.panelIcon}>⚔️</span>対人プレー（1対1）
                            </span>
                          </div>
                          <StatBars
                            items={[
                              { label: "仕掛け（攻撃）", value: deep.duel.attacking_1v1 },
                              { label: "対応（守備）", value: deep.duel.defending_1v1 },
                              { label: "寄せ・プレス強度", value: deep.duel.pressing },
                            ]}
                          />
                          <p className={ins.comment}>{deep.duel.comment}</p>
                        </div>

                        {/* 局面別 */}
                        <div className={ins.panel}>
                          <div className={ins.panelHead}>
                            <span className={ins.panelTitle}>
                              <span className={ins.panelIcon}>🔄</span>局面別評価
                            </span>
                          </div>
                          <StatBars
                            items={[
                              { label: "攻撃局面", value: deep.situational.attacking },
                              { label: "守備局面", value: deep.situational.defending },
                              { label: "トランジション", value: deep.situational.transition },
                            ]}
                          />
                          <p className={ins.comment}>{deep.situational.comment}</p>
                        </div>

                        {/* 利き足バランス */}
                        <div className={ins.panel}>
                          <div className={ins.panelHead}>
                            <span className={ins.panelTitle}>
                              <span className={ins.panelIcon}>🦶</span>両足バランス
                            </span>
                            <span className={ins.badge}>逆足比 {deep.footedness.balance_pct}%</span>
                          </div>
                          <StatBars
                            items={[
                              { label: "利き足の技術", value: deep.footedness.dominant_foot_skill },
                              { label: "逆足の技術", value: deep.footedness.weak_foot_skill },
                            ]}
                          />
                          <p className={ins.comment}>{deep.footedness.comment}</p>
                        </div>

                        {/* 判断スピード */}
                        <div className={ins.panel}>
                          <div className={ins.panelHead}>
                            <span className={ins.panelTitle}>
                              <span className={ins.panelIcon}>🧠</span>判断スピード・認知
                            </span>
                          </div>
                          <StatBars
                            items={[
                              { label: "首振り・スキャン頻度", value: deep.decision.scan_frequency },
                              { label: "判断の速さ", value: deep.decision.decision_speed },
                              { label: "受ける前の準備", value: deep.decision.pre_receive_prep },
                            ]}
                          />
                          <p className={ins.comment}>{deep.decision.comment}</p>
                        </div>

                        {/* セットプレー */}
                        <div className={ins.panel}>
                          <div className={ins.panelHead}>
                            <span className={ins.panelTitle}>
                              <span className={ins.panelIcon}>🎯</span>セットプレー・空中戦
                            </span>
                          </div>
                          <StatBars
                            items={[
                              { label: "空中戦", value: deep.set_piece.aerial_duel },
                              { label: "プレースキック精度", value: deep.set_piece.delivery },
                              { label: "ボックス内の存在感", value: deep.set_piece.box_presence },
                            ]}
                          />
                          <p className={ins.comment}>{deep.set_piece.comment}</p>
                        </div>

                        {/* 疲労耐性カーブ */}
                        <div className={`${ins.panel} ${ins.panelWide}`}>
                          <div className={ins.panelHead}>
                            <span className={ins.panelTitle}>
                              <span className={ins.panelIcon}>🔋</span>疲労耐性カーブ（試合内の出力維持）
                            </span>
                            <span className={ins.badge}>
                              終盤維持 {deep.fatigue.endurance_index}%
                            </span>
                          </div>
                          <FatigueCurveChart curve={deep.fatigue.curve} />
                          <p className={ins.comment}>{deep.fatigue.comment}</p>
                        </div>

                        {/* ゾーン占有ヒートマップ */}
                        <div className={`${ins.panel} ${ins.panelWide}`}>
                          <div className={ins.panelHead}>
                            <span className={ins.panelTitle}>
                              <span className={ins.panelIcon}>🗺️</span>ゾーン占有ヒートマップ
                            </span>
                            <span className={ins.badge}>行動範囲 {deep.heatmap.coverage}</span>
                          </div>
                          <PitchHeatmap zones={deep.heatmap.zones} coverage={deep.heatmap.coverage} />
                          <p className={ins.comment}>{deep.heatmap.comment}</p>
                        </div>
                      </div>
                      <p className={ins.footnote}>※ {deep.method_note}</p>
                    </section>
                  ) : null}

                  {/* ── 市場価値・類似選手（C#28/29） ── */}
                  {market || similar.length > 0 ? (
                    <section className={styles.section}>
                      <h2 className={styles.subheading}>市場価値・類似選手</h2>
                      <div className={ins.grid}>
                        {market ? (
                          <div className={ins.panel}>
                            <div className={ins.panelHead}>
                              <span className={ins.panelTitle}>
                                <span className={ins.panelIcon}>💰</span>移籍市場価値
                              </span>
                              <span className={ins.badge}>参考レンジ</span>
                            </div>
                            <div className={ins.valueRange}>
                              <span className={ins.valueNum}>{manYen(market.low_jpy)}</span>
                              <span className={ins.valueUnit}>〜</span>
                              <span className={ins.valueNum}>{manYen(market.high_jpy)}</span>
                            </div>
                            <div className={ins.factorRow}>
                              <span>年齢プレミア係数</span>
                              <span className={ins.factorVal}>×{market.age_factor}</span>
                            </div>
                            <div className={ins.factorRow}>
                              <span>ポジション係数</span>
                              <span className={ins.factorVal}>×{market.position_factor}</span>
                            </div>
                            <p className={ins.comment}>{market.comment}</p>
                          </div>
                        ) : null}
                        {similar.length > 0 ? (
                          <div className={ins.panel}>
                            <div className={ins.panelHead}>
                              <span className={ins.panelTitle}>
                                <span className={ins.panelIcon}>👥</span>類似選手
                              </span>
                              <span className={ins.badge}>スコアベクトル近傍</span>
                            </div>
                            {similar.map((s, i) => (
                              <div key={s.athlete_id} className={ins.similarRow}>
                                <span className={ins.similarMain}>
                                  <span className={ins.similarRank}>{i + 1}</span>
                                  <span style={{ minWidth: 0 }}>
                                    <Link
                                      className={ins.similarName}
                                      href={`/scout/athletes/${s.athlete_id}`}
                                    >
                                      {s.name}
                                    </Link>
                                    <span className={ins.similarMeta}>
                                      {" "}
                                      {[s.position, `総合 ${s.total_score}`]
                                        .filter(Boolean)
                                        .join(" ・ ")}
                                    </span>
                                  </span>
                                </span>
                                <span className={ins.similarScore}>
                                  <span className={ins.similarSim}>{s.similarity}%</span>
                                  <span className={ins.similarSimLabel}>類似度</span>
                                </span>
                              </div>
                            ))}
                            <p className={ins.comment}>
                              4基礎スコアのコサイン類似度＋ユークリッド距離で算出（参考値）。
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  {/* ── スカウト業務（商談・共有ノート・クリップ） ── */}
                  <section className={styles.section}>
                    <h2 className={styles.subheading}>スカウト業務</h2>
                    <div className={ins.grid}>
                      {/* 商談ステータス */}
                      <div className={ins.panel}>
                        <div className={ins.panelHead}>
                          <span className={ins.panelTitle}>
                            <span className={ins.panelIcon}>📋</span>商談ステータス
                          </span>
                          {contact ? (
                            <span className={ins.badge}>{stageLabel[contact.stage]}</span>
                          ) : null}
                        </div>
                        {contact ? (
                          <>
                            <p className={ins.comment} style={{ marginTop: 0, borderTop: "none" }}>
                              この選手はパイプラインで管理中です。
                            </p>
                            <div className={ins.formRow}>
                              {contact.stage !== "signed" && contact.stage !== "dropped" ? (
                                <button
                                  type="button"
                                  className={ins.btn}
                                  onClick={handleAdvanceStage}
                                  disabled={busy}
                                >
                                  次の段階へ進める
                                </button>
                              ) : null}
                              <Link className={ins.btnGhost} href="/scout/pipeline" style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "var(--space-2) var(--space-4)",
                                borderRadius: "var(--radius-sm)",
                                fontSize: "var(--text-sm)",
                                fontWeight: 600,
                              }}>
                                パイプラインで見る
                              </Link>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className={ins.comment} style={{ marginTop: 0, borderTop: "none" }}>
                              まだ商談化されていません。パイプラインに追加して進捗を管理できます。
                            </p>
                            <button
                              type="button"
                              className={ins.btn}
                              onClick={handleAddToPipeline}
                              disabled={busy}
                            >
                              ＋ 商談に追加（注目）
                            </button>
                          </>
                        )}
                      </div>

                      {/* 共有ノート */}
                      <div className={ins.panel}>
                        <div className={ins.panelHead}>
                          <span className={ins.panelTitle}>
                            <span className={ins.panelIcon}>📝</span>共有ノート
                          </span>
                          <span className={ins.badge}>チーム内</span>
                        </div>
                        <div className={ins.form}>
                          <textarea
                            className={ins.textarea}
                            rows={2}
                            placeholder="所見・気づきをチームに共有…"
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                          />
                          <button
                            type="button"
                            className={ins.btn}
                            onClick={handleAddNote}
                            disabled={busy || !noteInput.trim()}
                          >
                            投稿する
                          </button>
                        </div>
                        <div style={{ marginTop: "var(--space-3)" }}>
                          {notes.length === 0 ? (
                            <p className={ins.footnote}>まだノートはありません。</p>
                          ) : (
                            notes.map((n) => (
                              <div key={n.id} className={ins.listItem}>
                                <div style={{ fontSize: "var(--text-sm)" }}>{n.body}</div>
                                <div className={ins.listMeta}>
                                  <span>{new Date(n.created_at).toLocaleDateString("ja-JP")}</span>
                                  <button
                                    type="button"
                                    className={ins.delBtn}
                                    onClick={() => handleDeleteNote(n.id)}
                                  >
                                    削除
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* 動画クリップ */}
                      <div className={ins.panel}>
                        <div className={ins.panelHead}>
                          <span className={ins.panelTitle}>
                            <span className={ins.panelIcon}>🎬</span>動画クリップ
                          </span>
                        </div>
                        <div className={ins.form}>
                          <input
                            className={ins.input}
                            placeholder="クリップ名（例: 1対1突破）"
                            value={clipTitle}
                            onChange={(e) => setClipTitle(e.target.value)}
                          />
                          <div className={ins.formRow}>
                            <input
                              className={ins.input}
                              type="number"
                              min={0}
                              placeholder="開始秒"
                              value={clipStart}
                              onChange={(e) => setClipStart(e.target.value)}
                            />
                            <input
                              className={ins.input}
                              type="number"
                              min={0}
                              placeholder="終了秒"
                              value={clipEnd}
                              onChange={(e) => setClipEnd(e.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            className={ins.btn}
                            onClick={handleAddClip}
                            disabled={
                              busy ||
                              !clipTitle.trim() ||
                              !(Number(clipEnd) > Number(clipStart))
                            }
                          >
                            クリップを追加
                          </button>
                        </div>
                        <div style={{ marginTop: "var(--space-3)" }}>
                          {clips.length === 0 ? (
                            <p className={ins.footnote}>
                              重要なプレーの区間を切り出してチームで共有できます。
                            </p>
                          ) : (
                            clips.map((c) => (
                              <div key={c.id} className={ins.listItem}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "var(--space-2)",
                                  }}
                                >
                                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                                    {c.title}
                                  </span>
                                  <span className={ins.clipPill}>
                                    {fmtClock(c.start_sec)}–{fmtClock(c.end_sec)}
                                  </span>
                                </div>
                                <div className={ins.listMeta}>
                                  <span>{Math.round(c.end_sec - c.start_sec)}秒</span>
                                  <button
                                    type="button"
                                    className={ins.delBtn}
                                    onClick={() => handleDeleteClip(c.id)}
                                  >
                                    削除
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* ── 総合スコア推移 ── */}
                  <section className={styles.section}>
                    <h2 className={styles.subheading}>総合スコアの推移</h2>
                    <div className={styles.chartWrap}>
                      <ScoreHistoryChart history={data.history} />
                    </div>
                  </section>

                  {/* ── スカウト向け総評 ── */}
                  {insights && data.benchmark ? (
                    <section className={styles.section}>
                      <h2 className={styles.subheading}>スカウト向け総評（自動生成・参考）</h2>
                      <div className={styles.summaryBox}>
                        {data.name}は{data.position}として同ポジション{data.benchmark.sample_size}
                        人中
                        {data.percentile != null ? `上位${100 - data.percentile}%` : "—"}に位置し、
                        総合スコアは平均を
                        {Math.round((data.latest.total_score - data.benchmark.total_score) * 10) /
                          10}
                        ポイント
                        {data.latest.total_score >= data.benchmark.total_score
                          ? "上回る"
                          : "下回る"}
                        。 特に「{insights.strength.label}」（{insights.strength.value}
                        点）が武器で、 「{insights.weakness.label}」（{insights.weakness.value}
                        点）に伸びしろがある。
                        {growth != null && growth > 0
                          ? `直近は総合+${growth}ポイントと成長傾向。`
                          : growth != null && growth < 0
                            ? `直近は総合${growth}ポイントとやや下降。`
                            : ""}
                        安定性スコアは{data.consistency ?? "—"}。
                      </div>
                    </section>
                  ) : null}
                </>
              ) : (
                <p className={styles.empty}>分析データがまだありません。</p>
              )}

              <p className={styles.disclaimer}>
                ※ AI スコアはあくまで参考値です。選手評価の唯一の根拠として使用しないでください。
              </p>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
