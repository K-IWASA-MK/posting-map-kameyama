# RECORD-020: KAMEYAMA インフラ接続・実行基盤および自動プロビジョニング確立記録

- **日付**: 2026-09-15
- **担当**: 地区独立化・インフラ自動化専任 AI
- **対象**: KAMEYAMA（三重県亀山市完全独立アプリ）
- **判定結果**: **【PASS】（全14判定項目およびプロビジョニング全7品質ゲート PASS / ゼロ手作業原則確立）**

---

## 1. インフラ接続・実行基盤のアーキテクチャ定義

KAMEYAMA standalone インフラの全接続経路および自動構成ルールを以下の通り特定し、記録する。

### ① Standalone GAS プロジェクト作成
- コマンド: `npx clasp create --title "POSTING-MAP-KAMEYAMA" --type standalone --rootDir ./active`
- Script ID: `1CJ21XX14UpGV8wsjUCcoaNCdlrbjoYjVoNvYFZ8ef7i14jFqmoK1_jZt`
- 配置設定: `.clasp.json` (rootDir: `active`)

### ② WebApp 権限および OAuth 設定 (`active/appsscript.json`)
GAS WebApp の匿名アクセス（`ANYONE_ANONYMOUS`）および権限スコープを規定：
```json
{
  "timeZone": "Asia/Tokyo",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}
```

### ③ 本番デプロイおよび Web App URL 発行
- コマンド: `npx clasp push` ➔ `npx clasp deploy --description "KAMEYAMA Production Deployment v1"`
- Deployment ID: `AKfycbxKnREpkQYI-VoAccxvnJ1VkiBCwTf5a8TnjC0rfaYM_Qks2jsGlqTKSyG3qnbL2eD9`
- Web App URL: `https://script.google.com/macros/s/AKfycbxKnREpkQYI-VoAccxvnJ1VkiBCwTf5a8TnjC0rfaYM_Qks2jsGlqTKSyG3qnbL2eD9/exec`

### ④ プロパティ自動設定（Script Properties 手入力ゼロプロトコル）
- **Bootstrap API**: Web App へ `bootstrapEnvironment` (POST) を送信し、`DISTRICT_ID`, `TARGET_SPREADSHEET_ID`, `STORAGE_PARENT_ID` を GAS 内部で自動書き込み。
- **Provisioning API**: `npm run provision:district`（`scripts/provision-district.mjs`）を実行。
  - `.env` から `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_ID` を自動取得し、GASへ送信。
  - GAS内部の `SystemInfoService.syncSystemInfo` が Script Properties へ自動書き込み。
  - スプレッドシート上に `SYSTEM_INFO` および 11シートを自動生成・0件初期化・トリガー登録。

---

## 2. 実機ランタイム検証結果 (E2E Verification)

本番実URL `https://kameyama.postingmap.jp/` の実機ブラウザE2E検証結果：

1. **GitHub Pages Custom Domain**: `kameyama.postingmap.jp` (verified)
2. **HTTPS Enforced**: `https_enforced: true` (証明書承認済み: `expires_at: 2026-12-14`)
3. **HTTP Status**: 200 OK
4. **Client Config**: `data/config.js` 同期完了 (WebApp URL & LIFF ID `2010941735-IbOXhzpJ`)
5. **Spreadsheet Access**: ライブ疎通完了 (`districtName: KAMEYAMA`, 686件)
6. **Address Master CSV**: 686件 100% ロード成功
7. **Quality Gate**: `npm run check:provisioning` 全7品質ゲート ALL PASS
8. **Console Errors / Network Errors**: 0件

---

## 3. 永久遵守プロトコル (Knowledge Assets)

今後、あらゆる地区展開において本インフラ接続手順を遵守し、GAS設定画面（UI）での手動プロパティ入力を永久に禁止する。
プロパティの設定は必ず `bootstrapEnvironment` POST API および `npm run provision:district` パイプラインにより自動化する。
