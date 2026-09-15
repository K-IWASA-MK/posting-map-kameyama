# File Skeleton Mapping - active/api/v2_api.js
Version: 1.1
Status: SSOT (READ ONLY AUDIT)

---

## 1. High-Level Flow

`active/api/v2_api.js` の処理の流れは、以下の通り高レベルで組み立てられています。

```
[Initialization / Bootstrap] (SEC-001)
  ↓
[Entry Points (doGet / doPost)] (SEC-006, SEC-008)
  ↓
[Platform Integration Pipeline] (SEC-066)
  ├── 1. Hardening (堅牢化ガード) (SEC-058)
  ├── 2. Authentication (認証) (SEC-059)
  ├── 3. Authorization (認可) (SEC-060)
  ├── 4. Licensing (ライセンスエディション確認) (SEC-061)
  ├── 5. Feature Access Control (機能フラグ確認) (SEC-062)
  ├── 6. AIOS Bridge (AI連携) (SEC-063)
  ├── 7. Validation (リクエストパラメータ検証) (SEC-054)
  ├── 8. Routing (エンドポイントハンドラ解決) (SEC-051)
  └── 9. Handler (実際の処理実行) (SEC-052)
        ↓
[Legacy Routing / Fallback] (SEC-007, SEC-009)
  ↓
[Business Logic] (SEC-011 - SEC-029)
  ↓
[Response Formatting] (SEC-010)
```

---

## 2. Section Index (SEC-001 to SEC-066)

