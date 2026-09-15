# 実証記録: [record-005] POSTING MAP 住所マスターCSV (address_master.csv) 正式テンプレート仕様書

- **記録種別**: Live Verification / Template Specification Record
- **実施日時**: 2026-09-07 11:13 〜 11:15 JST
- **記録担当**: district-deployment-recorder
- **実務担当**: Flash (AI)
- **指揮・判断**: MASTER (人間)

---

## 1. 基本情報
- **目的**: 地区展開を開始する前に、POSTING MAPで使用する住所マスターCSV (`address_master.csv`) の正式な入力データ契約（スキーマ、型、制約、検証ルール）を現行システムコードから確認・確定する。
- **対象ディレクトリ**: `/Volumes/SSD_DATA/posting-map-mie-03-clone/`
- **検証ステータス**: `[検証済PASS]`（現行システムの全参照箇所を照合し仕様を完全確定）

---

## 2. 現行システムとの照合結果（コード上の事実）

現行コードを精査し、各コンポーネントが実際に期待している列・型・意味を特定した。

| ファイル | 参照・利用箇所 | 期待する列 / プロパティ | 処理内容 |
| :--- | :--- | :--- | :--- |
| `active/business/area/address_master_service.js` | `parseCsv(text)` (L30-38) | `[0] Number`, `[1] string`, `[2] string`, `[3] Number`, `[4] Number` | `cols.length >= 5` でパースし、`rowId`, `city_name`, `town_name`, `latitude`, `longitude` オブジェクトを生成。 |
| `active/business/area/address_master_service.js` | `getCities`, `getTowns`, `findByRowId`, `search` | `city_name`, `town_name`, `rowId` | 自治体集計、町域抽出、`rowId` 直引き検索、キーワード部分一致検索を提供。 |
| `scripts/provision-district.mjs` | `main()` (L26-46) | `rowId`, `city_name`, `town_name` | ヘッダー名で列インデックスを特定し、スプレッドシート投入用配列 `{ rowId, cityName, townName }` を構築。 |
| `active/business/system/district_provisioner.js` | `createDistributionMaster` (L264-269) | `rowId`, `cityName/city_name`, `townName/town_name` | スプレッドシート「配布実績の原本」A〜C列（ID, 市町村, 町域）へ各行を展開。 |
| `active/dashboard/render.js` | フォールバック復元 (L63-70) | `rowId`, `city_name`, `town_name`, `latitude`, `longitude` | ピンデータ未初期化時に `masterPins` からピン構造を復元。 |
| `active/dashboard/render.js` | 地図中心・範囲計算 (L621, 870-885) | `latitude`, `longitude` | 有効な有限数（`isFinite`）の座標から地図初期中心点（`initialCenter`）および描画境界（`bounds`）を動的計算。 |
| `scripts/check-provisioning-gate.mjs` | Gate 2, 4 (L49-80) | 行数 (レコード総数) | `parseCsvRowCount` で件数を取得し、スプレッドシート原本行数と1件の狂いもなく完全一致することを検証。 |
| `tests/dashboard_verification_gate.mjs` | Phase 1 (L387-414) | 行数 (レコード総数) | CSVロード件数（`masterPinsCount`）が画面表示の「全体進捗（総エリア数）」と完全一致することを検証。 |

---

## 3. 正式CSVデータ契約（5列定義）

### 正式ヘッダー（1行目）
```csv
rowId,city_name,town_name,latitude,longitude
```

### 各列の正式定義

