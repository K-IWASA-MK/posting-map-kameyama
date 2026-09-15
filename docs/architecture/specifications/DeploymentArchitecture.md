# Specification: Deployment Architecture

Version: 1.6.0 (Brand Unification Approved)
Status: APPROVED
Author: POSTING MAP DevOps & Architecture Department
Target System: POSTING MAP / FIELD OPERATIONS OS

---

## 1. Overview

本仕様書は、全国 289 支部のクライアントへ POSTING MAP を安定展開・配信するためのデプロイ基盤、Git リモート運用規定、GitHub Pages ビルド・デプロイ パイプライン、およびマルチクライアント分離構造（Case C 方針）を統一定義する。

---

## 2. Multi-Tenant Deployment Architecture (Case C Policy)

本システムは、コードベースの肥大化と重複保守を防ぐため、**「1つの共通コードベース」＋「動的クライアント設定 (Case C 方針)」** で運用する。

```
posting-map-system/
├── active/
│   └── dashboard/
│       ├── index.html        ← 全クライアント共通 App 本体
│       ├── client-loader.js  ← クライアント設定動的ローダー
│       └── clients/
│           ├── MIE-03/config.js  ← 三重第3区 設定ファイル
│           ├── TOKYO-01/config.js
│           └── OSAKA-01/config.js
```

### 2.1. Client Configuration Partitioning
- 共通コード (`index.html` / `app.js` / `render.js`) には特定の地区コード・LIFF ID・API URL を直接ハードコーディングしない。
- `client-loader.js` が URL パラメータまたはドメイン構造を解析し、適切な `clients/[DISTRICT_ID]/config.js` を動的に読み込む。

---

## 3. Git Remote Operation Rules (Strict Protocol)

本プロジェクトでは、開発環境と本番安定版環境の誤更新を防止するため、Git リモートの役割を厳格に分離する。

```
                       Local Workstation
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   origin-dev (Dev Remote)               origin (Prod Backup)
 (K-IWASA-MK/posting-map-system-dev)   (area-management/posting-map-system)
   [Push Target: Daily Dev]               [Strict Read-Only / Release Target]
```

| リモート名 | リポジトリ URL | 開発・デプロイ運用ルール |
| :--- | :--- | :--- |
| **`origin-dev`** | `https://github.com/K-IWASA-MK/posting-map-system-dev.git` | **日常の開発・変更プッシュ先**。`git push origin-dev HEAD:main` で即時デプロイ。 |
| **`origin`** | `https://github.com/area-management/posting-map-system.git` | **本番安定版バックアップ**。手動許可なしでの直接 `push` は厳禁。 |

---

## 4. GitHub Pages Build & Delivery Pipeline

### 4.1. Static Delivery Rules
1. **`.nojekyll` File Requirement**:
   - リポジトリルートに `.nojekyll` ファイルを常時配置する。
   - Jekyll ビルドエンジンを強制バイパスし、`active/dashboard/index.html` 以下の全静的ファイルをそのまま生ファイルとして静的配信する。
2. **Root Entry Point (`/index.html`)**:
   - リポジトリルート `/index.html` に、`active/dashboard/index.html` への高速リダイレクト HTML を配置する。

### 4.2. Production Domain Routing
販売環境では、すべての静的配信は `https://app.posting-map.jp/` を起点とし、リクエストは `app.posting-map.jp/active/dashboard/index.html` へマッピングされる。

### 4.3. PWA & Asset Cache Bashing
- アイコン・静的アセット・CSS の読み込み時は、バージョンクエリパラメータ（例: `?v=73`）を付与し、ブラウザおよび LINE ブラウザの強力なキャッシュによる更新遅延を防止する。
- Service Worker (`service-worker.js`) は、バージョン更新検知時に古いキャッシュを自動削除し、即時リフレッシュを行う。
