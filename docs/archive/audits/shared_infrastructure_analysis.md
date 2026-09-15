# Shared Infrastructure Analysis - active/api/v2_api.js
Version: 1.0
Status: SSOT (READ ONLY AUDIT)

---

## 1. Infrastructure Component & Ownership Inventory

`v2_api.js` で使用されている共有インフラストラクチャ（共通基盤・シングルトンプロバイダ・GASエンジン）の一覧、およびその所有セクション（Owner Section）と接続数です。

| Component Name | Owner Section | Access Sections (直接呼出数) | Dependency Type | State Management Method |
|----------------|---------------|:----------------------------:|-----------------|-------------------------|
| **Spreadsheet Wrapper (`getSS()`)** | **SEC-004** | 24 | Custom Wrapper | キャッシュなしの直接バインディング |
| **Configuration Provider (`CONFIG`)** | **SEC-030** | 31 | Custom | スクリプトプロパティ ＋ インメモリキャッシュ |
| **Cache Service Wrapper** | **SEC-031** | 8 | Custom Wrapper | GAS CacheService をラップしたオンメモリ |
| **Lock Service Wrapper** | **SEC-032** | 6 | Custom Wrapper | GAS LockService を用いた排他ロック制御 |
| **Trace Logging (`traceLog()`)** | **SEC-002** | 5 | Custom | スプレッドシート `TraceLog` シートへの直接追記 |
| **Execution Context (`executionContext`)**| **SEC-036** | 18 | Custom | グローバル変数 ＋ コンテキストクラス |
| **Spreadsheet Service (`SpreadsheetApp`)**| なし (GAS Engine)| 38 | Native GAS | GASネイティブ スプレッドシート API |
| **Lock Service (`LockService`)** | なし (GAS Engine)| 2 | Native GAS | GASネイティブ ロック API |
| **Properties Service (`PropertiesService`)**| なし (GAS Engine)| 4 | Native GAS | GASネイティブ プロパティストア API |

---

## 2. Initialization Source & Lifecycle (インフラ・ライフサイクル)

各インフラのライフサイクル（生成、初期化、解放）の制御タイミングです。

| Component Name | Created By (生成元) | Initialized By (初期化トリガー) | Released By (解放 / 終端) |
|----------------|--------------------|---------------------------------|---------------------------|
| **Spreadsheet Wrapper (`getSS()`)** | Global Scope / Runtime | `getSS()` 初回呼び出し時 (`SpreadsheetApp.openById`) | GAS Execution Terminated (プロセス終了時) |
| **Configuration Provider (`CONFIG`)** | Global Scope (L1680) | `GasConfigurationProvider.getInstance()` 初回呼出 | GAS Execution Terminated |
| **Cache Service Wrapper** | Global Scope (L1714) | `CacheServiceProvider.getInstance()` 初回呼出 | GAS Execution Terminated (※キャッシュは最大6時間維持) |
| **Lock Service Wrapper** | Global Scope (L1744) | `LockServiceProvider.executeWithLock()` 呼び出し時 | `finally` ブロックによる明示的 releaseLock、またはタイムアウト |
| **Trace Logging (`traceLog()`)** | Global Scope (L19) | `traceLog(message)` 関数呼び出し時 | `sheet.appendRow` & `SpreadsheetApp.flush()` 後即時 |
| **Execution Context (`executionContext`)**| Global Scope (L101) | `PlatformIntegrationPipeline.execute()` 開始時 | Pipeline 終了時の `lastContext = null` によるGC解放 |
| **Spreadsheet Service (`SpreadsheetApp`)**| GAS Engine | GAS Engine | GAS Engine |
| **Lock Service (`LockService`)** | GAS Engine | GAS Engine | GAS Engine |
| **Properties Service (`PropertiesService`)**| GAS Engine | GAS Engine | GAS Engine |

---

## 3. Infrastructure Usage Matrix

各セクションから共有インフラコンポーネントへの具体的な呼び出し件数およびユニーク依存数（Unique Functions / Classes）です。

