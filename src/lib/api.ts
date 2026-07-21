/**
 * バックエンド API クライアント（スカウトダッシュボード用）。
 *
 * JWT は localStorage に保持する（Phase 2 で httpOnly Cookie / Supabase に移行）。
 */

import { demoDeepAnalysis, demoMarketValue, demoScores, demoSearch, demoSimilar } from "./demo";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "sportstech_scout_token";

/** デモモード（バックエンド無しで動作） */
export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const json = await res.json();
      if (typeof json?.detail === "string") detail = json.detail;
    } catch {
      // ignore non-JSON
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── 認証 ────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface MeResponse {
  id: string;
  email: string;
  role: "athlete" | "scout" | "coach";
  is_active: boolean;
}

export function login(email: string): Promise<TokenResponse> {
  if (DEMO) return delay({ access_token: "demo-token", token_type: "bearer" });
  return request<TokenResponse>("POST", "/api/auth/login", { email });
}

export function fetchMe(): Promise<MeResponse> {
  if (DEMO) {
    return delay({ id: "demo", email: "demo-scout@example.com", role: "scout", is_active: true });
  }
  return request<MeResponse>("GET", "/api/auth/me");
}

// ── スカウト選手検索 ────────────────────────────────────────────────

export interface AthleteSearchItem {
  id: string;
  name: string;
  position: string | null;
  sport: string;
  location: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  latest_total_score: number | null;
  is_reference_score: boolean;
}

export interface SearchFilters {
  position?: string;
  sport?: string;
  location?: string;
  min_total_score?: number;
}

export function searchAthletes(filters: SearchFilters): Promise<AthleteSearchItem[]> {
  if (DEMO) {
    let items = demoSearch();
    if (filters.position) items = items.filter((a) => a.position === filters.position);
    if (filters.location)
      items = items.filter((a) => (a.location ?? "").includes(filters.location!));
    if (filters.min_total_score != null) {
      items = items.filter((a) => (a.latest_total_score ?? -1) >= filters.min_total_score!);
    }
    return delay(items);
  }
  const params = new URLSearchParams();
  if (filters.position) params.set("position", filters.position);
  if (filters.sport) params.set("sport", filters.sport);
  if (filters.location) params.set("location", filters.location);
  if (filters.min_total_score != null) {
    params.set("min_total_score", String(filters.min_total_score));
  }
  params.set("limit", "100");
  const qs = params.toString();
  return request<AthleteSearchItem[]>("GET", `/api/scouts/athletes?${qs}`);
}

export function getAthlete(id: string): Promise<AthleteSearchItem> {
  return request<AthleteSearchItem>("GET", `/api/scouts/athletes/${id}`);
}

export interface ScoreSnapshot {
  sprint_score: number;
  ball_control_score: number;
  positioning_score: number;
  body_usage_score: number;
  total_score: number;
  analyzed_at: string;
}

export interface MetricBenchmark {
  sprint_score: number;
  ball_control_score: number;
  positioning_score: number;
  body_usage_score: number;
  total_score: number;
  sample_size: number;
}

/** 詳細能力（多面評価） */
export interface Ability {
  category: "技術" | "フィジカル" | "メンタル" | "健康";
  name: string;
  value: number; // 0-100
  avg?: number; // 同ポジション平均（比較可能な項目のみ）
  note?: string;
}

/** 身体データの時系列 1 点 */
export interface PhysicalPoint {
  date: string; // YYYY-MM
  height_cm: number;
  weight_kg: number;
  body_fat_pct: number;
}

/** 栄養・食事データ */
export interface Nutrition {
  avg_calories: number;
  protein_g: number;
  adequacy: number; // 食事の充足度 0-100
  note: string;
}

/** 将来予測 */
export interface Prediction {
  horizon: string; // 例: "12ヶ月後"
  projected_total: number;
  projected_height_cm: number;
  projected_weight_kg: number;
  potential: number; // 伸びしろ 0-100
  comment: string;
}

/** 健康・可用性 */
export interface Health {
  injury_risk: number; // 0-100（高いほど危険）
  availability_pct: number; // 稼働可能率
  note: string;
}

/** 海外適性 */
export interface OverseasReadiness {
  score: number; // 0-100
  factors: string[];
}

export interface AthleteScores {
  id: string;
  name: string;
  position: string | null;
  sport: string;
  location: string | null;
  age?: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  latest: ScoreSnapshot | null;
  history: ScoreSnapshot[];
  benchmark: MetricBenchmark | null;
  percentile: number | null;
  consistency: number | null;
  bmi: number | null;
  // ── 拡張アナリティクス（demo/将来のbackend） ──
  abilities?: Ability[];
  physical_history?: PhysicalPoint[];
  nutrition?: Nutrition | null;
  prediction?: Prediction | null;
  health?: Health | null;
  overseas?: OverseasReadiness | null;
  is_reference_score: boolean;
}

export function getAthleteScores(id: string): Promise<AthleteScores> {
  if (DEMO) return delay(demoScores(id));
  return request<AthleteScores>("GET", `/api/scouts/athletes/${id}/scores`);
}

// ── 深掘り分析(B#11-17,19) ──────────────────────────────────────────

export interface DeepAnalysis {
  athlete_id: string;
  duel: { attacking_1v1: number; defending_1v1: number; pressing: number; comment: string };
  footedness: {
    dominant_foot_skill: number;
    weak_foot_skill: number;
    balance_pct: number;
    comment: string;
  };
  situational: { attacking: number; defending: number; transition: number; comment: string };
  heatmap: { zones: number[][]; coverage: number; comment: string };
  decision: {
    scan_frequency: number;
    decision_speed: number;
    pre_receive_prep: number;
    comment: string;
  };
  set_piece: { aerial_duel: number; delivery: number; box_presence: number; comment: string };
  fatigue: { curve: number[]; endurance_index: number; comment: string };
  method_note: string;
  is_reference_score: boolean;
}

export function getDeepAnalysis(id: string): Promise<DeepAnalysis> {
  if (DEMO) return delay(demoDeepAnalysis(id));
  return request<DeepAnalysis>("GET", `/api/scouts/athletes/${id}/deep-analysis`);
}

// ── 類似選手(C#28) / 市場価値(C#29) ────────────────────────────────

export interface SimilarAthlete {
  athlete_id: string;
  name: string;
  position: string | null;
  similarity: number;
  total_score: number;
  is_reference_score: boolean;
}

export function getSimilarAthletes(id: string): Promise<SimilarAthlete[]> {
  if (DEMO) return delay(demoSimilar(id));
  return request<SimilarAthlete[]>("GET", `/api/scouts/athletes/${id}/similar`);
}

export interface MarketValue {
  low_jpy: number;
  high_jpy: number;
  age_factor: number;
  position_factor: number;
  comment: string;
  is_reference_score: boolean;
}

export function getMarketValue(id: string): Promise<MarketValue> {
  if (DEMO) return delay(demoMarketValue(id));
  return request<MarketValue>("GET", `/api/scouts/athletes/${id}/market-value`);
}

// ── ウォッチリスト(C#22) ────────────────────────────────────────────

export interface WatchlistItem {
  id: string;
  athlete_id: string;
  name: string;
  position: string | null;
  sport: string;
  location: string | null;
  latest_total_score: number | null;
  note: string | null;
  tags: string | null;
  created_at: string;
  is_reference_score: boolean;
}

const DEMO_WATCH_KEY = "sportstech_demo_watchlist";

function demoReadWatch(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(DEMO_WATCH_KEY) ?? "[]") as WatchlistItem[];
  } catch {
    return [];
  }
}

