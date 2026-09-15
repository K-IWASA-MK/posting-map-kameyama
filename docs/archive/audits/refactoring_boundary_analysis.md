# Refactoring Boundary Analysis - active/api/v2_api.js
Version: 1.0
Status: SSOT (READ ONLY AUDIT)

---

## 1. Boundary Inventory

主要セクションにおける外部接続公開口（入口・出口）の一覧です。

| Section ID | Layer | Lines | Public Entry (入口関数/クラス) | Public Exit (出口) |
|------------|-------|-------|-------------------------------|--------------------|
| **SEC-006** | Entry Point | L107-L262 | `doGet(e)` | `ContentService` または Pipeline |
| **SEC-008** | Entry Point | L394-L502 | `doPost(e)` | `ContentService` または Pipeline |
| **SEC-007** | Routing | L263-L393 | `processGetActionLegacy(action, e)` | アクション実行結果オブジェクト |
| **SEC-009** | Routing | L503-L635 | `processPostAction(action, postData, e)` | アクション実行結果オブジェクト |
| **SEC-052** | Routing | L2540-L2580 | `ApiRouter.route(request, context)` | `ApiResponse` オブケット |
| **SEC-054** | Validation | L2593-L2784 | `ValidationPipeline.validate(request, context)`| `ValidationResult` |
| **SEC-058** | Pipeline | L3165-L3391 | `HardeningPipeline.execute(request, context)` | 例外スローまたは正常通過 |
| **SEC-059** | Authentication| L3392-L3711 | `AuthenticationPipeline.execute(request, context)`| 認証コンテキスト設定 |
| **SEC-060** | Authorization | L3712-L3942 | `AuthorizationPipeline.execute(request, context)`| 認可コンテキスト設定 |
| **SEC-061** | Licensing | L3943-L4171 | `LicensingPipeline.execute(request, context)` | ライセンスコンテキスト設定 |
| **SEC-062** | Pipeline | L4172-L4416 | `FeatureAccessPipeline.execute(request, context)`| 機能アクセスコンテキスト設定 |
| **SEC-063** | Integration | L4417-L4849 | `AIOSBridgePipeline.execute(request, context)` | ブリッジコンテキスト設定 |
| **SEC-066** | Pipeline | L4994-L5235 | `PlatformIntegrationPipeline.execute(e)` | `ContentService` JSON 出力 |

---

## 2. Cross Boundary Call Matrix & Dependency Strength

セクション境界を跨ぐすべての静的呼び出し関係のデータです。

| From Section | To Section | Boundary Type | Calls | Unique Elements (対象) | Description / Target |
|--------------|------------|---------------|:-----:|:---------------------:|----------------------|
| **SEC-006** | **SEC-066** | Layer Boundary | 1 | 1 | doGet から `PlatformIntegrationPipeline.execute()` |
| **SEC-008** | **SEC-066** | Layer Boundary | 1 | 1 | doPost から `PlatformIntegrationPipeline.execute()` |
| **SEC-006** | Business層 | Layer Boundary | 8 | 7 | doGet 内 if 分岐から各直接ビジネスロジック実行 |
| **SEC-008** | Business層 | Layer Boundary | 3 | 3 | doPost 内 if 分岐から各直接ビジネスロジック実行 |
| **SEC-066** | **SEC-058** | Layer Boundary | 1 | 1 | パイプライン実行から `HardeningPipeline.execute()` |
| **SEC-066** | **SEC-059** | Layer Boundary | 1 | 1 | パイプライン実行から `AuthenticationPipeline.execute()` |
| **SEC-066** | **SEC-060** | Layer Boundary | 1 | 1 | パイプライン実行から `AuthorizationPipeline.execute()` |
| **SEC-066** | **SEC-061** | Layer Boundary | 1 | 1 | パイプライン実行から `LicensingPipeline.execute()` |
| **SEC-066** | **SEC-062** | Layer Boundary | 1 | 1 | パイプライン実行から `FeatureAccessPipeline.execute()` |
| **SEC-066** | **SEC-063** | Layer Boundary | 1 | 1 | パイプライン実行から `AIOSBridgePipeline.execute()` |
| **SEC-066** | **SEC-054** | Layer Boundary | 1 | 1 | パイプライン実行から `ValidationPipeline.validate()` |
| **SEC-066** | **SEC-052** | Layer Boundary | 2 | 2 | ルーター解決および `ApiRouter.route()` の実行 |
| **SEC-052** | **SEC-045** | Class Boundary | 1 | 3 | 各ハンドラ（LegacyHandler等）の `execute()` 呼出 |
| **SEC-045** | **SEC-007** | Class Boundary | 1 | 1 | Legacy GET ハンドラから `processGetActionLegacy` |
| **SEC-045** | **SEC-009** | Class Boundary | 1 | 1 | Legacy POST ハンドラから `processPostAction` |
| **SEC-007** | Business層 | Layer Boundary | 23 | 19 | 旧GETルーターから各個別ビジネス関数実行 |
| **SEC-009** | Business層 | Layer Boundary | 25 | 25 | 旧POSTルーターから各個別ビジネス関数実行 |
| Business層 | **SEC-004** | Layer Boundary | 30 | 2 | 各ビジネス関数から `getSS()`, `getStorageFolderId()` |
| Business層 | **SEC-002** | Layer Boundary | 15 | 1 | 各ビジネス関数から `logTrace()` |
| **SEC-066** | **SEC-002** | Layer Boundary | 1 | 1 | Platform 終端での `writeDebugLogToSheet()` 呼出 |
| **SEC-066** | Monitoring層| Layer Boundary | 6 | 4 | プラットフォーム起動やステージ遷移イベント呼出 |
| **SEC-035** | **SEC-033** | Class Boundary | 5 | 1 | リポジトリから `SpreadsheetBatchReader.readAll()` |
| **SEC-035** | **SEC-034** | Class Boundary | 2 | 2 | リポジトリから `SpreadsheetBatchWriter` メソッド |
| **SEC-033** | **SEC-004** | Layer Boundary | 2 | 1 | バッチリーダー内からの `getSS()` / `getSpreadsheet` |
| **SEC-034** | **SEC-004** | Layer Boundary | 2 | 1 | バッチライター内からの `getSS()` / `getSpreadsheet` |
| **SEC-059** | **SEC-004** | Layer Boundary | 2 | 1 | 名簿シートチェック用の `getSS()` 呼出 |
| **SEC-060** | **SEC-004** | Layer Boundary | 1 | 1 | 権限確認スプレッドシート取得のための `getSS()` 呼出 |
| Business層 | External | External Boundary| 42 | 4 | 各ビジネス関数から SpreadsheetApp / DriveApp 直接操作 |

