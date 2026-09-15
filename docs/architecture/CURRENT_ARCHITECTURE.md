# POSTING MAP — 現行アーキテクチャ定義書
*(Current Architecture Specification)*

本書は、POSTING MAPの現行アーキテクチャを定義する**公式正本文書**である。  
AI社員および開発者は、すべての設計・改修・検証・新地区展開において本書を最上位の技術的拠り所としなければならない。

---

## 1. 最上位原則 (Supreme Principles)

### ① 単独アプリ・単独リポジトリ (Standalone Application & Standalone Repository)
- POSTING MAPは、マルチテナント型や複数地区を単一コードで抱え込むモノリシックシステムではない。
- **「1地区 = 1独立リポジトリ = 1独立アプリケーション = 1独立本番環境（DB・GAS・LIFF）」** を絶対原則とする。
- 地区間のクロス参照、共通ブランチ、コード共有、リポジトリ結合は一切存在しない。

### ② 共通エンジンと地区データの完全分離 (Universal Engine vs. District Data)
- **`active/` = 地区非依存 Universal Engine**
  - 全地区で100%同一の実行プログラム（JavaScript / HTML / CSS / Standalone GAS）。
  - 地区固有のコード改変を永久に禁止する（SHA-256ハッシュ完全固定）。
- **`data/` = 地区固有データ & 設定 (District Data & Config)**
  - 地区の住所マスター、境界GeoJSON、自治体定義、クライアント接続情報が集約される唯一のデータ領域。

### ③ 新地区展開モデル (COPY → data/交換)
- 汎用POSTING MAPリポジトリを丸ごと複製（COPY）し、`data/` 配下の確定データ一式を新地区用に交換することで、新たな独立アプリケーションとして成立・稼働させる。
- 複製後に `active/` 配下のプログラムを1行も改変してはならない。

---

## 2. システム構成と責務境界 (System Architecture)

```text
┌──────────────────────────────────────────────────────────────────┐
│                     POSTING MAP 独立インスタンス                  │
│                                                                  │
│  ┌────────────────────────┐          ┌────────────────────────┐  │
│  │   Hアプリ (配布員UI)    │          │  Dashboard (管理者UI)  │  │
│  │  active/dashboard/     │          │  active/manager/       │  │
│  └───────────┬────────────┘          └───────────┬────────────┘  │
│              │ (静的読込)                         │ (静的読込)     │
│              ▼                                   ▼               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     data/ (地区固有領域)                    │  │
│  │  ・address_master.csv      ・boundaries.geojson            │  │
│  │  ・municipality_master.csv  ・config.js                     │  │
│  │  ・area_mapping.json                                       │  │
│  └───────────────────────────┬────────────────────────────────┘  │
│                              │ API通信 (POST / JSON)             │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           Standalone Google Apps Script (APIサーバー)       │  │
│  │  active/api/ , active/business/                             │  │
│  │  ※ Script Properties から接続情報を動的解決                  │  │
│  └───────────────────────────┬────────────────────────────────┘  │
│                              │ Sheets API                        │
│                              ▼                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                               ▼ 外部独立クラウド
              ┌──────────────────────────────────┐
              │     Google Spreadsheet (Pure DB) │
              │     ※ 12シート / コード内包ゼロ    │
              └──────────────────────────────────┘
```

### 1. Hアプリ (配布員用モバイルUI: `active/dashboard/`)
- LINE LIFF または スマートフォンWebブラウザ上で動作するポスティング配布員専用のUI。
- 地区の町丁目ピン、境界ポリゴン、配布進捗ステータスを `data/` および GAS API から動的取得して描画。
- 接続情報は `data/config.js` を唯一の参照先とし、コード内にURL等のハードコードを持たない。

### 2. Dashboard (統括管理者用UI: `active/manager/`)
- PC/タブレット向けの進捗管理・チラシ在庫・配布員名簿・受渡要請の統括管理画面。
- `data/address_master.csv`、`data/municipality_master.csv`、`data/boundaries.geojson` を動的解析して表示。
- 接続情報は `data/config.js` を唯一の参照先とする。

### 3. API (共通バックエンドロジック: `active/api/`, `active/business/`)
- Standalone GAS 上で稼働する共通REST/RPC風APIサーバー。
- 認証、進捗集計、受渡要請、在庫管理、名簿管理を実行し、Spreadsheet（Pure DB）へアクセス。

### 4. Spreadsheet = Pure DB (純粋データベース)
- スプレッドシートは **「純粋なデータベース（データ層）」** としてのみ存在する。
- プログラムコード（スクリプト）、独自マクロ、トリガー関数は一切内包しない。
- 12シート構造（`SYSTEM_INFO`, 原本シート群5種, YYYY-MMシート群5種, `ポスティング進捗状況`）。

