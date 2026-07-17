/**
 * デモモード用の組み込みデータ。
 *
 * NEXT_PUBLIC_DEMO === "1" のとき、API クライアントはバックエンドに接続せず
 * このデータを返す。公開バックエンドなしで Vercel 上のダッシュボードを
 * 体験してもらうための仕組み（スコアは架空の参考値）。
 */

import type {
  Ability,
  AthleteScores,
  AthleteSearchItem,
  DeepAnalysis,
  Health,
  MarketValue,
  Nutrition,
  OverseasReadiness,
  PhysicalPoint,
  Prediction,
  ScoreSnapshot,
  SimilarAthlete,
} from "./api";

interface DemoAthlete {
  id: string;
  name: string;
  position: string;
  location: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  base: [number, number, number, number]; // sprint, ball, positioning, body
}

/** id から決定論的な擬似乱数（0-1） */
function seed(id: string, salt: string): number {
  let h = 2166136261;
  const s = `${id}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** 基準値 ± range で id 依存の値を作り 0-100 に収める */
function around(id: string, salt: string, center: number, range: number): number {
  const v = center + (seed(id, salt) - 0.5) * 2 * range;
  return Math.round(Math.max(0, Math.min(100, v)));
}

const ATHLETES: DemoAthlete[] = [
  {
    id: "d1",
    name: "三笘 次郎",
    position: "MF",
    location: "神奈川",
    age: 17,
    height_cm: 170,
    weight_kg: 65,
    base: [90, 85, 80, 77],
  },
  {
    id: "d2",
    name: "南野 五郎",
    position: "FW",
    location: "大阪",
    age: 18,
    height_cm: 174,
    weight_kg: 68,
    base: [88, 80, 76, 74],
  },
  {
    id: "d3",
    name: "久保 太郎",
    position: "FW",
    location: "東京",
    age: 16,
    height_cm: 178,
    weight_kg: 70,
    base: [82, 74, 88, 79],
  },
  {
    id: "d4",
    name: "冨安 三郎",
    position: "DF",
    location: "大阪",
    age: 19,
    height_cm: 188,
    weight_kg: 82,
    base: [70, 60, 85, 90],
  },
  {
    id: "d5",
    name: "遠藤 四郎",
    position: "MF",
    location: "福岡",
    age: 17,
    height_cm: 178,
    weight_kg: 72,
    base: [65, 78, 72, 68],
  },
];

// ポジション別重み（backend position_weights.py と一致）
const POSITION_WEIGHTS: Record<string, [number, number, number, number]> = {
  FW: [0.35, 0.35, 0.2, 0.1],
  MF: [0.25, 0.3, 0.3, 0.15],
  DF: [0.2, 0.15, 0.35, 0.3],
  GK: [0.1, 0.2, 0.35, 0.35],
};
const BALANCED_W: [number, number, number, number] = [0.3, 0.3, 0.2, 0.2];

function total(b: [number, number, number, number], position?: string): number {
  const w = (position && POSITION_WEIGHTS[position.toUpperCase()]) || BALANCED_W;
  return Math.round((b[0] * w[0] + b[1] * w[1] + b[2] * w[2] + b[3] * w[3]) * 10) / 10;
}

export function demoSearch(): AthleteSearchItem[] {
  return ATHLETES.map((a) => ({
    id: a.id,
    name: a.name,
    position: a.position,
    sport: "football",
    location: a.location,
    height_cm: a.height_cm,
    weight_kg: a.weight_kg,
    latest_total_score: total(a.base, a.position),
    is_reference_score: true,
  })).sort((x, y) => (y.latest_total_score ?? 0) - (x.latest_total_score ?? 0));
}

export function demoScores(id: string): AthleteScores {
  const a = ATHLETES.find((x) => x.id === id) ?? ATHLETES[0];
  // 3 回分の履歴（0.9 → 0.95 → 1.0 で成長）
  const history: ScoreSnapshot[] = [0.9, 0.95, 1.0].map((f, i) => {
    const b = a.base.map((s) => Math.round(s * f * 10) / 10) as [number, number, number, number];
    return {
      sprint_score: b[0],
      ball_control_score: b[1],
      positioning_score: b[2],
      body_usage_score: b[3],
      total_score: total(b, a.position),
      analyzed_at: `2026-0${i + 4}-01T00:00:00Z`,
    };
  });
  const latest = history[history.length - 1];

  // 同ポジション平均（ベンチマーク）
  const peers = ATHLETES.filter((x) => x.position === a.position);
  const mean = (idx: number) =>
    Math.round((peers.reduce((s, p) => s + p.base[idx], 0) / peers.length) * 10) / 10;
  const benchmark = {
    sprint_score: mean(0),
    ball_control_score: mean(1),
    positioning_score: mean(2),
    body_usage_score: mean(3),
    total_score:
      Math.round((peers.reduce((s, p) => s + total(p.base, p.position), 0) / peers.length) * 10) /
      10,
    sample_size: peers.length,
  };

  // パーセンタイル（同ポジション内で自分以下の割合）
  const myTotal = total(a.base, a.position);
  const below = peers.filter((p) => total(p.base, p.position) <= myTotal).length;
  const percentile = Math.round((below / peers.length) * 100);

  // 安定性（履歴総合スコアの標準偏差 → 0-100）
  const totals = history.map((h) => h.total_score);
  const avg = totals.reduce((s, v) => s + v, 0) / totals.length;
  const sd = Math.sqrt(totals.reduce((s, v) => s + (v - avg) ** 2, 0) / totals.length);
  const consistency = Math.round(Math.max(0, 100 - sd * 5) * 10) / 10;

  const h = a.height_cm / 100;
  const bmi = Math.round((a.weight_kg / (h * h)) * 10) / 10;

  // ── 多面能力（技術/フィジカル/メンタル/健康）──
  const [sp, bc, po, bo] = a.base;
  const abilities: Ability[] = [
    {
      category: "技術",
      name: "ポジショニング正確性",
      value: po,
      avg: benchmark.positioning_score,
      note: "オフザボールの位置取り",
    },
    { category: "技術", name: "ボールコントロール", value: bc, avg: benchmark.ball_control_score },
    { category: "技術", name: "基礎技術", value: around(a.id, "basic-tech", (bc + po) / 2, 8) },
    {
      category: "フィジカル",
      name: "瞬発力（スプリント）",
      value: sp,
      avg: benchmark.sprint_score,
    },
    {
      category: "フィジカル",
      name: "持久力",
      value: around(a.id, "stamina", 72, 15),
      note: "走行データより推定",
    },
    { category: "フィジカル", name: "基礎体力", value: around(a.id, "fitness", 74, 12) },
    { category: "フィジカル", name: "敏捷性", value: around(a.id, "agility", sp - 4, 10) },
    {
      category: "フィジカル",
      name: "柔軟性（足首の柔らかさ）",
      value: around(a.id, "ankle", 68, 16),
    },
    {
      category: "フィジカル",
      name: "軸の固さ（体幹）",
      value: bo,
      avg: benchmark.body_usage_score,
    },
    {
      category: "メンタル",
      name: "安定性（メンタル）",
      value: Math.round(consistency),
      note: "試合間のブレの小ささ",
    },
    { category: "メンタル", name: "協調性", value: around(a.id, "teamwork", 76, 14) },
    { category: "メンタル", name: "コミュニケーション力", value: around(a.id, "comm", 72, 16) },
    { category: "健康", name: "健康面", value: around(a.id, "health", 82, 10) },
    { category: "健康", name: "コンディション安定", value: around(a.id, "cond", 78, 12) },
  ];

  // ── 身体データの時系列（過去12ヶ月・成長中）──
  const physical_history: PhysicalPoint[] = [0, 3, 6, 9, 12].map((mAgo, i) => {
    const grow = (12 - mAgo) / 12; // 過去ほど小さい
    return {
      date: `2025-${String(((i * 3) % 12) + 1).padStart(2, "0")}`,
      height_cm: Math.round((a.height_cm - (1 - grow) * 3) * 10) / 10,
      weight_kg: Math.round((a.weight_kg - (1 - grow) * 4) * 10) / 10,
      body_fat_pct: Math.round((12 + (1 - grow) * 2) * 10) / 10,
    };
  });

  // ── 栄養・食事 ──
  const adequacy = around(a.id, "nutrition", 74, 18);
  const nutrition: Nutrition = {
    avg_calories: 2600 + Math.round(seed(a.id, "cal") * 600),
    protein_g: 90 + Math.round(seed(a.id, "pro") * 60),
    adequacy,
    note:
      adequacy >= 75
        ? "たんぱく質・総カロリーとも成長期の目安を概ね充足。"
        : "総カロリーがやや不足気味。増量期は補食の追加を推奨。",
  };

  // ── 将来予測（成長率 + ポテンシャル）──
  const potential = around(a.id, "potential", a.age <= 17 ? 85 : 72, 12);
  const projected_total = Math.round(Math.min(99, myTotal + potential / 12) * 10) / 10;
  const prediction: Prediction = {
    horizon: "12ヶ月後",
    projected_total,
    projected_height_cm: Math.round((a.height_cm + (a.age <= 17 ? 2.5 : 0.8)) * 10) / 10,
    projected_weight_kg: Math.round((a.weight_kg + 3) * 10) / 10,
    potential,
    comment:
      a.age <= 17
        ? "成長期でフィジカル向上余地が大きい。総合スコアの上振れ期待。"
        : "技術の伸びが中心。フィジカルは現状維持〜微増の見込み。",
  };

  // ── 健康・可用性 ──
  const injuryRisk = around(a.id, "injury", 30, 20);
  const health: Health = {
    injury_risk: injuryRisk,
    availability_pct: 100 - Math.round(injuryRisk / 3),
    note:
      injuryRisk >= 45
        ? "直近の負荷が高め。オーバートレーニングに注意。"
        : "急性:慢性 負荷比は適正範囲。大きな懸念なし。",
  };

  // ── 海外適性 ──
  const overseasScore = around(a.id, "overseas", (myTotal + potential) / 2, 10);
  const overseas: OverseasReadiness = {
    score: overseasScore,
    factors: [
      `総合力 ${myTotal}（同ポジ上位${100 - percentile}%）`,
      potential >= 80
        ? "高いポテンシャルで育成環境に適応余地大"
        : "即戦力寄りで適応に時間を要する可能性",
      overseasScore >= 75
        ? "フィジカル・メンタルとも海外基準に近い"
        : "フィジカル強化が渡航前の課題",
      `年齢 ${a.age}歳（若年は移籍市場で有利）`,
    ],
  };

  return {
    id: a.id,
    name: a.name,
    position: a.position,
    sport: "football",
    location: a.location,
    age: a.age,
    height_cm: a.height_cm,
    weight_kg: a.weight_kg,
    latest,
    history,
    benchmark,
    percentile,
    consistency,
    bmi,
    abilities,
    physical_history,
    nutrition,
    prediction,
    health,
    overseas,
    is_reference_score: true,
  };
}

// ── 深掘り分析(B#11-17,19) — backend deep_analysis.py の移植 ─────────

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.round(Math.max(lo, Math.min(hi, v)) * 10) / 10;
}

/** 4基礎スコアの加重合成 */
function mix(b: [number, number, number, number], w: [number, number, number, number], bias = 0) {
  return clamp(b[0] * w[0] + b[1] * w[1] + b[2] * w[2] + b[3] * w[3] + bias);
}

// ポジション別のゾーン占有基準（自陣→敵陣 × 左/中/右, %）
const ZONE_BASE: Record<string, number[][]> = {
  FW: [
    [2, 3, 2],
    [8, 12, 8],
    [18, 29, 18],
  ],
  MF: [
    [5, 8, 5],
    [15, 24, 15],
    [8, 12, 8],
  ],
  DF: [
    [16, 26, 16],
    [10, 16, 10],
    [2, 2, 2],
  ],
  GK: [
    [10, 78, 10],
    [0, 2, 0],
    [0, 0, 0],
  ],
};

export function demoDeepAnalysis(id: string): DeepAnalysis {
  const a = ATHLETES.find((x) => x.id === id) ?? ATHLETES[0];
  const b = a.base; // [sprint, ball, positioning, body]
  const [sp, bc, po, bo] = b;

  // B#12 対人
  const atk = mix(b, [0.3, 0.5, 0, 0.2]);
  const dfd = mix(b, [0.2, 0, 0.4, 0.4]);
  const duel = {
    attacking_1v1: atk,
    defending_1v1: dfd,
    pressing: mix(b, [0.5, 0, 0.3, 0.2], -1),
    comment:
      atk >= dfd + 10
        ? "仕掛け優位型。攻撃の1対1で違いを作れる。"
        : dfd >= atk + 10
          ? "対人守備型。1対1の対応と寄せに強みがある。"
          : "攻守バランス型。局面を選ばず1対1で戦える。",
  };

  // B#13 利き足
  const dominant = clamp(bc + 2);
  const weak = clamp(bc - 8 - Math.max(0, bc - bo) * 0.5);
  const balance = clamp((weak / dominant) * 100);
  const footedness = {
    dominant_foot_skill: dominant,
    weak_foot_skill: weak,
    balance_pct: balance,
    comment:
      balance >= 85
        ? "両足遜色なし。逆足でもプレー選択を狭めない。"
        : balance >= 70
          ? "逆足も実用レベル。仕上げの精度向上で幅が広がる。"
          : "利き足依存が強め。逆足のファーストタッチ強化を推奨。",
  };

  // B#14 局面別
  const sAtk = mix(b, [0.2, 0.5, 0.3, 0]);
  const sDfd = mix(b, [0.2, 0, 0.5, 0.3]);
  const sTrn = mix(b, [0.5, 0.2, 0.3, 0]);
  const best =
    sAtk >= sDfd && sAtk >= sTrn
      ? (["攻撃", sAtk] as const)
      : sDfd >= sTrn
        ? (["守備", sDfd] as const)
        : (["トランジション", sTrn] as const);
  const situational = {
    attacking: sAtk,
    defending: sDfd,
    transition: sTrn,
    comment: `最も強みが出るのは${best[0]}局面（${best[1]}）。`,
  };

  // B#15 ヒートマップ
  const zoneBase = ZONE_BASE[a.position.toUpperCase()] ?? ZONE_BASE.MF;
  const mobility = (sp + po) / 2;
  const spread = clamp((mobility - 50) / 50, 0, 1) * 0.3;
  const flat = 100 / 9;
  const zones = zoneBase.map((row) =>
    row.map((v) => Math.round((v * (1 - spread) + flat * spread) * 10) / 10)
  );
  const coverage = clamp(40 + mobility * 0.6);
  const heatmap = {
    zones,
    coverage,
    comment: `行動範囲スコア ${coverage}。ポジション基準にスプリント補正した推定分布。`,
  };

  // B#16 判断
  const scan = mix(b, [0, 0.2, 0.8, 0], -3);
  const speedD = mix(b, [0.2, 0.3, 0.5, 0], -1);
  const prep = mix(b, [0, 0, 0.6, 0.4], -2);
  const avgD = (scan + speedD + prep) / 3;
  const decision = {
    scan_frequency: scan,
    decision_speed: speedD,
    pre_receive_prep: prep,
    comment:
      avgD >= 75
        ? "認知→判断→実行が速い。プレッシャー下でも選択肢を保てる。"
        : avgD >= 60
          ? "判断は平均以上。受ける前のスキャン頻度を上げると更に伸びる。"
          : "判断に改善余地。首振り・体の向きの習慣化を推奨。",
  };

  // B#17 セットプレー（身長補正）
  const hBonus = clamp((a.height_cm - 170) * 0.5, -8, 8);
  const aerial = clamp(mix(b, [0, 0, 0.4, 0.6], -3) + hBonus);
  const set_piece = {
    aerial_duel: aerial,
    delivery: mix(b, [0, 0.8, 0.2, 0], -4),
    box_presence: clamp(mix(b, [0, 0, 0.5, 0.5], -2) + hBonus * 0.5),
    comment:
      aerial >= 70
        ? "空中戦に強み。セットプレーのターゲットになれる。"
        : "空中戦は平均圏。ポジショニングで補うタイプ。",
  };

  // B#19 疲労カーブ
  const stamina = (sp * 0.5 + bo * 0.5) / 100;
  const stability = 0.8; // デモは安定性80相当
  const decay = 4 * (1 - (stamina * 0.6 + stability * 0.4));
  const curve = [0, 1, 2, 3, 4, 5].map((i) => Math.round(Math.max(60, 100 - decay * i) * 10) / 10);
  const endurance = curve[curve.length - 1];
  const fatigue = {
    curve,
    endurance_index: endurance,
    comment:
      endurance >= 90
        ? "終盤も出力が落ちにくい。フル出場に耐えるスタミナ。"
        : endurance >= 80
          ? "標準的な持久力。70分以降の強度管理がポイント。"
          : "終盤の低下が大きめ。交代カードや持久系トレの検討を。",
  };

  return {
    athlete_id: a.id,
    duel,
    footedness,
    situational,
    heatmap,
    decision,
    set_piece,
    fatigue,
    method_note:
      "Phase 1: 4基礎スコア・履歴・体格からの導出値。実測トラッキング導入時に実測値へ置換予定。",
    is_reference_score: true,
  };
}

// ── 類似選手(C#28) / 市場価値(C#29) ─────────────────────────────────

export function demoSimilar(id: string): SimilarAthlete[] {
  const target = ATHLETES.find((x) => x.id === id) ?? ATHLETES[0];
  const tv = target.base;
  return ATHLETES.filter((x) => x.id !== target.id)
    .map((x) => {
      const v = x.base;
      const dot = tv[0] * v[0] + tv[1] * v[1] + tv[2] * v[2] + tv[3] * v[3];
      const na = Math.sqrt(tv.reduce((s, y) => s + y * y, 0));
      const nb = Math.sqrt(v.reduce((s, y) => s + y * y, 0));
      const cos = na && nb ? dot / (na * nb) : 0;
      const dist = Math.sqrt(tv.reduce((s, y, i) => s + (y - v[i]) ** 2, 0));
      const distScore = Math.max(0, 1 - dist / 50);
      return {
        athlete_id: x.id,
        name: x.name,
        position: x.position,
        similarity: Math.round(((cos + distScore) / 2) * 1000) / 10,
        total_score: total(x.base, x.position),
        is_reference_score: true as const,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

export function demoMarketValue(id: string): MarketValue {
  const a = ATHLETES.find((x) => x.id === id) ?? ATHLETES[0];
  const myTotal = total(a.base, a.position);
  const ratio = Math.max(0, Math.min(1, myTotal / 100));
  const base = ratio ** 2 * 10_000_000;
  const af = a.age <= 15 ? 1.3 : a.age <= 18 ? 1.25 : a.age <= 21 ? 1.15 : 1.0;
  const pf = ({ FW: 1.2, MF: 1.1, DF: 1.0, GK: 0.9 } as Record<string, number>)[
    a.position.toUpperCase()
  ] ?? 1.0;
  const mid = base * af * pf;
  return {
    low_jpy: Math.round((mid * 0.6) / 10000) * 10000,
    high_jpy: Math.round((mid * 1.5) / 10000) * 10000,
    age_factor: af,
    position_factor: pf,
    comment:
      "スコア・年齢・ポジションからの参考レンジ。実績・出場歴・市場動向は未反映のため、交渉・契約の根拠には使用しないこと。",
    is_reference_score: true,
  };
}