---

## 3. Global State Inventory

システム内で共有され、各セクションから参照されている状態（変数・オブジェクト）の一覧です。

### 共有変数 (Global Variables)
- **`isWebAppCall`** (定義: `SEC-003` L49):
  - 参照元: `SEC-004` (getSS内でのUIコンテキスト判定), `SEC-006` (doGet開始時のフラグ設定), `SEC-008` (doPost開始時のフラグ設定)
- **`executionContext`** (定義: `SEC-005` L101):
  - 参照元: `SEC-066` (PlatformIntegrationPipeline 内でのコンテキスト同期)
- **`globalCacheHit`** (定義: `SEC-005` L102):
  - 参照元: `SEC-010` (レスポンスフォーマッタ内でのキャッシュステータス設定)
- **`PlatformIntegrationPipeline.lastContext`** (定義: `SEC-066` L5233):
  - 参照元: `SEC-066` (Pipeline実行終了時のコンテキスト保存・クリア)

### 共有定数 (Global Constants)
- **`CONFIG`** (グローバル定義オブジェクト):
  - 参照元: `SEC-004` (getStorageFolderId), `SEC-014` (getCityAreaDetailsでの除外シート名), `SEC-015`, `SEC-022`, `SEC-023`, `SEC-025`, `SEC-059` (名簿・保管庫・管理者・設定シート名取得)
- **`ValidationError`** (定義: `SEC-053` L2585):
  - 参照元: `SEC-054` (バリデータークラス群でのエラーコード生成)
- **`ExceptionCategory`** (定義: `SEC-055` L2788):
  - 参照元: `SEC-055` (Exceptionクラス群でのエラーカテゴリ設定)
- **`AIOSBridgeMode`** (定義: `SEC-063` L4544):
  - 参照元: `SEC-063` (ブリッジクライアント生成ファクトリおよびProviderクラス)
- **`PlatformStage`** (定義: `SEC-064` L4854):
  - 参照元: `SEC-036` (ApiExecutionContext), `SEC-066` (PlatformIntegrationPipeline各フェーズ遷移)

