# doPost Audit Report (P0-1)

## 目的
POSTING MAP Version 1.0 において、`doPost` のグローバルスコープ重複によるルーティング障害を解決するため、すべての `doPost` 定義を監査し、正規エントリポイントを特定する。

## 監査結果一覧

| No | ファイル名 | 関数名 | 役割・処理内容 | Version1.0利用有無 | 修正方針 |
|---|---|---|---|---|---|
| 1 | `active/api/v2_api.gs` | `doPost(e)` | `PlatformIntegrationPipeline.execute(e)` を呼び出す。従来のAPIの正規エントリポイント。 | **利用中** | 修正対象外（残す） |
| 2 | `active/gas/99_entry.gs` | `doPost(e)` | `PlatformIntegrationPipeline.execute(e)` を呼び出す。GASの評価順序（ファイル名アルファベット順で末尾にするため）を考慮して生成されたと推測されるエントリポイント。 | **利用中** | 修正対象外（残す）※1 |
| 3 | `active/gas/v2_kernel.gs` | `doPost(e)` | 受信したPOSTデータを `event_id` 等を持つAIOSカーネルイベント（リアルタイムストリーム）として処理しようとし、`sync_state` のエラーを吐く。 | **未使用**（将来構想） | **リネーム（無効化）** |

※1: `v2_api.gs` と `99_entry.gs` で `doPost` が重複しているが、どちらも同一の処理（`PlatformIntegrationPipeline`）を呼び出しているため、競合してもルーティング上の実害はない。今回の問題の根本原因は `v2_kernel.gs` の意図しない上書きである。

## 影響範囲確認（Blast Radius）
正規の doPost である `PlatformIntegrationPipeline.execute(e)` は、内部で以下のルーティングを行います。
1. `EndpointRegistry` からハンドラ（Dashboard用など）を取得。
2. 無ければ `LegacyApiFallbackHandler` へフォールバックし、Hアプリ等の旧API（`submitDistribution` 等）を処理する。

**利用元（呼び出し元）の確認:**
*   **Hアプリ:** `submitDistribution`, `registerStaff` 等のPOST通信はすべて `LegacyApiFallbackHandler` に依存しているため、正規doPostの復元で動作する。
*   **Dashboard:** `PlatformIntegrationPipeline` を前提としているため、動作する。
*   **Webhook / Nodeテスト:** 同上。

**結論:** `v2_kernel.gs` の `doPost` を無効化することで、Version 1.0 で利用中のすべての正規ルートが復旧し、意図しない副作用は発生しない。
