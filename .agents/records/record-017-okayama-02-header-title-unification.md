# RECORD-017: OKAYAMA-02 LIFFアプリLINEヘッダー1行目「POSTING MAP」統一記録

- **日付**: 2026-09-08
- **担当**: 地区独立化・フロントエンドUI AI
- **対象**: OKAYAMA-02（岡山県第2区完全独立アプリ）
- **判定結果**: **【PASS】（document.title: POSTING MAP / window.__districtName: OKAYAMA-02）**

---

## 1. 実施概要

LIFFアプリをLINE内ブラウザで開いた際、ヘッダー上部（1行目）のタイトル表示を全地区共通のサービスブランド名「**POSTING MAP**」に統一した。
下段（2行目）の地区専用サブドメイン（`okayama-...stingmap.jp`）と組み合わせることで、
```text
┌────────────────────────────────────────┐
│              POSTING MAP               │ ← アプリ名・ブランド
│         okayama-...stingmap.jp         │ ← 地区専用環境（岡山2区）
└────────────────────────────────────────┘
```
という、公式アプリとしての統一感と識別性を両立した美しいヘッダー表示を確立した。

---

## 2. 修正内容

### `active/dashboard/app.js` (1429〜1433行目)
- **修正前**:
  ```javascript
  if (summaryData.districtName) {
    window.__districtName = summaryData.districtName;
    document.title = summaryData.districtName; // ← 地区コード「OKAYAMA-02」で上書きされていた
  }
  ```
- **修正後**:
  ```javascript
  if (summaryData.districtName) {
    window.__districtName = summaryData.districtName;
    document.title = "POSTING MAP"; // ← ブランド名「POSTING MAP」に統一
  }
  ```
- **設計ポイント**:
  - `window.__districtName` へのスプレッドシート名SSOT（`OKAYAMA-02`）の格納は完全に維持し、アプリ内のIDカード・地区表示ロジックを100%保護。
  - ブラウザヘッダー用の `document.title` のみを「`POSTING MAP`」に統一。
  - コード内に特定の地区名が入らないため、他地区へのコピー適性（COPY-READY）を完全維持。

---

## 3. Verification Evidence (双方向アサーション証跡)

Playwright（ヘッドレスブラウザ）により、LIFFログイン済み実働状態で `active/dashboard/index.html` を起動し、GASデータ受信完了後の状態を機械的に検証した。

### ① 双方向アサーション結果
- **Test**: `document.title` が「POSTING MAP」に更新され、かつ `window.__districtName` が「OKAYAMA-02」として維持されていること
- **Expected**:
  - `document.title === "POSTING MAP"`
  - `window.__districtName === "OKAYAMA-02"`
  - `Console Errors === 0`
- **Actual**:
  ```text
  === ASSERTION RESULTS ===
  document.title:         POSTING MAP
  window.__districtName:  OKAYAMA-02
  PMS_CLIENT_CONFIG:      true
  Console Errors count:   0 []

  🎉 ALL ASSERTIONS PASSED PERFECTLY!
    ✅ document.title === "POSTING MAP"
    ✅ window.__districtName === "OKAYAMA-02"
    ✅ Console Errors === 0
  ```
- **Judgment**: **PASS**

### ② 回帰テスト（Regression Check）
- `node scripts/test_browser_h_app.mjs`:
  - LOCAL SERVER & PRODUCTION ENDPOINT (`https://okayama-02.postingmap.jp/`):
  - Console Errors: 0件
  - Failed Requests: 0件
  - ワークフローステップ（ログイン、ピン一覧、GPS、カメラ、テンキー等）: すべて true

---

## 4. 総合判定

**【PASS】LIFFアプリLINEヘッダー1行目「POSTING MAP」統一完了**

地区名SSOT（`OKAYAMA-02`）を内部で正常保持したまま、ヘッダー表示をブランド名「`POSTING MAP`」へ安全に統一完了しました。
