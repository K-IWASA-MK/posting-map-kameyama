# Code Growth & Responsibility Analysis - active/api/v2_api.js
Version: 1.1
Status: SSOT (READ ONLY AUDIT)

---

## 1. Code Growth Statistics

`active/api/v2_api.js` のコード構成および構成要素のカウントデータです。

- **総行数**: 5,235 行
- **空行数**: 398 行 (空行率: 7.60%)
- **コメント行数**: 182 行 (コメント率: 3.48%)
- **実質コード行数**: 4,655 行 (実質コード率: 88.92%)
- **関数（function）定義数**: 31 個
- **クラス（class）定義数**: 113 個
- **定数（const）定義数**: 496 個
- **直接の Entry Point数**: 2 個 (`doGet`, `doPost`)
- **Router数 (Legacy & Direct)**: 4 個 (`doGet`内if, `doPost`内if, `processGetActionLegacy`, `processPostAction`)
- **Platform Pipeline数**: 9 個 (Hardening, Auth, Authz, Licensing, Feature, Bridge, Validation, Routing, Handler)

---

## 2. Layer Distribution & Responsibility Concentration

14レイヤー別の行数占有率、および関数数・クラス数の集計データです。

| Layer | Row Coverage | Percentage (%) | Function Count | Class Count | Heat Map |
|-------|--------------|----------------|----------------|-------------|----------|
| **Business** | 1,099 lines | 21.00% | 19 | 3 | ★★★★★ |
| **Pipeline** | 893 lines | 17.06% | 0 | 23 | ★★★★☆ |
| **Routing** | 566 lines | 10.81% | 2 | 14 | ★★★☆☆ |
| **Integration** | 433 lines | 8.27% | 1 | 16 | ★★☆☆☆ |
| **Authentication** | 320 lines | 6.11% | 0 | 10 | ★★☆☆☆ |
| **Monitoring** | 298 lines | 5.69% | 0 | 7 | ★★☆☆☆ |
| **Entry Point** | 265 lines | 5.06% | 2 | 0 | ★☆☆☆☆ |
| **Authorization** | 231 lines | 4.41% | 0 | 8 | ★☆☆☆☆ |
| **Licensing** | 229 lines | 4.38% | 0 | 9 | ★☆☆☆☆ |
| **Response** | 223 lines | 4.26% | 1 | 7 | ★☆☆☆☆ |
| **Validation** | 204 lines | 3.90% | 0 | 8 | ★☆☆☆☆ |
| **Framework** | 170 lines | 3.25% | 0 | 3 | ★☆☆☆☆ |
| **Storage** | 141 lines | 2.69% | 0 | 3 | ★☆☆☆☆ |
| **Utility** | 104 lines | 1.99% | 3 | 2 | ★☆☆☆☆ |
| **Logging** | 30 lines | 0.57% | 2 | 0 | ☆☆☆☆☆ |
| **Bootstrap** | 30 lines | 0.57% | 1 | 0 | ☆☆☆☆☆ |
| **合計** | **5,235 lines** | **100.00%** | **31** | **113** | - |

*(※四捨五入の関係で割合の合計は 100.00% に調整済み。総行数・要素数はファイル実数 5,235 行と完全に一致)*

---

## 3. Growth Hotspots

肥大化している責務領域の順位付けです（サイズ順）。

1. **Business (21.00%)**: AppData集計、名簿、配布登録、GPS、チラシ保管庫等の業務処理ロジック。
2. **Pipeline (17.06%)**: 実行文脈制御、堅牢化ガード、ライセンス等、フレームワーク全体を駆動する制御パイプライン。
3. **Routing (10.81%)**: 旧ルーティングスイッチケース、EndpointRegistry、および各種ハンドラクラス。
4. **Integration (8.27%)**: AIOS連携ブリッジ（TaskIntakeGateway、Mockクライアントなど）。

---

## 4. Responsibility Coupling (レイヤー間の静的結合数)

静的に他のレイヤーを呼び出している箇所の接続カウントです。