| Section ID | Section Name | Lines | Size (Lines) | Parent Layer | Function Count | Class Count | Responsibility / Description |
|------------|--------------|-------|--------------|--------------|----------------|-------------|------------------------------|
| **SEC-001** | Admin Setup | L1-L18 | 18 | Bootstrap | 1 | 0 | ファイルヘッダーおよび管理者情報初期登録 |
| **SEC-002** | Trace Logging | L19-L48 | 30 | Logging | 2 | 0 | traceLog, writeDebugLogToSheet によるログ書き込み |
| **SEC-003** | WebApp Variable | L49-L53 | 5 | Bootstrap | 0 | 0 | WebApp判定フラグ (isWebAppCall) の定義 |
| **SEC-004** | Spreadsheet Utility | L54-L100 | 47 | Utility | 3 | 0 | Spreadsheet, Storage ID取得、Drive書き込みテスト |
| **SEC-005** | Context Variables | L101-L106 | 6 | Bootstrap | 0 | 0 | globalCacheHit などの実行コンテキスト用グローバル変数 |
| **SEC-006** | HTTP GET Entry | L107-L262 | 156 | Entry Point | 1 | 0 | GASの doGet エントリポイントと基本ルーティング |
| **SEC-007** | GET Legacy Routing | L263-L393 | 131 | Routing | 1 | 0 | レガシーGETのswitch-caseルーティング (23ケース) |
| **SEC-008** | HTTP POST Entry | L394-L502 | 109 | Entry Point | 1 | 0 | GASの doPost エントリポイントと基本ルーティング |
| **SEC-009** | POST Legacy Routing | L503-L635 | 133 | Routing | 1 | 0 | レガシーPOSTのswitch-caseルーティング (25ケース) |
| **SEC-010** | Response Formatting | L636-L676 | 41 | Response | 1 | 0 | ApiResponseオブジェクトのContentService用JSON変換ラッパー |
| **SEC-011** | AppData Aggregation | L677-L760 | 84 | Business | 1 | 0 | エリア配布率・完了数などを集計する getAppData |
| **SEC-012** | Area Details | L761-L806 | 46 | Business | 1 | 0 | 特定エリアシートから実績データをマージして詳細を取得する getAreaDetails |
| **SEC-013** | Geography Helper | L807-L817 | 11 | Business | 1 | 0 | エリア名から市町村名（四日市市など）を抽出する getCityName |
| **SEC-014** | City Area Details | L818-L887 | 70 | Business | 1 | 0 | 特定市町村（City）配下の全エリア詳細データを一括取得する getCityAreaDetails |
| **SEC-015** | Roster Read | L888-L907 | 20 | Business | 1 | 0 | 「名簿」シートから有効なスタッフ一覧を取得する getRoster |
| **SEC-016** | Distribution Log submit | L908-L972 | 65 | Business | 1 | 0 | 配布完了・取消実績の登録とEventLog書き込み submitDistribution |
| **SEC-017** | Normalization Helper | L973-L983 | 11 | Business | 1 | 0 | スタッフ名やIDの全半角スペースや不可視文字を取り除く normalizeName |
| **SEC-018** | Staff Registration | L984-L1160 | 177 | Business | 1 | 0 | LINE IDによる名簿シートへの自動登録および重複検証 registerStaff |
| **SEC-019** | Delivery Ranking | L1161-L1169 | 9 | Business | 1 | 0 | キャッシュデータを参照して配布ランキングを取得する getRankingData |
| **SEC-020** | GPS Photo Upload | L1170-L1274 | 105 | Business | 1 | 0 | GPS・写真をGoogle Driveへアップロードして登録する updateRecordWithGPSPhoto |
| **SEC-021** | Delivery Stats | L1275-L1283 | 9 | Business | 1 | 0 | 全体の完了件数やGPS/写真あり等の実績統計を取得する getDeliveryStats |
| **SEC-022** | Flyer Stock Read | L1284-L1303 | 20 | Business | 1 | 0 | チラシ保管庫の在庫データを読み込む getFlyerStock |
| **SEC-023** | Flyer Stock Update | L1304-L1360 | 57 | Business | 1 | 0 | チラシ在庫数を登録・加算更新する updateFlyerStock |
| **SEC-024** | Flyer Transfer Request | L1361-L1418 | 58 | Business | 1 | 0 | 配布員間でのチラシ受渡要請と管理者へのLINE通知 handleRequestFlyerTransfer |
| **SEC-025** | Admin Registration | L1419-L1458 | 40 | Business | 1 | 0 | 管理者のLINE IDを登録する（上限3名） registerAdmin |
| **SEC-026** | LINE Push Notification | L1459-L1492 | 34 | Business | 1 | 0 | LINE Messaging APIによる管理者へのプッシュ送信 sendLinePushMessage |
| **SEC-027** | Flyer Transfer List | L1493-L1514 | 22 | Business | 1 | 0 | 受渡要請の履歴（ステータス含む）を取得する getTransferRequests |
| **SEC-028** | Resolve Transfer | L1515-L1541 | 27 | Business | 1 | 0 | 受渡要請のステータス（完了等）を更新する resolveTransferRequest |
| **SEC-029** | Audit Log Read | L1542-L1574 | 33 | Business | 1 | 0 | 02_SYSTEM フォルダから整合性監査ログを取得する getAuditLogs |
| **SEC-030** | Configuration Provider | L1575-L1680 | 106 | Framework | 0 | 1 | スクリプトプロパティなどの設定を提供する GasConfigurationProvider |
| **SEC-031** | Cache Service Provider | L1681-L1714 | 34 | Framework | 0 | 1 | CacheService を用いたメモリキャッシュの管理 CacheServiceProvider |
| **SEC-032** | Lock Service Provider | L1715-L1744 | 30 | Framework | 0 | 1 | 排他制御を行う LockServiceProvider |
| **SEC-033** | Spreadsheet Reader | L1745-L1774 | 30 | Storage | 0 | 1 | シートからバッチ一括データ読み込みを行う SpreadsheetBatchReader |
| **SEC-034** | Spreadsheet Writer | L1775-L1806 | 32 | Storage | 0 | 1 | シートへのバッチ一括書き込みを行う SpreadsheetBatchWriter |
| **SEC-035** | Spreadsheet Repository | L1807-L1885 | 79 | Storage | 0 | 1 | Areas, EventLogs などの操作をカプセル化する SpreadsheetRepository |
| **SEC-036** | Execution Context | L1886-L1935 | 50 | Pipeline | 0 | 1 | リクエスト共通文脈情報を管理する ApiExecutionContext |
| **SEC-037** | Performance Monitor | L1936-L1982 | 47 | Monitoring | 0 | 1 | I/Oカウントやキャッシュヒット率などの計測 GasPerformanceMonitor |
| **SEC-038** | API Request Model | L1983-L1994 | 12 | Pipeline | 0 | 1 | 正規化したリクエストカプセルモデル ApiRequest |
| **SEC-039** | API Response Model | L1995-L2020 | 26 | Pipeline | 0 | 1 | HTTPレスポンスとメタデータのモデル ApiResponse |
| **SEC-040** | HTTP Method Policy | L2021-L2027 | 7 | Routing | 0 | 1 | 許可HTTPメソッドポリシーの定義 RoutePolicy |
| **SEC-041** | API Version Resolver | L2028-L2048 | 21 | Routing | 0 | 1 | バージョンの解決 ApiVersionResolver |
| **SEC-042** | Route Key Model | L2049-L2064 | 16 | Routing | 0 | 1 | method, version, path からの一意キー生成 RouteKey |
| **SEC-043** | Route Resolver | L2065-L2070 | 6 | Routing | 0 | 1 | キー生成用ヘルパー RouteResolver |
| **SEC-044** | Route Handlers (Stubs) | L2071-L2163 | 93 | Routing | 0 | 5 | 新フレームワーク用の各ハンドラスタブ（DashboardHandler 等） |
| **SEC-045** | Legacy API Handlers | L2164-L2228 | 65 | Routing | 0 | 3 | レガシーswitchルーティングへのブリッジハンドラ（LegacyDashboardHandler等） |
| **SEC-046** | Write Batch Handler | L2229-L2325 | 97 | Business / Storage | 0 | 1 | 区割りCSVデータのバリデーションと一括書き込み WriteBatchSpreadsheetHandler |
| **SEC-047** | Get Areas Handler | L2326-L2373 | 48 | Business / Storage | 0 | 1 | 区割りデータのバリデーションと取得 GetAreasHandler |
| **SEC-048** | Duplicate Template Handler | L2374-L2429 | 56 | Business / Storage | 0 | 1 | 「原本」複製によるバッチシート作成 DuplicateTemplateSheetHandler |
| **SEC-049** | Create Test Handler | L2430-L2454 | 25 | Utility | 0 | 1 | テスト用スプレッドシート複製 CreateTestSpreadsheetHandler |
| **SEC-050** | Cleanup Test Handler | L2455-L2486 | 32 | Utility | 0 | 1 | テスト用スプレッドシート削除 CleanupTestSpreadsheetHandler |
| **SEC-051** | Endpoint Registry | L2487-L2539 | 53 | Routing | 0 | 1 | ハンドラマッピングを管理する EndpointRegistry |
| **SEC-052** | API Router | L2540-L2580 | 41 | Routing | 0 | 1 | リクエストを適切なハンドラへディスパッチする ApiRouter |
| **SEC-053** | Validation Base | L2581-L2592 | 12 | Validation | 0 | 0 | 検証エラー定数の定義 ValidationError |
| **SEC-054** | Request Validation Pipeline | L2593-L2784 | 192 | Validation | 0 | 9 | メソッド・パス・機能フラグ等の多段検証 ValidationPipeline |
| **SEC-055** | API Exception Framework | L2785-L2966 | 182 | Response / Pipeline | 0 | 8 | 各種例外クラスの定義とレスポンス変換 ExceptionHandler |
| **SEC-056** | Metrics & Audit | L2967-L3083 | 117 | Monitoring | 0 | 4 | 測定と監査イベント記録のディスパッチ MonitoringPipeline |
| **SEC-057** | API Lifecycle Observer | L3084-L3164 | 81 | Monitoring | 0 | 1 | ライフサイクルイベントの監視 ApiLifecycleObserver |
| **SEC-058** | Hardening Pipeline | L3165-L3391 | 227 | Pipeline | 0 | 10 | 堅牢化ガード（サーキットブレイカー、TimeoutPolicy、HardeningPipeline等） |
| **SEC-059** | Authentication Pipeline | L3392-L3711 | 320 | Authentication | 0 | 10 | LINE LIFF, API Key などの認証・照合処理 AuthenticationPipeline |
| **SEC-060** | Authorization Pipeline | L3712-L3942 | 231 | Authorization | 0 | 8 | ロール・スコープに基づく認可マトリクス検証 AuthorizationPipeline |
| **SEC-061** | Licensing & Edition | L3943-L4171 | 229 | Licensing / Pipeline | 0 | 9 | エディションに応じた検証 LicensingPipeline |
| **SEC-062** | Feature Access Control | L4172-L4416 | 245 | Pipeline | 0 | 7 | 機能別アクセス制御（Mapbox等） FeatureAccessPipeline |
| **SEC-063** | AIOS Integration Bridge | L4417-L4849 | 433 | Integration | 0 | 16 | AIOS TaskIntakeGateway連携 AIOSBridgePipeline |
| **SEC-064** | Platform Integration Base | L4850-L4940 | 91 | Pipeline | 0 | 3 | プラットフォームステージ・例外等の実行基盤 |
| **SEC-065** | Platform Lifecycle | L4941-L4993 | 53 | Monitoring | 0 | 1 | プラットフォームのイベントライフサイクル監視 PlatformLifecycleObserver |
| **SEC-066** | Platform Integration Core | L4994-L5235 | 242 | Pipeline | 1 | 1 | 各パイプラインを直列実行するコア PlatformIntegrationPipeline |