| 列順 | 列名 (ヘッダー) | データ型 | 必須条件 | 一意性 | 表記・採番ルール | 役割・用途 |
| :---: | :--- | :---: | :---: | :---: | :--- | :--- |
| **0** | **`rowId`** | 整数 (`integer`) | **必須** (NOT NULL) | **完全一意** (UNIQUE) | **1から始まる連続連番** (`1, 2, 3, ... N`)。<br>欠番・重複・0・負数・プレフィックス（`MIE-`等）は絶対禁止。 | システム全体の主キー（PK）。スプレッドシート配布実績A列と1対1バインド。 |
| **1** | **`city_name`** | 文字列 (`string`) | **必須** (空文字禁止) | 重複あり | 正式自治体名（例: `四日市市`, `岡山市北区`, `三重郡菰野町` 等）。<br>前後空白・カンマ（`,`）禁止。 | 自治体集計キー、スプレッドシートB列、`municipality_master.csv` 突合キー。 |
| **2** | **`town_name`** | 文字列 (`string`) | **必須** (空文字禁止) | 同一市区内で一意推奨 | 町名・町丁目・大字（例: `相生町`, `あがたが丘一丁目`, `大字豊田` 等）。<br>前後空白・カンマ（`,`）禁止。 | 町域集計キー、スプレッドシートC列、UIカード表示。 |
| **3** | **`latitude`** | 浮動小数点数 (`float`) | **必須** (有限数) | 重複あり | 世界測地系 (WGS84) 10進数表記。<br>有効範囲: `20.0 <= latitude <= 46.0`。<br>小数6桁以上推奨。`NaN`/`null`/空は禁止。 | Google Maps マーカー配置、地図初期中心点計算、表示範囲拡張。 |
| **4** | **`longitude`** | 浮動小数点数 (`float`) | **必須** (有限数) | 重複あり | 世界測地系 (WGS84) 10進数表記。<br>有効範囲: `122.0 <= longitude <= 154.0`。<br>小数6桁以上推奨。`NaN`/`null`/空は禁止。 | Google Maps マーカー配置、地図初期中心点計算、表示範囲拡張。 |

---

## 4. CSV構造固定ルール

1. **列数固定**: 厳密に **5列** 固定。
2. **列順固定**: `rowId`, `city_name`, `town_name`, `latitude`, `longitude` の順序を厳守。
3. **ヘッダー完全一致**: 1行目は半角英小文字・アンダースコアで完全一致すること（大文字や別名不可）。
4. **独自列の追加禁止**:
   以下の列の追加は**絶対禁止**とする（追加が必要な場合は別仕様・別リソースとして設計する）。
   - ❌ `postal_code`（郵便番号）
   - ❌ `district_id`（地区コード）
   - ❌ `address`（合成住所文字列）
   - ❌ `status`（進捗ステータス）
   - ❌ `created_at` / `updated_at`（タイムスタンプ）
5. **文字コード・改行**: `UTF-8`（BOMなし）、改行コードは `LF` または `CRLF`。
6. **空行禁止**: データ行の途中に空行を挟まない（末尾の改行1つのみ許容）。

---

## 5. 入力元データと最終マスター形式の完全分離

国土交通省位置参照情報等の外部データは、POSTING MAPの `address_master.csv` そのものではない。必ず以下の正規化パイプラインを経て生成される。