### 5. GAS = Standalone only (独立APIサーバー)
- Google Apps Script はスプレッドシートから完全に切り離された **「スタンドアロンプロジェクト」** として作成・配備する。
- 接続先スプレッドシートIDやDriveフォルダIDは、デプロイ時に `PropertiesService.getScriptProperties()` へ外部注入する（ハードコード禁止）。

### 6. Container-bound GAS = 現行アーキテクチャ外 (廃止・絶対禁止)
- スプレッドシートに付随するコンテナバウンドGAS（拡張機能 → Apps Script）は、現行アーキテクチャ外のレガシー残骸である。
- コンテナバウンドGASの作成、復元、同期、依存、編集は永久に禁止する。

### 7. 認証 / LINE LIFF (`active/api/auth/`)
- Hアプリは LINE LIFF ID Token による本人確認・セッション管理。
- 管理者画面はセッション認証（パスワード / トークン）。

---

## 3. 地区データの境界 (data/ 仕様)

新地区展開時に交換・初期化するファイルは、原則として以下の **`data/` 配下5ファイル** に集約される：

| ファイルパス | 役割 | 新地区展開時の扱い |
|---|---|---|
| `data/address_master.csv` | 町丁目・座標データ（SSOT） | 新地区の国勢調査町丁目データで**全数交換** |
| `data/boundaries.geojson` | 町丁目境界GeoJSON（MultiPolygon対応） | 新地区のGeoJSONで**全数交換** |
| `data/municipality_master.csv` | 地区を構成する自治体一覧 | 新地区の自治体一覧で**全数交換** |
| `data/config.js` | クライアント公開設定 (`gasWebAppUrl`, `liffId`) | 汎用時は空テンプレート、新地区デプロイ時に**同期・生成** |
| `data/area_mapping.json` | 過去エリアからの集約マッピング | 新地区立ち上げ時は **空配列 `[]` に初期化** |

> **注記（外部データ生成ツールについて）**:  
> 国勢調査データ（e-Stat Shapefile）から上記マスターを生成するETLツールは、実行エンジン（`active/`）に含めず、データ調達用の独立ツール（`scripts/` 等）として分離管理する。

### 地区固有データの正式移行完了 (`data/election_history.json`)

衆院選・参院選投票率データ（`election_history.json`）の配置・参照方式については、Target Districtホワイトリスト方式の確立に伴い、以下の通り正式移行が完了した：

1. **地区固有データとしての一元化**:
   - `election_history.json` は地区固有データであるため、`docs/` から `data/election_history.json` へ正式移行完了。
2. **Universal Engineにおける動的パス解決への統一**:
   - `active/manager/manager.js` における旧レガシーパス直書き（`/docs/`）を廃止。
   - `data/config.js` の `staticMaster.electionHistoryFilename` および `fetchStaticDataFile` を用いた動的解決方式に統一された。
3. **データ層品質ゲート（Rule-06）での全数監査**:
   - `validate-district-data-gate.mjs` のホワイトリスト監査対象に `election_history.json` を追加。
   - 自治体キー（`municipalities`）が `data/municipality_master.csv`（SSOT）と100%一致することが機械判定される。

---

## 4. 外部リソースとデプロイメントメタデータ

### 1. 外部独立リソース (External Resources)
新地区を立ち上げる際、外部クラウド上に以下の独立リソースを新規作成する：
1. **Googleスプレッドシート**: タイトルを新地区ID（例: `MIE-KAMEYAMA`）として新規作成（Pure DB）。
2. **Google Driveフォルダ**: 新地区の写真保存用フォルダを作成。
3. **LINE Developers**: 新地区専用チャネルにて LIFF アプリを発行。
4. **Standalone GAS プロジェクト**: `clasp create --type standalone` で新規作成。

### 2. Deployment Metadata (`deployment.json`)
- 新地区の外部リソース物理ID（`districtId`, `spreadsheetId`, `storageFolderId`, `webAppUrl`, `liffId`）を保持するローカル管理台帳。
- Git追跡からは除外され、テンプレート `deployment.template.json` のみがリポジトリに保持される。
- ブラウザやGAS実行エンジンはこのファイルを直接読まない（`data/config.js` および `Script Properties` への同期元としてのみ機能）。

---

## 5. 新地区展開の不可侵原則 (District Deployment Invariants)

新地区展開プロセスにおいて、以下の原則はいかなる例外もなく遵守されなければならない：

1. **`active/` ゼロ改変原則**:  
   COPYおよび新地区データ投入後、`git diff active/` は常に 0 バイトであり、全 54 ファイルの SHA-256 ハッシュは 100% 一致しなければならない。
2. **リポジトリ完全独立原則**:  
   親機リポジトリとの Git 共有、他地区ブランチの作成、クロス地区マージは絶対禁止。
3. **本番リソース完全遮断原則**:  
   他地区のスプレッドシート、GAS、Drive、LIFFへのアクセス・参照・誤爆を物理的に遮断する。
