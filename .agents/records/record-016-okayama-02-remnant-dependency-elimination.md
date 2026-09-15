# RECORD-016: OKAYAMA-02 MIE-03残存依存 完全除去＆自己完結証明記録

- **日付**: 2026-09-08
- **担当**: 地区独立化・監査AI
- **対象**: OKAYAMA-02（岡山県第2区完全独立アプリ）
- **判定結果**: **【PASS】（MIE-03残存依存 0件 / OKAYAMA-02 自己完結達成）**

---

## 1. 実施概要

OKAYAMA-02完全独立アプリにおいて、親機（MIE-03）への残存依存を全レイヤー（コード・HTML・GAS・DB・ドメイン・LIFF）から完全に排除し、OKAYAMA-02単独で完全に自己完結する状態を確立・証明した。

### 修正内容（4点＋インフラ動的化）
1. **`index.html`**: OGPタグ内の親機ハードコードURL（`https://k-iwasa-mk.github.io/posting-map/`）を排除し、画像参照を相対パス `./active/dashboard/assets/icon180-v2.png` へ安全化。
2. **`active/dashboard/v2_ui.js`**: `createRichMenuForHApp()` 内のハードコード画像URL（`k-iwasa-mk.github.io/posting-map/assets/richmenu_default.png`）を排除し、`SYSTEM_INFO` シートの `HアプリURL`（SSOT）から `${hAppUrl}/assets/richmenu_default.png` を動的に組み立ててUrlFetchする構造へ改修。
3. **`active/manager/index.html`**: ルート絶対パス `<script src="/active/dashboard/config.js"></script>` を相対パス `<script src="../dashboard/config.js"></script>` へ安全化。
4. **`active/business/system/system_info_service.js` & `active/business/system/district_provisioner.js`**: ハードコードされた `'https://postingmap.jp'` フォールバックを完全排除し、引数で渡された `baseUrl` または既存シート値を厳密に使用する構造へ改修。
5. **`scripts/provision-district.mjs`**: `CNAME`（`okayama-02.postingmap.jp`）または環境変数 `DISTRICT_BASE_URL` から動的に `districtBaseUrl` を解決してGAS APIへ注入するパイプラインを確立。

---

## 2. Verification Evidence (5項目要件)

### ① 静的依存スキャン（MIE-03 残存参照 0件監査）
- **Test**: `active/`, `scripts/`, `index.html`, `deployment.json` 全域における親機ドメイン・親機リポジトリ・旧LIFF ID・旧スプシIDの残存検索
- **Expected**: すべて 0件（バリデーション用キーワードリスト定義部を除く）
- **Actual**:
  - `git grep "k-iwasa-mk.github.io/posting-map"`: **0件**
  - `git grep "2010941735-GRLuqPic"`: **0件**
  - `git grep "1xQUvlCa"` (MIE-03 スプシID): **0件**
  - `git grep "AKfycbx"` (MIE-03 GAS ID): **0件**
  - `git grep "'https://postingmap.jp'"`: **0件**
- **Evidence**: `git grep` 実行ログ
- **Judgment**: **PASS**

### ② 本番DB SYSTEM_INFO シート同期監査
- **Test**: GAS本番API `action=getSystemInfo` による本番スプレッドシート（`1-fg6TlrE68ThUjGmJa7ly5_B6HZ3b8mzGCejSKUOY5o`）の全行データ検証
- **Expected**: `HアプリURL`, `Dashboard URL`, `Endpoint URL` がすべて `https://okayama-02.postingmap.jp/` に更新され、`postingmap.jp` 単独参照が 0件 であること
- **Actual**:
  ```json
  {
    "success": true,
    "spreadsheetName": "OKAYAMA-02",
    "spreadsheetId": "1-fg6TlrE68ThUjGmJa7ly5_B6HZ3b8mzGCejSKUOY5o",
    "systemInfoRows": [
      ["項目", "内容"],
      ["地区コード", "OKAYAMA-02"],
      ["地区名", "OKAYAMA-02"],
      ["HアプリURL", "https://okayama-02.postingmap.jp/"],
      ["Dashboard URL", "https://okayama-02.postingmap.jp/active/manager/"],
      ["LIFFアプリ名", "POSTING MAP OKAYAMA-02"],
      ["LIFF ID", "2010941735-8FCwjD6x"],
      ["LIFF URL", "https://liff.line.me/2010941735-8FCwjD6x"],
      ["Endpoint URL", "https://okayama-02.postingmap.jp/"],
      ["Dashboard契約数", 2],
      ["Dashboard端末", "PC-01, PC-02 / MOBILE-01, MOBILE-02"],
      ["状態", "ACTIVE"]
    ]
  }
  ```
