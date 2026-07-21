# 本番バックエンド接続ガイド（DEMO → 実データ）

このフロントは 2 モードで動作します。

- **DEMO モード**（既定・営業デモ用）: `NEXT_PUBLIC_DEMO=1`。バックエンド不要。
  組み込みデータ＋localStorage で全画面が動作します。
- **本番モード**: `NEXT_PUBLIC_DEMO` を未設定にし、`NEXT_PUBLIC_API_URL` を
  デプロイ済み API のオリジンに向けると、実データ・実認証に切り替わります。

---

## 1. 環境変数

| 変数                  | DEMO           | 本番                                      |
| --------------------- | -------------- | ----------------------------------------- |
| `NEXT_PUBLIC_DEMO`    | `1`            | 未設定（または `0`）                       |
| `NEXT_PUBLIC_API_URL` | 不要           | 例: `https://api.sports-tech.example.com` |

Vercel の Project → Settings → Environment Variables で設定し、再デプロイします。

## 2. バックエンド（sports-tech リポジトリ）の準備

1. Postgres を用意（例: Supabase / RDS）し `DATABASE_URL` を設定。
2. Redis を用意し `REDIS_URL` を設定（Celery 用）。
3. マイグレーション適用: `alembic upgrade head`（0001〜0009）。
4. API 起動: `uvicorn app.main:app`（ASGI）。Celery worker と beat も起動。
5. CORS: `app/main.py` の `allow_origins` を本番ドメインに制限する（現状 `*`）。

## 3. 認証（本実装のポイント）

- フロントは `Authorization: Bearer <token>` を自動付与し、
  **401 を受けるとトークンを破棄してログインへリダイレクト**します
  （`src/lib/api.ts` の `handleUnauthorized`）。ログイン後は `?next=` で元の画面へ復帰。
- ログアウトは `logout()`（`/api/auth/logout` 通知＋トークン破棄）。
- 現状の `/api/auth/login` はメール識別の簡易実装。**本番は Supabase Auth** に置き換え、
  Supabase の発行する JWT を検証する構成へ移行する（`app/routers/auth.py` の Note 参照）。
  移行時は `getToken`/`setToken` を Supabase セッションに合わせて差し替える。

## 4. 実データで動く画面と、要追加のAPI

| 画面 | 使用 API | 状態 |
| ---- | -------- | ---- |
| スカウト検索/カルテ/比較 | `/api/scouts/*` | ✅ 実装済み |
| 深掘り分析・類似・市場価値 | `/api/scouts/athletes/{id}/*` | ✅ |
| 商談/ノート/クリップ | `/api/scouts/contacts|notes|videos/*` | ✅ |
| 料金・申込・請求書払い | `/api/billing/*` | ✅（カードは Stripe 鍵設定で有効化） |
| 選手 閲覧履歴/同意 | `/api/athletes/me/profile-views|consent` | ✅ |
| 選手マイpage 成長サマリ | `/api/athletes/me/scores` | ⛔ 未実装（現状はデモの公開選手データを表示） |

> 選手本人の成長サマリを実データ化する場合は、バックエンドに
> `GET /api/athletes/me/scores`（本人のみ・公開/同意チェックをバイパス）を追加する。

## 5. Stripe（カード決済）

- `STRIPE_SECRET_KEY` を設定すると `/api/billing/checkout` が Checkout Session を返し、
  フロントは自動で Stripe へ遷移します（未設定時は請求書払いへフォールバック）。
- Webhook `POST /api/billing/webhook` を Stripe に登録し、`STRIPE_WEBHOOK_SECRET` で署名検証。

## 6. 切替チェックリスト

- [ ] `NEXT_PUBLIC_DEMO` を外し `NEXT_PUBLIC_API_URL` を設定
- [ ] バックエンドをデプロイ・マイグレーション適用・CORS 制限
- [ ] Supabase Auth 連携（本番認証）
- [ ] Stripe 鍵・Webhook 設定（カード決済を使う場合）
- [ ] `GET /api/athletes/me/scores` 追加（選手マイページを実データ化する場合）
