# Phase 2: Repository vs Published Source Audit

## 監査日時
2026-07-24 15:10 JST (Update: 15:20 JST 証跡追記)

## 監査手法
公開中URL（`https://k-iwasa-mk.github.io/posting-map-system-dev/`）から実際のHTML等を取得し、ローカルリポジトリ内のソースコードと直接比較。

## 比較対象と結果（事実ベース）

### 1. `index.html` 直接比較 (Definitive Proof)

以下は、公開中のファイル (`/index.html`) と最新の開発ファイル (`projects/posting-map/index.html`) のソースコードの直接的な比較結果（証拠）です。

#### 証拠1: liff-hud UI の有無
* **公開中 (Published Root)**: `liff-hud` という文字列は一切存在しません。
* **最新開発 (projects/posting-map/index.html)**: 
  ```html
  <!-- Diagnostic HUD Overlay -->
  <div id="liff-hud" class="fixed top-4 left-4 right-4 bg-black/90 backdrop-blur-md text-white rounded-2xl p-4 text-xs font-mono z-[100000] border border-white/20 shadow-2xl space-y-1">
  ```
  ✅ **結論**: 公開版にはHUD実装が完全に欠落している。

#### 証拠2: renderAreaList Guard の差異
* **公開中 (Published Root)**:
  ```javascript
    function renderAreaList(main) {
      if (!appData) {
        main.innerHTML = `<div class="bg-white rounded-[2rem] p-12 text-center shadow-sm">...</div>`;
  ```
* **最新開発 (projects/posting-map/index.html)**:
  ```javascript
    function renderAreaList(main) {
      if (!appData || !Array.isArray(appData.areas)) {
        main.innerHTML = `<div class="bg-white rounded-[2rem] p-12 text-center shadow-sm">...</div>`;
  ```
  ✅ **結論**: 公開版は防御コード (`!Array.isArray`) が追加される前の古い状態である。

#### 証拠3: initLiff Recovery (PC Fallback) などのロジック変更
* **公開中 (Published Root)**:
  ```javascript
      await initLiff();
      switchTab(currentUser ? 'area' : 'settings');
  ```
* **最新開発 (projects/posting-map/index.html)**:
  ```javascript
      const ok = await initLiff();
      if (!ok) {
        hideLoading();
        // (省略: Recoveryロジックが続く)
  ```
  ✅ **結論**: 公開版は直近のコミット (`feat(liff): add PC web fallback`) によるエラーハンドリング強化が適用されていない。

### 2. その他のスクリプト (`app.js`, `render.js`, `main.js`)
* Published HTML内部の `<script>` タグにて、すべてのJSロジック（`startApp`, `renderAreaList` 等）が **インラインで記述** されていることを確認。
* 外部ファイルとしての `app.js` や `render.js` は Published 側では読み込まれていない（404 Not Found を確認済み）。

### 3. `client-loader.js`
* Published `index.html` は `projects/posting-map/client-loader.js` を参照している。
* 該当URL（`https://k-iwasa-mk.github.io/posting-map-system-dev/projects/posting-map/client-loader.js`）は正常に200 OKで配信されており、中身はリポジトリの該当ファイルと一致。

## 結論
以上のソースコード単位の厳密な比較証拠により、現在公開されている **GitHub Pages の配信ファイルは、直近の開発更新（liff-hud, 防御コード, initLiff回収）を一切含んでいない「古いルートディレクトリの index.html」であると 100% 確定** できました。