function demoWriteWatch(items: WatchlistItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_WATCH_KEY, JSON.stringify(items));
}

export function listWatchlist(): Promise<WatchlistItem[]> {
  if (DEMO) return delay(demoReadWatch());
  return request<WatchlistItem[]>("GET", "/api/scouts/watchlist");
}

export async function addWatchlist(
  athleteId: string,
  note?: string,
  tags?: string
): Promise<WatchlistItem> {
  if (DEMO) {
    const items = demoReadWatch();
    const found = await getAthlete(athleteId);
    const existing = items.find((i) => i.athlete_id === athleteId);
    if (existing) {
      if (note !== undefined) existing.note = note;
      if (tags !== undefined) existing.tags = tags;
      demoWriteWatch(items);
      return delay(existing);
    }
    const item: WatchlistItem = {
      id: `w-${athleteId}`,
      athlete_id: athleteId,
      name: found.name,
      position: found.position,
      sport: found.sport,
      location: found.location,
      latest_total_score: found.latest_total_score,
      note: note ?? null,
      tags: tags ?? null,
      created_at: new Date().toISOString(),
      is_reference_score: true,
    };
    demoWriteWatch([item, ...items]);
    return delay(item);
  }
  return request<WatchlistItem>("POST", "/api/scouts/watchlist", {
    athlete_id: athleteId,
    note,
    tags,
  });
}

