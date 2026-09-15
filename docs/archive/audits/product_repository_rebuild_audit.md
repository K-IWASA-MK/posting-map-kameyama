# POSTING MAP Product Repository Rebuild Audit Report

**Date**: 2026-08-01  
**Target SSOT**: `/Volumes/SSD_DATA/posting-map-backup`  
**Audit Scope**: Read-Only Audit for Product Repository v1.0 Rebuild  
**Status**: Completed  

---

## 1. Executive Summary

本レポートは、`posting-map-backup` ディレクトリ（`/Volumes/SSD_DATA/posting-map-backup`）を唯一の Single Source of Truth (SSOT) とし、POSTING MAP を過去の AIOS モノレポ構造から完全に分離した「純粋な商品リポジトリ」としてゼロから再構築するにあたって、事前に行った Fact-based Read-Only Audit の結果を記録したものです。

監査の結果、`posting-map-backup` の本番コードベース（`active/`）およびマスターデータ（`data/`）は商品リポジトリ v1.0 の核として極めて完成度が高く、そのまま新リポジトリの初期ベースとして採用可能であることを確認しました。

---

## 2. Directory Inventory (Audit-1)

`posting-map-backup` の全構成（Top Level Tree）の棚卸し結果は以下の通りです。

### 2.1 Top Level Tree Overview

```text
/Volumes/SSD_DATA/posting-map-backup/
├── .clasp.json                  # GAS Deploy設定 (rootDir: "./active")
├── .clasp.json.bak              # バックアップ設定ファイル
├── .clasp.json.prod             # 本番用設定ファイル
├── .clasp.mie03.json            # MIE-03個別用設定ファイル
├── .claspignore                 # clasp 除外設定
├── .clasprc.json.local.bak      # clasp 認証情報ローカルバックアップ
├── .git/                        # 旧 Git 履歴（新リポジトリ作成時は継承せず）
├── .gitignore                   # Git 除外設定
├── .nojekyll                    # GitHub Pages 表示制御
├── AGENTS.md                    # リポジトリガバナンスルール (Root)
├── DEPLOYMENT_REGISTRY.md       # 本番 Deployment ID / URL SSOT
├── _config.yml                  # GitHub Pages 設定
├── active/                      # 【Rule-1】唯一の本番コードベース
├── appsscript.json              # ルート側 Apps Script 設定 (※不整合あり)
├── data/                        # 【Rule-1】SSOT マスターデータ & 空間データ
├── docs/                        # 【Rule-1】仕様書・アーキテクチャ・監査レポート
├── manifest.json                # PWA マニフェストファイル
├── package.json                 # Node package 設定 (@kiwasa/posting-map)
├── scripts/                     # 【Rule-1】開発・検証・運用補助スクリプト
├── tests/                       # 【Rule-1】テストコード
└── walkthrough.md               # パイプライン構築・移行作業ログ
```

### 2.2 Rule-1 5-Directory Compliance Check
Repository Freeze v1.0 Rules に規定された 5 ディレクトリ（`active/`, `data/`, `docs/`, `scripts/`, `tests/`）はすべて存在し、正しい構造で配置されていることを確認しました。

---

## 3. Product Asset Inventory & Audit-3 Key File Evaluation

主要 6 ファイルおよび本番資産の評価結果は以下の通りです。

| ファイル名 | 存在確認 | 状態・内容評価 | 注意事項・改修推奨事項 |
| :--- | :---: | :--- | :--- |
| **`AGENTS.md`** | ✅ | ルートガバナンスルール記載済み | Line 28 に `projects/posting-map/data/MIE03_ADDRESS_MASTER_858.csv` という旧モノレポ時のパス記述あり |
| **`package.json`** | ✅ | `@kiwasa/posting-map` v1.0.0 定義 | 正常 |
| **`appsscript.json`** | ⚠️ 二重 | ルート直下および `active/` 直下に存在 | ルート側はタイムゾーン `America/New_York` かつスコープ未定義。`.clasp.json` の `rootDir` は `./active` のため、ルート側は無効・不要ファイル |
| **`manifest.json`** | ✅ | PWAマニフェスト (ポスティング・プロ) | 正常 |
| **`DEPLOYMENT_REGISTRY.md`**| ✅ | MIE-03 Script ID / Deployment ID SSOT | 一部「AI社員」等の用語記述あり |
| **`walkthrough.md`** | ✅ | Order-to-Branch 自動化構築ログ | 過去の移行作業記録 |

