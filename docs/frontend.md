# フロントエンド アーキテクチャ

> 認証・ルーティングの**不変条件**は CLAUDE.md 本体にある。ここは詳細な起動フロー・hook 依存・API クライアント契約。

## 起動フロー

```
QueryClientProvider
  └─ ErrorBoundary
       └─ AppRoutes (wouter Switch)
            ├─ /p/* ── 認証不要ページ（AuthGuard の外）
            └─ /* ── AuthGuard
                      ├─ useHealth() で authMode 取得
                      ├─ authMode=none     → PublicShell（useSession 呼ばない）
                      └─ authMode=other    → AuthShell
                                              ├─ useSession() でログイン確認
                                              ├─ 未ログイン → AuthPage
                                              ├─ better-auth かつ組織未所属 → OrgGate
                                              │    （所属0件なら組織作成画面）
                                              └─ ログイン済 → AppShell + children
```

## Shell 選択

| authMode | Shell | ナビ定義 |
|----------|-------|---------|
| `none` | `PublicShell` | `publicNavItems` |
| `simple-admin` | `AppShell` | `recordNavItems` |
| `better-auth` | `AppShell` | `recordNavItems` |

## Hook 依存ツリー

```
useHealth()         ← /api/health（authMode 判定、常に呼ばれる）
useSession()        ← /api/auth/me（authMode≠none のときだけ）
  useSignup()       ← Better Auth sign-up
  useLogin()        ← Better Auth sign-in
  useAdminLogin()   ← simple-admin パスワード認証
  useLogout()       ← セッション破棄
```

## API クライアント契約

```ts
// app/lib/api.ts
import { hc } from "hono/client";
import type { AppType } from "@server/index";

export const client = hc<AppType>("/", {
  fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
});
```

- `hc<AppType>` で型安全 RPC。バックエンドのルート定義が変われば型エラーで検知
- `credentials: "include"` で Cookie を自動送信（認証に必要）
- TanStack Query の `queryFn` 内で `client.api.xxx.$get()` / `$post()` を呼ぶ

## ルート規約

| パス | 用途 | AuthGuard |
|------|------|-----------|
| `/p/*` | 公開ページ（認証不要） | 外 |
| `/:record` | Record Engine 一覧 | 内 |
| `/:record/new` | Record Engine 新規作成 | 内 |
| `/:record/:id` | Record Engine 詳細 | 内 |
| `/:record/:id/edit` | Record Engine 編集 | 内 |
| `/invite?id=<invitationId>` | 招待受諾（セッション必須） | 内 |
| `/settings` | 組織設定 | 内 |
| `/` | ホーム | 内 |

- 未ログイン時 → AuthPage をインライン表示（専用 `/login` ルートはない）
- `/invite` は AuthGuard 内。Better Auth の `acceptInvitation` はセッション必須のため、未ログインならログイン画面が先に出る（email link → AuthGuard → login → InvitePage → accept）

## dev:split モード（認証フリッカー回避）

`@cloudflare/vite-plugin` の統合 dev モードで、Cookie ベースの認証フローがフリッカー（画面チラつき・無限リロード）する場合がある。原因はプラグインのリクエスト処理順。

`npm run dev:split` を使うと Vite と wrangler が分離起動し、`/api/*` はプロキシで中継される（`vite.config.split.ts`）。ビルド・デプロイは統合プラグインのままなので本番に影響はない。

- 通常: `npm run dev`（シンプル、認証なしなら問題なし）
- 認証あり: `npm run dev:split`（フリッカーする場合はこちら）
