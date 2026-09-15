# Phase 5: Cache Investigation

## 監査日時
2026-07-24 15:10 JST

## 監査手法
`curl -I https://k-iwasa-mk.github.io/posting-map-system-dev/` にてHTTPレスポンスヘッダを取得・分析。

## 監査結果（事実ベース）

### 1. サーバーサイドキャッシュ (GitHub Pages / Fastly CDN)
* **`Cache-Control`**: `max-age=600` (10分間キャッシュ有効)
* **`ETag`**: `"6a626139-24a3"`
* **`x-cache`**: `MISS`
* **`x-cache-hits`**: `0`

初回取得時に `MISS` を記録しており、最新のデータをサーバーから直接取得できていることが確認されました。これにより「CDNレイヤーでのキャッシュ残存が原因で古いファイルが配信されている」という仮説は否定されます。

### 2. クライアントサイドキャッシュ (ブラウザ / PWA)
* **Service Worker**: `service-worker.js` はリポジトリ内に存在しますが、今回は HTTP クライアント (curl) による直接リクエストで古い HTML が返却されたため、ブラウザ側の Service Worker や IndexedDB / LocalStorage の影響ではありません。
* **Manifest**: 今回の事象の根本原因とは無関係。

## 結論
配信元の GitHub Pages サーバー自体が、意図した修正が含まれていない古いファイルを正式な最新版として返却しています。したがって、**本件はキャッシュの問題（CDN、ブラウザ、Service Worker）ではありません**。