| Infrastructure Component | From Section (主な参照元) | Total Calls (総呼出数) | Unique Callers (ユニーク数) | Access Mode (読み・書き・ロック) |
|--------------------------|---------------------------|:---------------------:|:--------------------------:|---------------------------------|
| **Spreadsheet Wrapper (`getSS()`)** | Business層, Storage層, Auth | 30 | 22 | Read / Write |
| **Configuration Provider (`CONFIG`)** | Business層, Auth, Pipeline | 31 | 18 | Read |
| **Cache Service Wrapper** | EndpointRegistry, Router | 8 | 4 | Read / Write |
| **Lock Service Wrapper** | Pipeline, submitDistribution | 6 | 4 | Locked (排他制御) |
| **Trace Logging (`traceLog()`)** | SEC-018, SEC-020, SEC-059 | 15 | 4 | Write (ログ追記) |
| **Execution Context (`executionContext`)**| Pipeline, Routing, Integration| 18 | 9 | Read / Write |

---

## 4. Infrastructure Coupling Index (インフラ間結合)

共有インフラコンポーネント同士の静的な内部依存関係の抽出データです。

- **`CacheServiceProvider` → `LockServiceProvider`** (1 接続)
  - *理由: キャッシュキーの書き込み競合を防ぐため、`CacheServiceProvider` 内部で `LockServiceProvider.getInstance()` を呼び出して排他ロックを獲得する設計になっているため。*
- **`GasConfigurationProvider` → `LockServiceProvider`** (1 接続)
  - *理由: スクリプトプロパティの書き込み時のデッドロックを防止するため、設定更新時に `LockServiceProvider` を呼び出す構造になっているため。*
- **`LockServiceProvider` → `LockService` (Native)** (2 接続)
  - *理由: `LockService.getScriptLock()` および `tryLock()` の実行。*
- **`GasConfigurationProvider` → `PropertiesService` (Native)** (4 接続)
  - *理由: `PropertiesService.getScriptProperties()` および `getProperty()`, `setProperty()` の実行。*

---

## 5. Infrastructure Access Patterns (アクセス分類)

用途別のアクセスパターンの抽出データです。

- **ReadOnly (読み取りのみ)**:
  - `CONFIG.get()` (名簿や履歴のシート名、LINE Token等の設定値取得)
  - `CacheServiceProvider.getInstance().get()` (各リクエストのキャッシュヒット判定)
  - `getSS()` (Roster や AreaDetails の単なる情報取得時)
- **Write (書き込み)**:
  - `traceLog()` (業務例外、実行トレースのスプレッドシート追記)
  - `getSS().getSheetByName().getRange().setValues()` (スタッフ登録、配布実績書き込みなどの更新処理)
- **Locked / Transaction (排他ロックトランザクション)**:
  - `LockServiceProvider.executeWithLock()` (doPost、resetRoster、submitDistribution、registerStaff 実行時のデータ書き込み競合を防止するクリティカルセクション処理)

---

## 6. Refactoring Constraint Inventory (インフラ編)

共有インフラを分離・独立させる際に生じる技術的制約および運用の事実です。

- **オンメモリ状態の持続時間限界 (リクエスト毎の破棄)**:
  - GAS Web App はリクエストが完了するとプロセスが終了するため、`PlatformExecutionContext` やシングルトンクラスのインスタンス変数といったオンメモリ状態はリクエスト間で永続化できません。そのため、永続化状態は必ず `PropertiesService` や `Spreadsheet` を経由しなければならない制約。
- **排他ロックによる同期デッドロックリスク**:
  - `LockServiceProvider` が ScriptLock を獲得している間、同一の Deployment URL に対する他の API リクエストは `tryLock` 内で待機状態（最大10秒）に入ります。このため、時間のかかるビジネスロジック（重いバッチなど）をロック内で実行すると、リクエストキューの滞留やタイムアウトを引き起こす制約。
- **グローバルホイスティング順序依存**:
  - `CONFIG = GasConfigurationProvider.getInstance()` などの初期化文がグローバル空間に記述されているため、クラス定義（ホイスティング対象）と変数代入の実行順序が崩れると `TypeError` になる制約。

---

> [!IMPORTANT]
> ## 監査免責事項
> **本監査は READ ONLY とする。監査結果に基づく修正計画は別工程で策定し、本監査ではコード・設定・Git・GASへの変更を一切行わない。**