- **Evidence**: `curl -sL "https://script.google.com/macros/s/AKfycbziJy-eQ4g3sJ9BytSZO1XX1Ri7zclrf7ov6qG2HI0RAbn5L9nNisXUyA10Q6IE0OEI/exec?action=getSystemInfo"` レスポンス
- **Judgment**: **PASS**

### ③ GAS Web App 本番デプロイ監査
- **Test**: `npm run deploy:gas` による Version @11 の生成と、稼働デプロイ（`AKfycbzi...`）への即時バインド、ヘルスチェック
- **Expected**: clasp push 42ファイル成功、新規バージョン @11 発行、`verify:gas` HTTP 200 PASS
- **Actual**:
  - Active Version: `@11`
  - Gate 1 Result: PASS (HTTP 200 Received, 1380 ms)
  - Gate 2 Result: PASS (Backend Execution Confirmed, 1311 ms)
- **Evidence**: `deploy:gas` 実行ログ
- **Judgment**: **PASS**

### ④ Hアプリ実機E2E動作監査
- **Test**: Playwright によるHアプリの起動、岡山5自治体描画、住所マスター508ピンプロット、現場ワークフロー動作検証
- **Expected**: 508件ピン読み込み、5自治体認識、Console Errors 0件、Failed Requests 0件
- **Actual**:
  - Configuration LIFF ID: `2010941735-8FCwjD6x`
  - Loaded Master Pins Count: **508**
  - Recognized Cities: 岡山市中区, 岡山市東区, 岡山市南区, 玉野市, 瀬戸内市 (5自治体)
  - Console Errors: **0件**
  - Failed Requests: **0件**
  - ワークフローステップ（GPS, カメラ, テンキー, 提出等）: **すべて true**
- **Evidence**: `scripts/verify_happ_detail.mjs` および `scripts/test_browser_h_app.mjs` 実行ログ
- **Judgment**: **PASS**

### ⑤ Manager Dashboard 動作監査
- **Test**: Playwright による `/active/manager/index.html` へのアクセスと、相対パス `../dashboard/config.js` 読み込み・初期化検証
- **Expected**: `window.PMS_CLIENT_CONFIG` 正常定義、LIFF ID `2010941735-8FCwjD6x` 取得、Console Errors 0件
- **Actual**:
  - `hasConfig`: true
  - `liffId`: `2010941735-8FCwjD6x`
  - `gasUrl`: `https://script.google.com/macros/s/AKfycbziJy-eQ4g3sJ9BytSZO1XX1Ri7zclrf7ov6qG2HI0RAbn5L9nNisXUyA10Q6IE0OEI/exec`
  - `Console Errors`: **0件**
  - `Internal Failed Requests`: **0件**
- **Evidence**: `scratch/test_manager_app.mjs` 実行ログ
- **Judgment**: **PASS**

---

## 3. 自己完結状態（Self-Containment）対照表

| レイヤー | OKAYAMA-02 実装状態 | 親機 (MIE-03) 依存 | 判定 |
|---|---|---|---|
| **Repo** | `K-IWASA-MK/posting-map-okayama-02` (完全独立リポジトリ) | なし | **PASS** |
| **Pages** | `https://okayama-02.postingmap.jp/` (専用サブドメイン・HTTPS) | なし | **PASS** |
| **LIFF** | `2010941735-8FCwjD6x` (岡山2区専用LIFF) | なし | **PASS** |
| **GAS** | スタンドアロンAPI `@11` (`AKfycbzi...`) | なし | **PASS** |
| **DB** | `1-fg6TlrE68ThUjGmJa7ly5_B6HZ3b8mzGCejSKUOY5o` (508件・12シート) | なし | **PASS** |
| **Runtime** | Hアプリ (508ピン) / Manager Dashboard (相対パス解決) | なし | **PASS** |

---

## 4. 総合判定

**【PASS】OKAYAMA-02 MIE-03残存依存 完全除去＆自己完結達成**

OKAYAMA-02はMIE-03を一切知ることなく、自身のリポジトリ、ドメイン、GAS、DB、LIFFのみで100%独立して稼働することが客観的証跡によって完全に証明されました。