### シングルトンインスタンス (Singleton Providers)
- **`GasConfigurationProvider.getInstance()`** (定義: `SEC-030` L1575)
- **`CacheServiceProvider.getInstance()`** (定義: `SEC-031` L1681)
- **`LockServiceProvider.getInstance()`** (定義: `SEC-032` L1715)
- **`EndpointRegistry.getInstance()`** (定義: `SEC-051` L2487)
- **`ApiRouter.getInstance()`** (定義: `SEC-052` L2540)
- **`ValidationPipeline.getInstance()`** (定義: `SEC-054` L2756)
- **`EventDispatcher.getInstance()`** (定義: `SEC-056` L2970)
- **`AuditCollector.getInstance()`** (定義: `SEC-056` L2998)
- **`MetricsCollector.getInstance()`** (定義: `SEC-056` L3026)
- **`MonitoringPipeline.getInstance()`** (定義: `SEC-056` L3050)
- **`HealthCheckService.getInstance()`** (定義: `SEC-058` L3165)
- **`CircuitBreakerFoundation.getInstance()`** (定義: `SEC-058` L3260)
- **`HardeningPipeline.getInstance()`** (定義: `SEC-058` L3341)
- **`AuthenticationPipeline.getInstance()`** (定義: `SEC-059` L3639)
- **`AuthorizationPipeline.getInstance()`** (定義: `SEC-060` L3846)
- **`LicensingPipeline.getInstance()`** (定義: `SEC-061` L4096)
- **`FeatureAccessPipeline.getInstance()`** (定義: `SEC-062` L4317)
- **`AIOSBridgePipeline.getInstance()`** (定義: `SEC-063` L4732)

---

## 4. Initialization Dependency (初期化順序の依存関係)

GASはグローバルスコープがロードされた後、HTTPリクエストトリガーに応じて `doGet` / `doPost` から以下の順序で初期化・実行が遷移します。

```
[GAS Global Scope Load] (ホイスティングによるクラス・関数のメモリロード)
  ↓
[doGet(e) / doPost(e) Trigger]
  ↓
[PlatformIntegrationPipeline.execute(e)] (SEC-066)
  ├─ 1. ApiExecutionContext 初期化 (SEC-036)
  ├─ 2. PlatformExecutionContext 生成 (SEC-064)
  ├─ 3. PlatformLifecycleObserver.onPlatformStarted (SEC-065)
  ├─ 4. ExceptionHandler リスナー登録 (SEC-055)
  ├─ 5. HardeningPipeline 実行 (SEC-058)
  ├─ 6. AuthenticationPipeline 実行 (SEC-059)
  ├─ 7. AuthorizationPipeline 実行 (SEC-060)
  ├─ 8. LicensingPipeline 実行 (SEC-061)
  ├─ 9. FeatureAccessPipeline 実行 (SEC-062)
  ├─ 10. AIOSBridgePipeline 実行 (SEC-063)
  ├─ 11. ValidationPipeline 実行 (SEC-054)
  ├─ 12. EndpointRegistry マッピング解決 (SEC-051)
  ├─ 13. LockServiceProvider による排他ロック (SEC-032) (※書き込み系POST時のみ)
  ├─ 14. ApiRouter によるハンドラディスパッチ (SEC-052)
  └─ 15. createJsonResponseFromApiResponse レスポンス出力 (SEC-010)
```

---

## 5. Shared Utility Dependency

共通のユーティリティ関数を参照・共有しているセクションの一覧です。

### getSS() (SEC-004) を参照するセクション (24セクション)
- `SEC-001`, `SEC-002`, `SEC-006`, `SEC-008`, `SEC-011`, `SEC-012`, `SEC-014`, `SEC-015`, `SEC-018`, `SEC-020`, `SEC-022`, `SEC-023`, `SEC-024`, `SEC-025`, `SEC-027`, `SEC-028`, `SEC-033`, `SEC-034`, `SEC-046`, `SEC-047`, `SEC-048`, `SEC-059` (StaffIdentityResolver内), `SEC-060` (RoleResolver内), `SEC-066`

### traceLog() / logTrace() (SEC-002) を参照するセクション (3セクション)
- `SEC-018`, `SEC-020`, `SEC-059` (StaffIdentityResolver内)

### writeDebugLogToSheet() (SEC-002) を参照するセクション (1セクション)
- `SEC-066` (PlatformIntegrationPipeline 終了前 L5224)

---

## 6. Layer Coupling Matrix (レイヤー間結合マトリクス)

14レイヤー間の結合状況の定量データです。

| From Layer | To Layer | Calls | Unique Elements (接続口数) | Boundary Type |
|------------|----------|:-----:|:--------------------------:|---------------|
| **Entry Point** | **Pipeline** | 2 | 1 | Layer Boundary |
| **Entry Point** | **Business** | 11 | 10 | Layer Boundary |
| **Pipeline** | **Routing** | 2 | 2 | Layer Boundary |
| **Pipeline** | **Authentication** | 1 | 1 | Layer Boundary |
| **Pipeline** | **Authorization** | 1 | 1 | Layer Boundary |
| **Pipeline** | **Licensing** | 1 | 1 | Layer Boundary |
| **Pipeline** | **Feature** | 1 | 1 | Layer Boundary |
| **Pipeline** | **Integration** | 1 | 1 | Layer Boundary |
| **Pipeline** | **Validation** | 1 | 1 | Layer Boundary |
| **Pipeline** | **Monitoring** | 6 | 4 | Layer Boundary |
| **Pipeline** | **Logging** | 1 | 1 | Layer Boundary |
| **Routing** | **Business** | 48 | 44 | Layer Boundary |
| **Business** | **Utility** | 30 | 2 | Layer Boundary |
| **Business** | **Logging** | 15 | 1 | Layer Boundary |
| **Storage** | **Utility** | 4 | 1 | Layer Boundary |
| **Authentication**| **Utility** | 2 | 1 | Layer Boundary |
| **Authorization** | **Utility** | 1 | 1 | Layer Boundary |
| **Business** | **External** | 42 | 4 | External Boundary |