export function removeWatchlist(itemId: string): Promise<void> {
  if (DEMO) {
    demoWriteWatch(demoReadWatch().filter((i) => i.id !== itemId));
    return delay(undefined);
  }
  return request<void>("DELETE", `/api/scouts/watchlist/${itemId}`);
}

// ── 保存検索・新着アラート(C#23) ────────────────────────────────────

export interface SavedSearch {
  id: string;
  name: string;
  position: string | null;
  sport: string | null;
  location: string | null;
  min_total_score: number | null;
  last_checked_at: string | null;
  new_count: number;
  created_at: string;
}

const DEMO_SAVED_KEY = "sportstech_demo_saved_searches";

function demoReadSaved(): SavedSearch[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(DEMO_SAVED_KEY) ?? "[]") as SavedSearch[];
  } catch {
    return [];
  }
}

function demoWriteSaved(items: SavedSearch[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_SAVED_KEY, JSON.stringify(items));
}

export function listSavedSearches(): Promise<SavedSearch[]> {
  if (DEMO) return delay(demoReadSaved());
  return request<SavedSearch[]>("GET", "/api/scouts/saved-searches");
}

export function createSavedSearch(input: {
  name: string;
  position?: string;
  sport?: string;
  location?: string;
  min_total_score?: number;
}): Promise<SavedSearch> {
  if (DEMO) {
    const item: SavedSearch = {
      id: `ss-${Date.now()}`,
      name: input.name,
      position: input.position ?? null,
      sport: input.sport ?? null,
      location: input.location ?? null,
      min_total_score: input.min_total_score ?? null,
      last_checked_at: new Date().toISOString(),
      new_count: 0,
      created_at: new Date().toISOString(),
    };
    demoWriteSaved([item, ...demoReadSaved()]);
    return delay(item);
  }
  return request<SavedSearch>("POST", "/api/scouts/saved-searches", input);
}

export function deleteSavedSearch(id: string): Promise<void> {
  if (DEMO) {
    demoWriteSaved(demoReadSaved().filter((s) => s.id !== id));
    return delay(undefined);
  }
  return request<void>("DELETE", `/api/scouts/saved-searches/${id}`);
}

// ── 課金・料金プラン(E#36-38) ─────────────────────────────────────────

export interface Plan {
  tier: "free" | "starter" | "pro" | "enterprise";
  name: string;
  monthly_price_jpy: number | null;
  max_athletes: number | null;
  monthly_analyses: number | null;
  overage_price_jpy: number | null;
  invoice_payment: boolean;
  features: string[];
  description: string;
  highlights: string[];
}

export interface Subscription {
  plan_tier: string;
  plan_name: string;
  status: string;
  billing_type: string;
  analyses_used: number;
  monthly_analyses: number | null;
  analyses_remaining: number | null;
  max_athletes: number | null;
}