---

## 3. Boundary Verification Report

すべてのセクションの行番号範囲について、**「前セクション終了行 + 1 = 次セクション開始行」** の連続性を論理的に検証しました。

- **開始行**: `1` (SEC-001)
- **終了行**: `5235` (SEC-066)
- **境界整合性**: 100% 連続（未分類行なし、重複行なし）

---

## 4. Layer Classification Summary

レイヤーごとのセクション数とカバー行数の集計です。

- **総行数**: 5,235 行
- **ビジネスロジック関数**: 31個
- **フレームワーククラス**: 95個

| Layer | Section IDs | Responsibility |
|-------|-------------|----------------|
| **Bootstrap** | SEC-001, SEC-003, SEC-005, SEC-009, SEC-011(一部), SEC-053 | システムの初期化・グローバル変数・ヘッダー・静的コメントの管理 |
| **Logging** | SEC-002 | システムロギングおよびデバッグ出力の処理 |
| **Utility** | SEC-004, SEC-049, SEC-050 | スプレッドシート・Driveオブジェクト操作、テスト用スプレッドシートの制御 |
| **Entry Point** | SEC-006, SEC-008 | GASのdoGet / doPost WebAppエントリーポイントの管理 |
| **Routing** | SEC-007, SEC-009, SEC-040 - SEC-045, SEC-051, SEC-052 | エンドポイント解決、ルーター、ハンドラスタブ、レガシーswitchブリッジの実行 |
| **Response** | SEC-010, SEC-055 (一部) | ContentServiceによるJSON出力、ApiExceptionのマッピング処理 |
| **Business** | SEC-011 - SEC-029, SEC-046 - SEC-048 | 配布、名簿、チラシ保管庫、受渡履歴、自治体バッチ区割り書き込み等の実務処理 |
| **Storage** | SEC-033 - SEC-035 | スプレッドシート BatchReader / BatchWriter と抽象化リポジトリ管理 |
| **Pipeline** | SEC-036, SEC-038, SEC-039, SEC-055, SEC-058, SEC-061, SEC-062, SEC-064, SEC-066 | 実行コンテキスト、堅牢化(Hardening)、ライセンスエディション、機能アクセス、コア実行制御 |
| **Monitoring** | SEC-037, SEC-056, SEC-057, SEC-065 | メトリクス計測、監視イベント、ライフサイクル(Lifecycle)イベントの監視 |
| **Validation** | SEC-053, SEC-054 | 入力パラメータ、機能フラグに対する多段パイプライン検証 |
| **Authentication** | SEC-059 | LINE LIFF, API Key, 内部サービスキーに対する認証照合 |
| **Authorization** | SEC-060 | ロール・スコープ（MEMBER, LEADER, ADMIN, SYSTEM）認可マトリクス検証 |
| **Integration** | SEC-063 | AIOS Integration Bridge (タスクインテーク、メッセージ転送制御) |

---

> [!IMPORTANT]
> ## 監査免責事項
> **本監査は READ ONLY とする。監査結果に基づく修正計画は別工程で策定し、本監査ではコード・設定・Git・GASへの変更を一切行わない。**
