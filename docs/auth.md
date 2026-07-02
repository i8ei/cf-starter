# 認証（AUTH_MODE）

> 要点・不変条件は CLAUDE.md 本体にある。ここは各モードの設定詳細・エンドポイント・DB スキーマ・無効化手順。

`AUTH_MODE` 環境変数で認証方式を切り替える。未設定時のデフォルトは `better-auth`。
後方互換: `AUTH_ENABLED=false` は `AUTH_MODE=none` と同等。

| モード | 用途 | 認証方式 | DB認証テーブル |
|--------|------|----------|---------------|
| `none` | 公開アプリ | なし（mockユーザー） | 不要（存在はする） |
| `simple-admin` | 管理画面 | ADMIN_PASSWORD | 不要（存在はする） |
| `better-auth` | フルユーザー管理 | DB session | 必要 |

## none モード

```jsonc
// wrangler.jsonc
"AUTH_MODE": "none"
```
- `PublicShell`（モバイルファースト1カラム）を自動選択
- `app/App.tsx` の `publicNavItems` にナビを定義
- API は `/api/public/*` に GET-only ルートを追加
- userId="1", orgId="default-org" が固定でセットされる

## simple-admin モード

```jsonc
// wrangler.jsonc
"AUTH_MODE": "simple-admin"
// .dev.vars（ローカル） / wrangler secret（本番）
ADMIN_PASSWORD=changeme
```
- パスワード1つで管理画面にログイン（ユーザー登録なし）
- HMAC署名Cookie（DBセッション不要）
- `/api/auth/admin-login` でログイン、`/api/auth/me` `/api/auth/logout` は共通
- signup / password-reset / email-verification は 404
- userId="1", orgId="default-org" 固定（`seed:demo` が必要）

## better-auth モード（デフォルト）

```jsonc
// .dev.vars（ローカル） / wrangler secret（本番）
BETTER_AUTH_SECRET=change-me-to-a-random-string
```
- [Better Auth](https://better-auth.com/) によるフルユーザー認証
- エンドポイント: `/api/auth/sign-up/email`, `/api/auth/sign-in/email`, `/api/auth/sign-out` 等（Better Auth 内蔵）
- カスタムエンドポイント: `/api/auth/me`（ユーザー+組織情報）, `/api/auth/logout`
- 組織操作: `/api/auth/organization/*`（Better Auth org プラグインが全ハンドル。自作の org ルートは不要）
- DBセッション + Cookie（`ba.session_token` / Secure時 `__Secure-ba.session_token`）
- admin() プラグインで `user.role` カラムによるロール管理
- パスワードリセット・メール検証は Better Auth が内蔵処理

## パブリックページ（認証不要）

`/p/*` プレフィックスで認証不要のページを配置できる。

- **フロント**: `app/App.tsx` の `Switch` 先頭（AuthGuard の外）に `<Route path="/p/xxx">` を追加
- **バック**: `src/index.ts` に `requireAuth` なしのルートを `.route("/api/public/xxx", publicRoutes)` で登録
- CSRF は GET のみなので問題なし（POST 以降は Origin/Referer 検証がかかる）
- サンプル: `src/routes/public-example.ts`（GET-only APIルートの雛形。不要なら削除）

## 認証を使わない場合

`AUTH_MODE=none`（または `AUTH_ENABLED=false`）で実行時無効化できる。
物理削除は不要 — コードは残るが実行されない。ビルドサイズへの影響も無視できる。

`AUTH_MODE=none` / `simple-admin` の場合、userId="1", orgId="default-org" が固定でセットされる。

**重要**: `seed:demo` を実行してデモ組織（id="default-org"）を作成すること。
seed:demo はべき等（何度実行しても安全）。

## 型安全な権限チェック

```ts
// UserRole = "user" | "admin"（src/types.ts で定義）
// OrgRole  = "owner" | "admin" | "member"

import { requireRole } from "../middleware/require-role";
import { requireOrgRole } from "../middleware/require-org-role";

app.delete("/admin/users/:id", requireRole("admin"), async (c) => { ... });
app.post("/projects", requireOrgRole(["owner", "admin"]), async (c) => { ... });
```

タイポ（例: `requireRole("admi")`）はコンパイルエラーになる。

## DB スキーマ

Better Auth テーブル（単数形、text ID）:
- `user` — ユーザー（id, email, name, role, emailVerified, ...）
- `session` — セッション（token, expiresAt, userId, activeOrganizationId, ...）
- `account` — 認証アカウント（providerId, password, ...）
- `verification` — 検証トークン
- `organization` — 組織（org プラグイン）
- `member` — 組織メンバーシップ（org プラグイン）
- `invitation` — 組織招待（org プラグイン）

アプリテーブル:
- `audit_logs` — 監査ログ（integer PK、actorUserId/organizationId は text FK）

**ID 型**: userId, orgId は全て `string`（text）。