const DEMO_PLANS: Plan[] = [
  {
    tier: "free",
    name: "Free",
    monthly_price_jpy: 0,
    max_athletes: 3,
    monthly_analyses: 3,
    overage_price_jpy: null,
    invoice_payment: false,
    features: ["basic_score"],
    description: "まず試すための無料枠。選手3人・分析3本/月まで。",
    highlights: ["選手3人まで", "分析3本/月", "基本スコア＆レーダー"],
  },
  {
    tier: "starter",
    name: "Starter",
    monthly_price_jpy: 9800,
    max_athletes: 20,
    monthly_analyses: 30,
    overage_price_jpy: 300,
    invoice_payment: false,
    features: ["basic_score", "score_history", "compare", "watchlist", "report_export"],
    description: "個人スカウト・小規模スクール向け。比較とレポート出力まで。",
    highlights: ["選手20人まで", "分析30本/月（超過¥300/本）", "比較・レポート出力"],
  },
  {
    tier: "pro",
    name: "Pro",
    monthly_price_jpy: 49800,
    max_athletes: 100,
    monthly_analyses: 200,
    overage_price_jpy: 250,
    invoice_payment: true,
    features: [
      "basic_score",
      "score_history",
      "compare",
      "watchlist",
      "report_export",
      "growth_prediction",
      "saved_search_alert",
      "priority_support",
    ],
    description: "クラブ・スカウト会社向け。成長予測・新着アラート・全分析機能。",
    highlights: [
      "選手100人まで",
      "分析200本/月（超過¥250/本）",
      "成長予測・新着アラート・優先サポート",
    ],
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    monthly_price_jpy: null,
    max_athletes: null,
    monthly_analyses: null,
    overage_price_jpy: null,
    invoice_payment: true,
    features: ["api_access", "sso", "growth_prediction", "saved_search_alert"],
    description: "協会・自治体・大規模クラブ向け。無制限・API/SSO・請求書払い。",
    highlights: ["選手・分析 無制限", "API連携・SSO", "請求書払い・個別サポート"],
  },
];

export function listPlans(): Promise<Plan[]> {
  if (DEMO) return delay(DEMO_PLANS);
  return request<Plan[]>("GET", "/api/billing/plans");
}

// ── デモ用の契約状態ストア（オンボーディングを通しで体験可能にする） ──

const DEMO_SUB_KEY = "sportstech_demo_subscription";

function demoDefaultSub(): Subscription {
  return {
    plan_tier: "free",
    plan_name: "Free",
    status: "active",
    billing_type: "card",
    analyses_used: 1,
    monthly_analyses: 3,
    analyses_remaining: 2,
    max_athletes: 3,
  };
}

function demoReadSub(): Subscription {
  if (typeof window === "undefined") return demoDefaultSub();
  try {
    const raw = window.localStorage.getItem(DEMO_SUB_KEY);
    return raw ? (JSON.parse(raw) as Subscription) : demoDefaultSub();
  } catch {
    return demoDefaultSub();
  }
}

function demoWriteSub(sub: Subscription): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_SUB_KEY, JSON.stringify(sub));
}

function demoActivate(tier: Plan["tier"], billingType: "card" | "invoice"): Subscription {
  const plan = DEMO_PLANS.find((p) => p.tier === tier) ?? DEMO_PLANS[0];
  const used = demoReadSub().analyses_used ?? 0;
  const sub: Subscription = {
    plan_tier: plan.tier,
    plan_name: plan.name,
    status: billingType === "invoice" ? "trialing" : "active",
    billing_type: billingType,
    analyses_used: used,
    monthly_analyses: plan.monthly_analyses,
    analyses_remaining:
      plan.monthly_analyses == null ? null : Math.max(0, plan.monthly_analyses - used),
    max_athletes: plan.max_athletes,
  };
  demoWriteSub(sub);
  return sub;
}

export function getSubscription(): Promise<Subscription> {
  if (DEMO) return delay(demoReadSub());
  return request<Subscription>("GET", "/api/billing/subscription");
}