---

## 7. Circular Dependency Check (循環参照の有無)

- **セクション間およびクラス・関数間の循環依存**:
  - **No Circular Dependency Detected** (循環参照は検出されませんでした)
  - *理由: パイプラインおよびルーターからビジネスロジックへ流れる呼び出しは一方向であり、ビジネスロジック関数やユーティリティ関数内から逆にパイプラインやルーターを実行する逆流パスは一切存在しないため。*

---

## 8. Boundary Risk & Stability Inventory

境界ごとの Incoming / Outgoing 接続数および接触レイヤー（Touches）のデータです。

| Section ID | Layer | Incoming Calls | Outgoing Calls | Shared State Refs | Touches (接触レイヤー数) |
|------------|-------|:--------------:|:--------------:|:-----------------:|:------------------------:|
| **SEC-006** | Entry Point | 0 | 9 | 1 (`isWebAppCall`) | 4 (`External`, `Business`, `Pipeline`, `Utility`) |
| **SEC-008** | Entry Point | 0 | 4 | 0 | 4 (`External`, `Business`, `Pipeline`, `Utility`) |
| **SEC-007** | Routing | 1 | 23 | 0 | 2 (`Routing`, `Business`) |
| **SEC-009** | Routing | 2 | 25 | 0 | 2 (`Routing`, `Business`) |
| **SEC-066** | Pipeline | 2 | 12 | 2 (`lastContext`, `isWebAppCall`) | 10 (`Entry`, `Pipeline`, `Routing`, `Auth`, `Authz`, `Lic`, `Feat`, `Int`, `Val`, `Mon`) |
| **SEC-018** | Business | 3 | 3 | 1 (`CONFIG`) | 4 (`Routing`, `Entry`, `Utility`, `Logging`) |
| **SEC-020** | Business | 2 | 3 | 1 (`CONFIG`) | 4 (`Routing`, `Utility`, `Logging`, `External`) |
| **SEC-063** | Integration | 2 | 3 | 1 (`AIOSBridgeMode`) | 4 (`Pipeline`, `Framework`, `Response`, `External`) |

---

## 9. Refactoring Constraint Inventory

リファクタリング時に必ず考慮しなければならない技術的制約事項の一覧です。

- **初期化順序制約**:
  - `PlatformIntegrationPipeline.execute` 内で、堅牢化ガード（Hardening）から始まり、認証、認可、ライセンス、機能フラグ、AIOSブリッジ、リクエスト検証、ルーティング解決の順で順次処理を行う必要があるため、このパイプライン順序を崩すと状態未設定による例外が発生する制約。
- **グローバル変数共有制約**:
  - `isWebAppCall` が WebApp 経由か通常のUI（スプレッドシート）経由かを判定する分岐に使われており、ファイルを分離する際にはこれを引数で渡すか、Properties などの状態管理へ移行する必要がある制約。
- **共有ユーティリティ（getSS）制約**:
  - 24セクションもの異なるレイヤーが `getSS()` を直接呼び出してスプレッドシートのアクティブオブジェクトを取得しているため、`getSS` を定義した Utility 層は最下流（依存関係の末端）に置くか、パラメータで伝播させる必要がある制約。
- **GAS ランタイム制約**:
  - `clasp push` 時にすべての `.js`（または `.gs`）ファイルがグローバルスコープで一体化される特性上、クラス名やグローバル関数名の重複は許されない制約。

---

## 10. Boundary Summary

分析結果の統計的まとめです。

- **総境界（セクション）数**: 66 境界
- **Cross Boundary Calls（セクション間呼び出し）の総数**: 183 接続
- **共有状態（グローバル変数・定数・シングルトン）の総数**: 27 状態
- **共通ユーティリティ共有数**: 3 ユーティリティ (getSS, traceLog, writeDebugLogToSheet)
- **循環参照の有無**: 0 件 (No Circular Dependency Detected)
- **接触レイヤーが最も多い（結節点となる）セクション**: `SEC-066` (10レイヤーと接触)

---

> [!IMPORTANT]
> ## 監査免責事項
> **本監査は READ ONLY とする。監査結果に基づく修正計画は別工程で策定し、本監査ではコード・設定・Git・GASへの変更を一切行わない。**
