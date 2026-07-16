import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

import RadarChart, { type RadarAxis } from "@/components/RadarChart";
import { type AthleteScores, getAthleteScores, getToken } from "@/lib/api";
import styles from "@/styles/report.module.css";

const AXES = [
  { key: "sprint_score", label: "スプリント" },
  { key: "ball_control_score", label: "ボール" },
  { key: "positioning_score", label: "ポジ" },
  { key: "body_usage_score", label: "身体" },
] as const;

export default function AthleteReportPage() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<AthleteScores | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (athleteId: string) => {
    try {
      setData(await getAthleteScores(athleteId));
    } catch {
      setError("レポートの取得に失敗しました");
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
    ? AXES.map((a) => ({ label: a.label, value: data.latest![a.key] }))
    : [];

  const today = new Date().toISOString().slice(0, 10);

  const handleExcelExport = useCallback(() => {
    if (!data) return;
    const rows: (string | number)[][] = [];
    rows.push(["sports-tech スカウトレポート"]);
    rows.push(["選手名", data.name]);
    rows.push(["ポジション", data.position ?? ""]);
    rows.push(["競技", data.sport ?? ""]);
    rows.push(["地域", data.location ?? ""]);
    rows.push(["身長(cm)", data.height_cm ?? ""]);
    rows.push(["体重(kg)", data.weight_kg ?? ""]);
    rows.push(["BMI", data.bmi ?? ""]);
    rows.push(["発行日", today]);
    rows.push([]);
    if (data.latest) {
      rows.push(["総合スコア(参考値)", data.latest.total_score]);
      rows.push([]);
      rows.push(["項目", "スコア", "同ポジ平均"]);
      for (const a of AXES) {
        rows.push([
          a.label,
          data.latest[a.key],
          data.benchmark ? (data.benchmark[a.key] as number) : "",
        ]);
      }
      rows.push([]);
      rows.push(["同ポジション順位", data.percentile != null ? `上位${100 - data.percentile}%` : ""]);
      rows.push(["安定性", data.consistency ?? ""]);
      if (data.prediction) {
        rows.push([`${data.prediction.horizon}予測`, data.prediction.projected_total]);
        rows.push(["伸びしろ(potential)", data.prediction.potential]);
        rows.push(["所見", data.prediction.comment]);
      }
    }
    if (data.abilities && data.abilities.length > 0) {
      rows.push([]);
      rows.push(["詳細能力評価"]);
      for (const ab of data.abilities) rows.push([ab.name, ab.value]);
    }
    rows.push([]);
    rows.push(["※本レポートのスコアはAIによる参考値です。選手評価の唯一の根拠として使用しないでください。"]);

    const escape = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(escape).join(",")).join("\r\n");
    // UTF-8 BOM を付与して Excel で文字化けを防ぐ
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `scout-report_${data.name}_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [data, today]);

  return (
    <>
      <Head>
        <title>{data ? `${data.name} 分析レポート` : "分析レポート"}</title>
      </Head>
      <div className={styles.page}>
        {/* 画面上部のツールバー（印刷時は非表示） */}
        <div className={styles.toolbar}>
          <Link
            className={styles.link}
            href={typeof id === "string" ? `/scout/athletes/${id}` : "/scout/search"}
          >
            ← 詳細に戻る
          </Link>
          <button className={styles.printBtn} onClick={() => window.print()}>
            🖨 PDFで保存 / 印刷
          </button>
          <button
            className={styles.printBtn}
            onClick={handleExcelExport}
            disabled={!data}
            style={{ marginLeft: 8 }}
          >
            📊 Excel/CSVで保存
          </button>
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        {data ? (
          <div className={styles.sheet}>
            {/* ヘッダー */}
            <div className={styles.reportHead}>
              <div>
                <div className={styles.brand}>⚽ sports-tech スカウトレポート</div>
                <h1 className={styles.name}>{data.name}</h1>
                <div className={styles.meta}>
                  {[data.position, data.sport, data.location].filter(Boolean).join(" ・ ")}
                  {data.height_cm ? ` ・ ${data.height_cm}cm` : ""}
                  {data.weight_kg ? ` / ${data.weight_kg}kg` : ""}
                  {data.bmi ? ` ・ BMI ${data.bmi}` : ""}
                </div>
              </div>
              {data.latest ? (
                <div className={styles.totalBox}>
                  <div className={styles.totalNum}>{data.latest.total_score}</div>
                  <div className={styles.totalLabel}>総合スコア（参考値）</div>
                </div>
              ) : null}
            </div>

            {data.latest ? (
              <>
                {/* KPI 行 */}
                <div className={styles.kpiRow}>
                  <div className={styles.kpi}>
                    <div className={styles.kpiVal}>
                      {data.percentile != null ? `上位${100 - data.percentile}%` : "—"}
                    </div>
                    <div className={styles.kpiLabel}>同ポジション順位</div>
                  </div>
                  <div className={styles.kpi}>
                    <div className={styles.kpiVal}>{data.benchmark?.total_score ?? "—"}</div>
                    <div className={styles.kpiLabel}>同ポジ平均</div>
                  </div>
                  <div className={styles.kpi}>
                    <div className={styles.kpiVal}>{data.consistency ?? "—"}</div>
                    <div className={styles.kpiLabel}>安定性</div>
                  </div>
                  <div className={styles.kpi}>
                    <div className={styles.kpiVal}>
                      {data.prediction ? data.prediction.projected_total : "—"}
                    </div>
                    <div className={styles.kpiLabel}>12ヶ月後予測</div>
                  </div>
                </div>

                {/* レーダー + 能力表 */}
                <div className={styles.twoCol}>
                  <div className={styles.radarWrap}>
                    <RadarChart axes={axes} size={240} />
                  </div>
                  <table className={styles.table}>
                    <tbody>
                      {AXES.map((a) => (
                        <tr key={a.key}>
                          <td>{a.label}</td>
                          <td className={styles.num}>{data.latest![a.key]}</td>
                          <td className={styles.avg}>
                            平均 {data.benchmark ? (data.benchmark[a.key] as number) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 詳細能力（あれば） */}
                {data.abilities && data.abilities.length > 0 ? (
                  <div className={styles.section}>
                    <h2 className={styles.h2}>詳細能力評価</h2>
                    <div className={styles.abilityGrid}>
                      {data.abilities.map((ab) => (
                        <div key={ab.name} className={styles.abilityItem}>
                          <span>{ab.name}</span>
                          <strong>{ab.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* 総評 */}
                {data.overseas ? (
                  <div className={styles.section}>
                    <h2 className={styles.h2}>スカウト所見</h2>
                    <p className={styles.summary}>
                      海外適性スコア {data.overseas.score}/100。
                      {data.overseas.factors.join(" / ")}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <p>分析データがありません。</p>
            )}

            <div className={styles.footer}>
              発行日 {today} ・ 本レポートのスコアは AI による参考値です。選手評価の唯一の根拠として
              使用しないでください。 © sports-tech
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