export interface CheckoutResult {
  checkout_url: string | null;
  mode: "stripe" | "manual" | "demo";
  message: string;
}

/** カード決済のチェックアウト開始（E#37）。 */
export function startCheckout(tier: Plan["tier"]): Promise<CheckoutResult> {
  if (DEMO) {
    demoActivate(tier, "card");
    return delay({
      checkout_url: null,
      mode: "demo",
      message: "デモ環境ではカード決済の成立を模擬し、プランを有効化しました。",
    });
  }
  return request<CheckoutResult>("POST", "/api/billing/checkout", {
    tier,
    success_url: `${window.location.origin}/billing?applied=1`,
    cancel_url: `${window.location.origin}/pricing`,
  });
}

export interface InvoiceRequestInput {
  tier: Plan["tier"];
  company_name: string;
  contact_email: string;
  note?: string;
}

/** 請求書払い（B2B）の申込（E#37）。 */
export function requestInvoice(input: InvoiceRequestInput): Promise<Subscription> {
  if (DEMO) return delay(demoActivate(input.tier, "invoice"));
  return request<Subscription>("POST", "/api/billing/invoice", input);
}

/** デモ専用: 契約を Free に戻す（体験のリセット用）。 */
export function resetSubscriptionDemo(): Promise<Subscription> {
  const sub = demoDefaultSub();
  demoWriteSub(sub);
  return delay(sub);
}

// ── 選手/保護者向け: 閲覧履歴開示(C#30) ──────────────────────────────

export interface ProfileView {
  viewer_role: "scout" | "coach";
  viewed_at: string;
}

export interface ProfileViewSummary {
  total_views: number;
  views_last_30d: number;
  recent: ProfileView[];
}

/** 自分（選手）のカルテを誰(ロール)がいつ閲覧したか。 */
export function getMyProfileViews(): Promise<ProfileViewSummary> {
  if (DEMO) {
    const now = Date.now();
    const day = 86400000;
    const recent: ProfileView[] = [
      { viewer_role: "scout", viewed_at: new Date(now - 1 * day).toISOString() },
      { viewer_role: "scout", viewed_at: new Date(now - 3 * day).toISOString() },
      { viewer_role: "coach", viewed_at: new Date(now - 6 * day).toISOString() },
      { viewer_role: "scout", viewed_at: new Date(now - 12 * day).toISOString() },
      { viewer_role: "scout", viewed_at: new Date(now - 40 * day).toISOString() },
    ];
    return delay({
      total_views: 18,
      views_last_30d: recent.filter((r) => now - Date.parse(r.viewed_at) <= 30 * day).length + 9,
      recent,
    });
  }
  return request<ProfileViewSummary>("GET", "/api/athletes/me/profile-views");
}

// ── 保護者同意・プライバシー(D#32/33/35) ─────────────────────────────

export interface GuardianConsent {
  is_minor: boolean;
  consent_granted: boolean;
  guardian_name: string | null;
  updated_at: string | null;
  video_retention_days: number;
}

const DEMO_CONSENT_KEY = "sportstech_demo_consent";

function demoDefaultConsent(): GuardianConsent {
  return {
    is_minor: true,
    consent_granted: true,
    guardian_name: "保護者 花子",
    updated_at: new Date().toISOString(),
    video_retention_days: 90,
  };
}

export function getGuardianConsent(): Promise<GuardianConsent> {
  if (DEMO) {
    if (typeof window === "undefined") return delay(demoDefaultConsent());
    try {
      const raw = window.localStorage.getItem(DEMO_CONSENT_KEY);
      return delay(raw ? (JSON.parse(raw) as GuardianConsent) : demoDefaultConsent());
    } catch {
      return delay(demoDefaultConsent());
    }
  }
  return request<GuardianConsent>("GET", "/api/athletes/me/consent");
}