```text
┌─────────────────────────────────────────────────────────────┐
│ 【取得元データ (Raw Source)】                                │
│  ・国土交通省 位置参照情報 (大字・町丁目 / 街区レベル)        │
│  ・日本郵便 郵便番号データ 等                               │
└──────────────────────────────┬──────────────────────────────┘
                               │ 抽出 (対象選挙区・自治体のフィルタリング)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 【正規化処理 (Normalization Layer)】                        │
│  1. 表記揺れ除去 (city_name, town_name)                     │
│  2. 代表代表緯度・経度の算出 (WGS84十進数)                   │
│  3. 1からの連続整数連番 rowId の付与                         │
│  4. カンマ・改行・不正文字列のサニタイズ                    │
└──────────────────────────────┬──────────────────────────────┘
                               │ 5列固定フォーマットへ変換
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 【POSTING MAP 確定住所マスター (Final SSOT)】                │
│  data/address_master.csv                                    │
│  (rowId,city_name,town_name,latitude,longitude)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. 全地区共通 テンプレート検証ルール（11のチェックゲート）

今後、どの地区の `address_master.csv` であっても、以下の11条件をすべてクリアしなければマスターとして認可されない。

- [x] **Rule-01 (実在確認)**: `data/address_master.csv` が存在し、0バイトでないこと。
- [x] **Rule-02 (ヘッダー完全一致)**: 1行目が `rowId,city_name,town_name,latitude,longitude` であること。
- [x] **Rule-03 (5列固定)**: ヘッダーおよび全データ行の列数が「厳密に5」であること。
- [x] **Rule-04 (行数確認)**: データ行数が1行以上（総行数2行以上）であること。
- [x] **Rule-05 (rowId連続一意性)**: `rowId` が 1 から始まり、重複がなく、欠番のない連続整数（`1, 2, ... N`）であること。
- [x] **Rule-06 (city_name非空)**: 全行の `city_name` が空文字・空白でないこと。
- [x] **Rule-07 (town_name非空)**: 全行の `town_name` が空文字・空白でないこと。
- [x] **Rule-08 (latitude数値性)**: 全行の `latitude` がパース可能かつ有限な数値（`!isNaN` かつ `isFinite`）であること。
- [x] **Rule-09 (longitude数値性)**: 全行の `longitude` がパース可能かつ有限な数値（`!isNaN` かつ `isFinite`）であること。
- [x] **Rule-10 (国内座標境界)**: `20.0 <= latitude <= 46.0` かつ `122.0 <= longitude <= 154.0` の範囲内であること。
- [x] **Rule-11 (列ずれゼロ)**: カンマ過不足による列のズレ（4列以下、または6列以上）が1行も存在しないこと。

---

## 7. 変更禁止の確認（0変更の維持）

今回の作業において、以下の既存リソースは一切変更されていない。
- `active/`（製品本体アプリ）: 0変更
- `data/address_master.csv`: 0変更（MIE-03 858件を保持）
- `data/municipality_master.csv`: 0変更
- `data/boundaries.geojson`: 0変更
- `deployment.json`: 0変更
- `.clasp.json`: 0変更
- GAS / Spreadsheet / LIFF / WebApp / Git remote / 親製品: 0変更

---

## 8. 意思決定プロセス

### 人間による判断 (MASTER)
- 「地区展開を開始する前に、POSTING MAPで使用する住所マスターCSV (address_master.csv) の正式な入力データ契約を確定する。」
- 「今回はテンプレート仕様の確定のみを行う。地区決定・国土交通省データ取得・CSV生成はまだ行わない。」
- 「国土交通省CSVの列をそのまま使うのではなく、入力元と最終形式を分離する。」
- 「余計な列（postal_code, district_id, status等）の追加は禁止し、5列固定とする。」

### Flashの提案
- 【提案】現行コード（`address_master_service.js`, `district_provisioner.js`, `render.js`, `provision-district.mjs`, テストスイート）を全精査し、コード上の事実に基づいた型・制約・検証ルール（11ゲート）を策定。
- 【採用】提案通り採用し、完全READ ONLYで正式仕様書を作成。

---

## 9. 最終判定

**【判定】**: **🟢 MASTER TEMPLATE CONFIRMED**

### 判定根拠
1. 現行システム（UI、GASプロビジョニング、テストゲート）の利用仕様をコードレベルで完全確認済み。
2. 5列（`rowId`, `city_name`, `town_name`, `latitude`, `longitude`）の意味・型・必須条件・一意性を確定。
3. `rowId` の1からの正整数連番ルールを確定。
4. 5列固定・列順固定・独自列追加禁止のデータ契約を確定。
5. 外部取得データ（国交省等）から正規化するパイプライン原則を確定。
6. 全地区共通の11の検証ルールを確定。
7. 未確定事項はなく、将来の全地区展開に再利用可能なマスター仕様として成立。

---
※指示に従い、地区決定・国交省データ取得・ファイル変更は一切行わず、仕様確定のみで停止（STOP）いたします。