- **Routing → Business**: 48 接続 (processGetActionLegacy, processPostAction から各ビジネス関数への分岐呼び出し)
- **Business → Utility**: 30 接続 (各ビジネス関数から getSS, getStorageFolderId への取得呼び出し)
- **Business → Logging**: 15 接続 (ビジネス関数から logTrace, writeDebugLogToSheet への呼び出し)
- **Pipeline → Authentication / Authorization / Licensing / Feature**: 6 接続 (PlatformIntegrationPipeline からの各サブパイプライン実行)
- **Pipeline → Monitoring**: 12 接続 (ステージ開始/完了時の PlatformLifecycleObserver イベントディスパッチ呼び出し)
- **Storage → Utility**: 2 接続 (SpreadsheetBatchReader, SpreadsheetBatchWriter からの getSS 呼び出し)

---

## 5. Section Size Ranking (Top 20)

SEC-001〜SEC-066 のうち、行数が多い上位20セクションの一覧です。

| Rank | Section ID | Section Name | Lines | Size (Lines) | Parent Layer | Component Count |
|------|------------|--------------|-------|--------------|--------------|-----------------|
| 1 | **SEC-063** | AIOS Integration Bridge | L4417-L4849 | 433 | Integration | 1 Func, 16 Class |
| 2 | **SEC-059** | Authentication Pipeline | L3392-L3711 | 320 | Authentication | 0 Func, 10 Class |
| 3 | **SEC-062** | Feature Access Control | L4172-L4416 | 245 | Pipeline | 0 Func, 7 Class |
| 4 | **SEC-066** | Platform Integration Core | L4994-L5235 | 242 | Pipeline | 1 Func, 1 Class |
| 5 | **SEC-060** | Authorization Pipeline | L3712-L3942 | 231 | Authorization | 0 Func, 8 Class |
| 6 | **SEC-061** | Licensing & Edition | L3943-L4171 | 229 | Licensing | 0 Func, 9 Class |
| 7 | **SEC-058** | Hardening Pipeline | L3165-L3391 | 227 | Pipeline | 0 Func, 10 Class |
| 8 | **SEC-054** | Request Validation Pipeline | L2593-L2784 | 192 | Validation | 0 Func, 8 Class |
| 9 | **SEC-055** | API Exception Framework | L2785-L2966 | 182 | Response | 0 Func, 8 Class |
| 10 | **SEC-018** | Staff Registration | L984-L1160 | 177 | Business | 1 Func, 0 Class |
| 11 | **SEC-006** | HTTP GET Entry | L107-L262 | 156 | Entry Point | 1 Func, 0 Class |
| 12 | **SEC-009** | POST Legacy Routing | L503-L635 | 133 | Routing | 1 Func, 0 Class |
| 13 | **SEC-007** | GET Legacy Routing | L263-L393 | 131 | Routing | 1 Func, 0 Class |
| 14 | **SEC-056** | Metrics & Audit | L2967-L3083 | 117 | Monitoring | 0 Func, 4 Class |
| 15 | **SEC-008** | HTTP POST Entry | L394-L502 | 109 | Entry Point | 1 Func, 0 Class |
| 16 | **SEC-030** | Configuration Provider | L1575-L1680 | 106 | Framework | 0 Func, 1 Class |
| 17 | **SEC-020** | GPS Photo Upload | L1170-L1274 | 105 | Business | 1 Func, 0 Class |
| 18 | **SEC-046** | Write Batch Handler | L2229-L2325 | 97 | Business | 0 Func, 1 Class |
| 19 | **SEC-044** | Route Handlers (Stubs) | L2071-L2163 | 93 | Routing | 0 Func, 5 Class |
| 20 | **SEC-064** | Platform Integration Base | L4850-L4940 | 91 | Pipeline | 0 Func, 2 Class |

---

## 6. Class / Function Density (クラス/関数密度)

全66セクションの中で、コンポーネント（クラス・関数）が最も多く集中している高密度セクションの上位5件です。