export function setGuardianConsent(granted: boolean): Promise<GuardianConsent> {
  if (DEMO) {
    const cur = demoDefaultConsent();
    const next: GuardianConsent = {
      ...cur,
      consent_granted: granted,
      updated_at: new Date().toISOString(),
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DEMO_CONSENT_KEY, JSON.stringify(next));
    }
    return delay(next);
  }
  return request<GuardianConsent>("PATCH", "/api/athletes/me/consent", {
    consent_granted: granted,
  });
}

// ── 商談パイプライン(C#25) / 共有ノート(C#26) / 動画クリップ(C#27) ──

export type ContactStage =
  | "interested"
  | "contacted"
  | "trial"
  | "offer"
  | "signed"
  | "dropped";

export const CONTACT_STAGES: { value: ContactStage; label: string }[] = [
  { value: "interested", label: "注目" },
  { value: "contacted", label: "接触済み" },
  { value: "trial", label: "練習参加" },
  { value: "offer", label: "オファー" },
  { value: "signed", label: "獲得" },
  { value: "dropped", label: "見送り" },
];

export interface Contact {
  id: string;
  athlete_profile_id: string;
  athlete_name: string | null;
  athlete_position: string | null;
  athlete_total_score: number | null;
  stage: ContactStage;
  note: string | null;
  contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

const DEMO_CONTACTS_KEY = "sportstech_demo_contacts";

function demoReadContacts(): Contact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DEMO_CONTACTS_KEY);
    if (raw == null) return demoSeedContacts();
    return JSON.parse(raw) as Contact[];
  } catch {
    return [];
  }
}

function demoWriteContacts(items: Contact[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_CONTACTS_KEY, JSON.stringify(items));
}

/** デモ初期表示用に、検索データから数件のパイプラインを生成 */
function demoSeedContacts(): Contact[] {
  const now = new Date().toISOString();
  const athletes = demoSearch();
  const stages: ContactStage[] = ["interested", "contacted", "trial", "offer"];
  const seeded: Contact[] = athletes.slice(0, 4).map((a, i) => ({
    id: `seed-${a.id}`,
    athlete_profile_id: a.id,
    athlete_name: a.name,
    athlete_position: a.position,
    athlete_total_score: a.latest_total_score,
    stage: stages[i % stages.length],
    note: null,
    contacted_at: null,
    created_at: now,
    updated_at: now,
  }));
  demoWriteContacts(seeded);
  return seeded;
}

export function listContacts(): Promise<Contact[]> {
  if (DEMO) return delay(demoReadContacts());
  return request<Contact[]>("GET", "/api/scouts/contacts");
}

export async function createContact(input: {
  athlete_profile_id: string;
  stage?: ContactStage;
  note?: string;
}): Promise<Contact> {
  if (DEMO) {
    const items = demoReadContacts();
    const found = await getAthlete(input.athlete_profile_id).catch(() => null);
    const now = new Date().toISOString();
    const item: Contact = {
      id: `c-${Date.now()}`,
      athlete_profile_id: input.athlete_profile_id,
      athlete_name: found?.name ?? "選手",
      athlete_position: found?.position ?? null,
      athlete_total_score: found?.latest_total_score ?? null,
      stage: input.stage ?? "interested",
      note: input.note ?? null,
      contacted_at: null,
      created_at: now,
      updated_at: now,
    };
    demoWriteContacts([item, ...items]);
    return delay(item);
  }
  return request<Contact>("POST", "/api/scouts/contacts", input);
}

export function updateContact(
  id: string,
  patch: { stage?: ContactStage; note?: string }
): Promise<Contact> {
  if (DEMO) {
    const items = demoReadContacts();
    const idx = items.findIndex((c) => c.id === id);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...patch, updated_at: new Date().toISOString() };
      demoWriteContacts(items);
      return delay(items[idx]);
    }
    return Promise.reject(new ApiError(404, "not found"));
  }
  return request<Contact>("PATCH", `/api/scouts/contacts/${id}`, patch);
}

