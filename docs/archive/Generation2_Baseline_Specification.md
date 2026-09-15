# POSTING MAP Generation 2 — Baseline Specification (仕様書)

Version: 2.0.0 (Production Freeze Baseline)  
System: POSTING MAP / FIELD OPERATIONS OS  
Author: AI OS Architecture Team / 品質管理部  
Status: Frozen Baseline (仕様追加禁止・安定運用モード)

---

## 1. システム概要と基本設計思想 (System Overview & Philosophy)

POSTING MAP は単なる地図閲覧アプリではなく、現場・管理者・支部・本部をリアルタイムに接続する「政治・現場統制OS (FIELD OPERATIONS OS)」である。

### 核心原則
- **1シート10件原則**: 全てのエリアシートは自治体ごとに1シート正確に10件区切りで生成され、地区境界による中途半端なシート分割を絶対に行わない。
- **純粋ブラックボックス化**: 現場配布員および管理者に対して、Google Apps Script / スプレッドシートの「生感」を消し去り、ネイティブアプリ（Apple級デザイン・漆黒UI）と同等の操作感を提供する。
- **データ一貫性 (SSOT)**: `__TEMP_ADDRESSES__` を単一のデータ源 (Single Source of Truth) とし、抽出・ソート・シート展開・キャッシュ生成の全工程で住所の並び順と件数の一致を保証する。

---

## 2. アーキテクチャとモジュール責務 (Architecture & Responsibilities)

```
[MIE_POSTAL.CSV / 郵便マスタ]
          │
          ▼
   v2_extract.js (抽出 & District Master 属性付与)
          │
          ▼
   __TEMP_ADDRESSES__ (SSOT 一時シート)
          │
          ▼
   v2_batch.js (ソート & 10件チャンク展開)
          │
          ├──────────────────────────┐
          ▼                          ▼
   [Area Sheets (四日市市, 四日市市(2)...)]  __SYSTEM_CACHE__ (高速シャドウキャッシュ)
                                     │
                                     ▼
                            v2_api.js (JSON API)
                                     │
                                     ▼
                            PWA Frontend (H/K App)
```

### モジュール別責務

| モジュール | 主用ファイル | 役割と動作仕様 |
| :--- | :--- | :--- |
| **Extraction Engine** | `active/gas/v2_extract.js` | 郵便マスタより対象選挙区の住所を抽出。`YOKKAICHI_DISTRICT_MASTER` から地区名（例: 富洲原地区）を照合し、**純粋な属性データ**として付与する。 |
| **Batch Engine** | `active/gas/v2_batch.js` | 抽出データを自治体優先度 ➔ 郵便番号昇順で並び替え、`__TEMP_ADDRESSES__` へ保存。1シート10件単位でArea Sheetを非同期生成。 |
| **Data Core & Cache** | `active/gas/v2_map.js` | シート生成完了後に `__SYSTEM_CACHE__` および `PropertiesService` キャッシュを更新。フロントエンドへの超高速レスポンスを担保。 |
| **API Boundary** | `active/api/v2_api.js` | フロントエンド (PWA) からの `fetch(JSON)` リクエストに応答。常に純粋なJSONのみを返却。 |

---

## 3. ソートおよびシート分割仕様 (Sorting & Chunking Specs)

### 3.1 住所ソート順序 (Address Sort Order)
住所配列の整列（`addresses.sort`）は以下の**2段階の固定キー**のみを使用する。

1. **第1優先キー**: 自治体優先度 (`cityOrderPriority`)
   - 定義順序: `["桑名市", "いなべ市", "桑名郡", "員弁郡", "三重郡", "四日市市", "鈴鹿市"]`
2. **第2優先キー**: 郵便番号数値昇順 (`postalCode` Ascending)
   - ハイフンを除去した7桁の数値として比較昇順ソート。

> ⚠️ **絶対禁止規程**:
> - `district`（地区名）をソートキーとして使用してはならない（`localeCompare` 等による地区ソートの禁止）。
> - CSVから抽出された同一自治体・同一郵便番号内の住所並び順を壊してはならない。

### 3.2 シート生成および分割条件 (Sheet Generation Rules)
- **シートキー (`areaKey`)**: 自治体名 (`city`) をそのまま使用する（例: `四日市市`）。
- **分割件数 (`chunkSize`)**: 1シートあたり**最大10件** (`CONFIG.get("CHUNK_SIZE") || 10`)。
- **地区境界の扱い**: 地区（富洲原地区 ➔ 羽津地区 等）が途中で切り替わっても、10件に達するまでは同一シートに続けて格納する。地区変更によってシートを閉じてはならない。
- **シート命名規則**:
  - 各自治体の1枚目: `<自治体名>` (例: `四日市市`)
  - 各自治体の2枚目以降: `<自治体名>(<連番>)` (例: `四日市市(2)`, `四日市市(3)`)

---

## 4. District Master の利用定義 (District Master Rules)

`YOKKAICHI_DISTRICT_MASTER` （89件の町名・地区マッピングデータ）は以下の目的**のみ**に使用する。

1. **属性付与 (Enrichment)**:
   `extractDistrictAddresses` 内の `matchDistrict(address, city)` において、住所に対応する地区名（例: `"富洲原地区"`, `"羽津地区"`）を割り当てる。
2. **データ格納**:
   `__TEMP_ADDRESSES__` の第5列目 (`"地区名"`) へ記録し、地図表示や詳細表示、KPI集計時の属性データとして提供する。
3. **非関与原則 (Isolation)**:
   地区名は、シートのグループ化、ソート順決定、シート境界判定、シート名の決定には**一切関与しない**。

---

## 5. データ整合性保証 (Data Integrity Assurance)

- **抽出〜シート展開の完全一致**:
  - CSV抽出件数 = `__TEMP_ADDRESSES__` 行数 = 全エリアシートの合計格納住所数。
- **Unknown データ保護**:
  - District Masterに存在しない町名であっても、`matchDistrict` は `"Unknown"` またはデフォルト地区名を返却し、データ行を破棄・除外しない。

---

## 6. キャッシュ & データクリア規程 (Cache & Cleansing Rules)

- **自動ローテーション**:
  - 毎月1日深夜に `checkEndOfMonthAndReset()` が起動し、全エリアシートを消去して翌月分を自動展開する。
- **Drive写真整理**:
  - `/evidence` 内の作業写真は90日経過で `/archive` へ移動、180日経過でゴミ箱へ自動移行する。

---

## 7. 変更管理と凍結 (Freeze Governance)

本 Baseline Specification は Generation 2 の正式仕様であり、以降の変更には以下が必須である：
1. **AI総監督 / 品質管理部** による事前リスク査定
2. **岩佐CEO** の明確な書面承認
3. 仕様変更に伴う ADR (Architecture Decision Record) の発行
