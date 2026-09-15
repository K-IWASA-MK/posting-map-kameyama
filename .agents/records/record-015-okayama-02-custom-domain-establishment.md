# OKAYAMA-02 証跡記録: 専用サブドメイン構築完了記録 (②-0-A)

- **記録番号**: `RECORD-015`
- **対象フェーズ**: `②-0-A: OKAYAMA-02 カスタムドメイン構築`
- **確定アーキテクチャ**: `1地区 = 1独立リポジトリ = 1独立GitHub Pages = 1独立サブドメイン = 1独立LIFF = 1独立GAS = 1独立DB`
- **対象ドメイン**: `https://okayama-02.postingmap.jp/`
- **日時**: 2026-09-08

---

## 1. 検証結果サマリ（V1〜V3 客観的エビデンス）

| 検証項目 | 期待結果 (Expected) | 実行結果 (Actual) | 客観的エビデンス | 判定 |
| :--- | :--- | :--- | :--- | :---: |
| **① 権威DNS CNAME解決** | `okayama-02.postingmap.jp` が `k-iwasa-mk.github.io` を指す | `k-iwasa-mk.github.io.` | `dig @ns1.xdomain.ne.jp okayama-02.postingmap.jp` | **PASS** |
| **② パブリックDNS解決** | Google DNS (8.8.8.8) で NOERROR & Aレコード解決 | 185.199.109.153 等 4IP解決 | `dig @8.8.8.8 okayama-02.postingmap.jp` | **PASS** |
| **③ GitHub Pages CNAME認識** | `cname: "okayama-02.postingmap.jp"`, `status: "built"` | `cname: "okayama-02.postingmap.jp"`, `status: "built"` | `gh api repos/K-IWASA-MK/posting-map-okayama-02/pages` | **PASS** |
| **④ HTTPS証明書発行 & 強制化** | Let's Encrypt証明書承認、`https_enforced: true` | `state: "approved"`, `https_enforced: true` | GitHub Pages API レスポンス | **PASS** |
| **⑤ Webアクセス疎通** | `https://okayama-02.postingmap.jp/` が HTTP 200 | HTTP/2 200 OK | `curl -ILs "https://okayama-02.postingmap.jp/"` | **PASS** |
| **⑥ 配信Config整合性** | LIFF ID `2010941735-8FCwjD6x`、岡山GAS URL配信 | 岡山2区設定値と100%一致 | `curl -s ".../config.js"` 実地取得 | **PASS** |
| **⑦ ブラウザ実機相当起動** | 個人名非露出、Console Error 0件、正常レンダリング | HTTP 200, Error 0件, 正常描画 | Playwright headless 実機テスト | **PASS** |

---

## 2. 確定されたエンドポイント情報

- **本番配信URL (Endpoint URL)**: `https://okayama-02.postingmap.jp/`
- **紐付くLIFF ID**: `2010941735-8FCwjD6x`
- **LIFF アプリURL**: `https://liff.line.me/2010941735-8FCwjD6x`
- **個人名露出**: **0件（完全非露出）**
- **他地区・親機影響**: **0件（完全独立性維持）**

---

## 3. 判定
**【②-0-A: PASS】**  
LINE DevelopersのEndpoint変更（②-0-B）および実LIFF起動確認（②-0-C）への進行を承認します。