export function deleteContact(id: string): Promise<void> {
  if (DEMO) {
    demoWriteContacts(demoReadContacts().filter((c) => c.id !== id));
    return delay(undefined);
  }
  return request<void>("DELETE", `/api/scouts/contacts/${id}`);
}

// ── 共有ノート(C#26) ────────────────────────────────────────────────

export interface AthleteNote {
  id: string;
  author_user_id: string;
  athlete_profile_id: string;
  body: string;
  created_at: string;
}

const DEMO_NOTES_KEY = "sportstech_demo_notes";

function demoReadNotes(): AthleteNote[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(DEMO_NOTES_KEY) ?? "[]") as AthleteNote[];
  } catch {
    return [];
  }
}

function demoWriteNotes(items: AthleteNote[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_NOTES_KEY, JSON.stringify(items));
}

export function listNotes(athleteId: string): Promise<AthleteNote[]> {
  if (DEMO) {
    return delay(
      demoReadNotes()
        .filter((n) => n.athlete_profile_id === athleteId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    );
  }
  return request<AthleteNote[]>("GET", `/api/scouts/notes?athlete_profile_id=${athleteId}`);
}

export function createNote(athleteId: string, body: string): Promise<AthleteNote> {
  if (DEMO) {
    const item: AthleteNote = {
      id: `n-${Date.now()}`,
      author_user_id: "demo",
      athlete_profile_id: athleteId,
      body,
      created_at: new Date().toISOString(),
    };
    demoWriteNotes([item, ...demoReadNotes()]);
    return delay(item);
  }
  return request<AthleteNote>("POST", "/api/scouts/notes", {
    athlete_profile_id: athleteId,
    body,
  });
}

export function deleteNote(id: string): Promise<void> {
  if (DEMO) {
    demoWriteNotes(demoReadNotes().filter((n) => n.id !== id));
    return delay(undefined);
  }
  return request<void>("DELETE", `/api/scouts/notes/${id}`);
}

// ── 動画クリップ(C#27) ──────────────────────────────────────────────

export interface VideoClip {
  id: string;
  video_id: string;
  creator_user_id: string;
  title: string;
  start_sec: number;
  end_sec: number;
  comment: string | null;
  created_at: string;
}

const DEMO_CLIPS_KEY = "sportstech_demo_clips";

function demoReadClips(): VideoClip[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(DEMO_CLIPS_KEY) ?? "[]") as VideoClip[];
  } catch {
    return [];
  }
}

function demoWriteClips(items: VideoClip[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_CLIPS_KEY, JSON.stringify(items));
}

/** デモでは選手の代表動画IDを athlete id から決定論的に導出する */
export function demoVideoIdFor(athleteId: string): string {
  return `demo-video-${athleteId}`;
}

export function listClips(videoId: string): Promise<VideoClip[]> {
  if (DEMO) {
    return delay(
      demoReadClips()
        .filter((c) => c.video_id === videoId)
        .sort((a, b) => a.start_sec - b.start_sec)
    );
  }
  return request<VideoClip[]>("GET", `/api/scouts/videos/${videoId}/clips`);
}

export function createClip(
  videoId: string,
  input: { title: string; start_sec: number; end_sec: number; comment?: string }
): Promise<VideoClip> {
  if (DEMO) {
    const item: VideoClip = {
      id: `clip-${Date.now()}`,
      video_id: videoId,
      creator_user_id: "demo",
      title: input.title,
      start_sec: input.start_sec,
      end_sec: input.end_sec,
      comment: input.comment ?? null,
      created_at: new Date().toISOString(),
    };
    demoWriteClips([...demoReadClips(), item]);
    return delay(item);
  }
  return request<VideoClip>("POST", `/api/scouts/videos/${videoId}/clips`, input);
}

export function deleteClip(id: string): Promise<void> {
  if (DEMO) {
    demoWriteClips(demoReadClips().filter((c) => c.id !== id));
    return delay(undefined);
  }
  return request<void>("DELETE", `/api/scouts/clips/${id}`);
}
