# Specification: Migration Plan (Development to Production Sales)

Version: 1.6.0 (Brand Unification Approved)
Status: APPROVED
Author: POSTING MAP Operations & Migration Department
Target System: POSTING MAP / FIELD OPERATIONS OS

---

## 1. Overview

本ドキュメントは、現在運用されている開発用環境（開発 URL、`MIE-02/H` チャネル等）から、販売版ブランド環境（独自ドメイン `posting-map.jp`、Provider `Civic Tech Inc.`、LINE Login `POSTING MAP Login`）へ安全かつシームレスに移行するための標準移行計画書（Step-by-Step Migration Guide）である。

---

## 2. Migration Overview & Target State

```
[開発環境 (Current Development)]                     [販売本番環境 (Target Production)]
- GitHub Pages: k-iwasa-mk.github.io/posting-map...   ──► - 独自ドメイン: app.posting-map.jp
- Provider: (開発個人アカウント)                       ──► - Provider: Civic Tech Inc. (構築済み)
- LIFF Name: MIE-02/H                               ──► - LIFF Name: POSTING MAP Field
- Channel: MIE-2/H                                  ──► - Channel: POSTING MAP Login (構築済み)
```

---

## 3. Step-by-Step Migration Phases

### Phase 1: Domain & DNS Foundation Setup
1. **独自ドメイン取得**: `posting-map.jp` を取得。
2. **DNS レコード設定**:
   - `app.posting-map.jp` CNAME → `area-management.github.io.`
   - `admin.posting-map.jp` CNAME → `area-management.github.io.`
3. **GitHub Pages CNAME & .nojekyll 配置**:
   - リポジトリルートに `CNAME` (`app.posting-map.jp`) および `.nojekyll` を配置しプッシュ。
4. **HTTPS 有効化の確認**: GitHub Pages の "Enforce HTTPS" をチェック。

---

### Phase 2: LINE Developers Production Environment Alignment
1. **Provider 確認**: LINE Developers コンソールにて `Civic Tech Inc.` を使用（新規作成なし）。
2. **LINE Login Channel 確認**: `POSTING MAP Login` チャネルを使用（新規作成なし）。
3. **LIFF アプリ設定・更新**:
   - LIFF Name: `POSTING MAP Field`
   - Size: `Full`
   - Endpoint URL: `https://app.posting-map.jp/active/dashboard/index.html`
   - Scopes: `profile`, `openid`
4. **本番チャネルアクセストークン確認**: Messaging API Channel (`POSTING MAP Official`) より「チャネルアクセストークン (長期)」を発行・取得。

---

### Phase 3: Client Configuration & System Property Migration
1. **`config.js` の更新**:
   - `clients/MIE-03/config.js` 等の `liffId` を本番 LIFF ID へ設定。
2. **GAS Script Properties の更新**:
   - スプレッドシート上のメニュー「💬 LINE配布員用(H)トークン設定」より、本番トークンを設定。
3. **リッチメニューの再適用**:
   - スプレッドシート上のメニュー「💬 配布員用(H)リッチメニューを自動作成・適用」を実行し、新 LIFF URL を組み込んだリッチメニューを適用。

---

### Phase 4: Customer Touchpoints & Assets Switching
1. **QRコードの確認・生成**:
   - LINE 公式アカウント (`POSTING MAP Official`) の友だち追加 QR コードおよび App 直接起動 QR コードを再生成。
2. **印刷物・案内文の差し替え**:
   - 支部・ボランティア向けマニュアル内の LINE 登録用リンク・QR コードを販売本番用に置換。

---

### Phase 5: Migration Verification Gate (移行最終検証)

移行作業後、以下の検証チェックリストを順に実行し、すべて PASS することを確認する。

| 検証項目 | 検証手順 | 合格基準 (PASS Criteria) |
| :--- | :--- | :--- |
| **1. ドメインアクセス検証** | ブラウザで `https://app.posting-map.jp/active/dashboard/index.html` へ直接アクセス | HTTP 200 OK で App スプラッシュ画面が表示されること。 |
| **2. LIFF 起動検証** | LINE アプリ内リッチメニュータップ | LIFF が開き、404 が発生せず `https://app.posting-map.jp/` 上でアプリが起動すること。 |
| **3. LINE Login 認証検証** | App 画面で「LINEでログイン」ボタンをタップ | LINE 認証完了後、プロフィール情報が画面に反映され、GAS へのユーザー登録が成功すること。 |
| **4. 共通 Dashboard 表示検証** | PC ブラウザで `https://admin.posting-map.jp/` へアクセス | Dashboard が正常読み込みされ、画面サイズ調整に応じてレスポンシブ表示されること。 |