### 主要モジュール構造 (`active/`)
- `active/api/`: API層 Facade
- `active/business/`: Area, Flyer, GPS 等のドメインサービス
- `active/dashboard/`: UI コンポーネントおよび HTML
- `active/gas/`: Google Apps Script エントリーポイント
- `active/infrastructure/`: SSOT データアクセサー
- `active/platform/`: LINE LIFF / Web Platform 統合
- `active/runtime/`: アプリケーションランタイム (許可対象)

---

## 4. AIOS Contamination Check (Audit-2)

### 4.1 Root Directory Anti-AIOS Rules Check (Rule-3)
Rule-3 (Permanent Anti-AIOS Contamination Rule) に基づき、禁止対象のトップレベルディレクトリを検証しました。

- `/agents` : ❌ 不在 (合格)
- `/skills` : ❌ 不在 (合格)
- `/knowledge` : ❌ 不在 (合格)
- `/AI社員` : ❌ 不在 (合格)
- `/runtime` : ❌ 不在 (合格 ※`active/runtime/` のみ存在)

### 4.2 Legacy Artifacts & File Contamination Findings
トップレベルには禁止ディレクトリは存在しませんが、以下の箇所に旧 AIOS モノレポ時代のドキュメント・エージェント実行管理ファイルが残存しています。

1. **`docs/AGENTS.md` (96KB)**:
   - ルートの `AGENTS.md` (4.9KB) とは別に、`docs/` 配下に「AI組織 運用規範書」という大容量ドキュメントが存在。
2. **Agent Execution Files in `docs/`**:
   - `docs/execution_ledger.json`
   - `docs/schedules.json`
   - `docs/work_queue.json`
   - `docs/workflows.json`
   - これらは AIOS / エージェントランタイムが作業状態を保存していた残存ファイル。
3. **Local Environment Backup Files in Root**:
   - `.clasp.json.bak`, `.clasp.json.prod`, `.clasp.mie03.json`, `.clasprc.json.local.bak` などのローカル環境バックアップ。

---

## 5. Repository Readiness (Audit-4)

**判定: POSTING MAP 商品リポジトリ v1.0 のベースとして【採用可能】**

### 根拠:
1. `active/` 配下の本番コードおよび `data/` 配下の MIE-03 住所マスターデータ（858件）は完全に機能的であり、単独のプロダクトとして独立動作する準備が整っている。
2. Rule-1 のトップレベル 5 ディレクトリ構造が維持されている。

### 公開前に推奨されるクリーンアップ（Initial Commit 準備）:
新 GitHub リポジトリを作成して Initial Commit を行う際、以下の調整を行うことで、より純粋かつクリーンな商品リポジトリ v1.0 となります。
- 重複・無効なルート直下の `appsscript.json` のクリーンアップ。
- ルート `AGENTS.md` 内の旧パス表記（`projects/posting-map/data/...` → `data/...`）の補正。
- `docs/` 配下の AIOS 残骸ファイル（`docs/AGENTS.md`, `execution_ledger.json` 等）およびルートの `.bak` 設定ファイルの整理。

---

## 6. Risks

1. **デプロイ設定の誤認リスク**:
   - ルート直下の `appsscript.json` と `active/appsscript.json` の内容が異なっており、clasp 設定を誤ると意図しない設定でデプロイされるリスク。
2. **履歴紛れ込みリスク**:
   - 既存の `.git` 履歴を誤って引き継いで push した場合、過去のモノレポ履歴や旧ブランチ情報が商品リポジトリに混入するリスク（新規 `git init` による断絶が必須）。

---

## 7. Recommendation

1. **SSOT の確定**:
   - `/Volumes/SSD_DATA/posting-map-backup` を正式な商品リポジトリ v1.0 再構築用の唯一のソースコードベースとして確定する。
2. **Implementation Plan の策定**:
   - 「POSTING MAP Product Repository v1.0 Initial Repository Creation」に向けた具体手順（Git init, 軽微なクリーンアップ, 初回コミット, GitHub リポジトリ作成手順）を Implementation Plan に定義する。