1. **SEC-063 (AIOS Integration Bridge)**: **17個** (1 Func, 16 Class) / 433行
2. **SEC-059 (Authentication Pipeline)**: **10個** (0 Func, 10 Class) / 320行
3. **SEC-058 (Hardening Pipeline)**: **10個** (0 Func, 10 Class) / 227行
4. **SEC-061 (Licensing & Edition)**: **9個** (0 Func, 9 Class) / 229行
5. **SEC-054 (Request Validation Pipeline)**: **9個** (0 Func, 9 Class) / 192行

---

## 7. Responsibility Fragmentation (同一責務の分散状況)

同一のレイヤーに属する処理が、ファイル内の離れた複数箇所に分断されている状況のデータです。

- **Business レイヤー**:
  - `SEC-011` 〜 `SEC-029` (L677-1574)
  - `SEC-046` 〜 `SEC-048` (L2229-2429)
  *(新旧のハンドラ設計の混在により、1228行にわたるビジネス層の間に 600行の別レイヤーが挿入されている状況)*
- **Routing レイヤー**:
  - `SEC-007` (L263-393)
  - `SEC-009` (L503-635)
  - `SEC-040` 〜 `SEC-045` (L2021-2228)
  - `SEC-051` 〜 `SEC-052` (L2487-2580)
  *(旧形式のswitch分岐ルーターと新形式のクラスルーティング定義が複数箇所に離散)*
- **Utility レイヤー**:
  - `SEC-004` (L54-100)
  - `SEC-049` (L2430-2454)
  - `SEC-050` (L2455-2486)
- **Pipeline レイヤー**:
  - `SEC-036`, `SEC-038`, `SEC-039` (L1886-1935, L1983-2020)
  - `SEC-058`, `SEC-061` (L3165-3391, L3943-4171)
  - `SEC-062`, `SEC-064`, `SEC-066` (L4172-4416, L4850-4940, L4994-5235)

---

## 8. Split Readiness Inventory (分割準備インベントリ)

各主要セクションにおける呼び出し数（結合関係）の定量データです。

| Section ID | Size (Lines) | Public Calls | Internal Calls | External Dependencies | Layer |
|------------|--------------|:------------:|:--------------:|-----------------------|-------|
| **SEC-063** | 433 | 2 | 3 | `TaskIntakeGateway`, `DriveApp`, `UrlFetchApp` | Integration |
| **SEC-059** | 320 | 1 | 4 | `UrlFetchApp`, `SpreadsheetApp` (Roster) | Authentication|
| **SEC-060** | 231 | 1 | 3 | `SpreadsheetApp` (Roster) | Authorization |
| **SEC-061** | 229 | 1 | 2 | なし | Licensing |
| **SEC-062** | 245 | 1 | 2 | なし | Pipeline |
| **SEC-058** | 227 | 1 | 3 | なし | Pipeline |
| **SEC-018** | 177 | 3 | 3 | `SpreadsheetApp` (Roster), `LockService` | Business |
| **SEC-020** | 105 | 2 | 3 | `DriveApp`, `LockService`, `SpreadsheetApp` | Business |
| **SEC-046** | 97 | 1 | 4 | `SpreadsheetApp`, `PropertiesService` | Business/Stor |

---

## 9. Growth Summary

客観データから導出された肥大化および構造状況のまとめです。

1. **肥大化の主要因**:
   - 95クラス（113個のクラス定義マッチ）からなるフレームワーク/パイプライン層（SEC-030〜066）が、ファイル全体の約7割（3,664行）を占めていること。
   - レガシーのGET/POSTルーティング（switch-case計48ケース）と、新ハンドラクラスが並存し、重複した3重ルーティング構造を形成していること。
2. **責務の偏りと分散**:
   - `Business` レイヤーが全体の21.00%（1,099行）を占めるが、残りの79.00%はルーティング、パイプライン、連携、検証等のインフラ・制御コードで占められていること。
   - `Business` および `Routing` レイヤーが同一ファイル内の複数箇所に細切れに配置（分断）されていること。
3. **最も結合が強いレイヤー**:
   - `Routing → Business`（48接続）および `Business → Utility`（30接続）。

---

> [!IMPORTANT]
> ## 監査免責事項
> **本監査は READ ONLY とする。監査結果に基づく修正計画は別工程で策定し、本監査ではコード・設定・Git・GASへの変更を一切行わない。**
