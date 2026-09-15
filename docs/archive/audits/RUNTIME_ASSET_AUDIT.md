# Phase 4: Runtime Asset Audit

## 監査日時
2026-07-24 15:10 JST

## 監査手法
HTTPクライアント(`curl -sS https://k-iwasa-mk.github.io/posting-map-system-dev/`) を利用し、実行環境においてブラウザに配信されるファイルの中身を直接検査。

## 監査結果（事実ベース）

### 1. HTML (`https://k-iwasa-mk.github.io/posting-map-system-dev/`)
* **`liff-hud`**: 存在しない（取得したHTMLソース内に `<div id="liff-hud">` は含まれていない）。
* **`renderAreaList` Guard**: 古いコード `if (!appData)` が存在しており、強化版の `if (!appData || !Array.isArray(appData.areas))` にはなっていない。
* **`initLiff` Recovery**: 存在しない（直近コミットで実装された `feat(liff): add PC web fallback` が反映されていない）。

### 2. JS / CSS
* アプリケーションロジック（`app.js`, `render.js`, `main.js` 相当）は **`index.html` 内部のインライン `<script>` タグ** にすべて格納されており、外部JSファイルとしては読み込まれていない。
* CSS は Tailwind の CDN (`https://cdn.tailwindcss.com`) と、`index.html` 内の `<style>` ブロックにインラインで定義されている。
* 外部JSとして読み込まれているのは以下の2点のみ:
  1. `https://static.line-scdn.net/liff/edge/2/sdk.js`
  2. `projects/posting-map/client-loader.js`

## 結論
配信サーバーから直接取得したランタイムアセットにおいて、**要求されている修正（HUD表示やフェイルセーフ対応）が欠落している** ことが明確に確認されました。これはブラウザキャッシュのせいではなく、サーバーが実際に古いソースコード（ルートディレクトリの `index.html`）を返却しているためです。
