# 実証記録: [record-004] 地区独立化前 安全基準・作業境界の策定

- **記録種別**: Live Verification / Planning Record
- **実施日時**: 2026-09-07 10:24 〜 10:26 JST
- **記録担当**: district-deployment-recorder
- **実務担当**: Flash (AI)
- **指揮・判断**: MASTER (人間)

---

## 1. 基本情報
- **実施した作業**: #002の完全棚卸し結果に基づき、新地区への独立化作業を開始する前に満たすべき「10の安全基準」「作業境界」「順序依存関係」「安全停止条件（HARD STOP）」を策定・明文化した。
- **対象ディレクトリ**: `/Volumes/SSD_DATA/posting-map-mie-03-clone/`
- **検証ステータス**: `[検証済PASS]`（基準策定完了・変更作業ゼロの徹底）
- **前提事実**: #002で確認された事実（Git origin切断済、GAS/スプシ/LIFF/データがMIE-03残存、`active/` コード変更不要）のみを入力として使用。

---

## 2. 10の安全基準（Safety Baseline）

新地区の独立化作業において、以下の各基準が `PASS` 条件を満たさない限り、該当する作業工程を開始してはならない。

| ID | 基準名 | PASS条件 | FAIL条件 | 確認方法 | FAIL時の処置 | 実証状態 |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **SEC-01** | **Git安全基準** | `git remote -v` が空、または新地区専用リポジトリのみであり、親製品（`posting-map.git`）への経路が完全にゼロであること。 | 親製品URLがリモートに登録されている、または未検証のリモートが存在する。 | `git remote -v` | 直ちに `git remote remove` を実行し、全Git操作を停止。 | **実証済PASS** (#001完了) |
| **SEC-02** | **親製品保護基準** | 親製品（`/Volumes/SSD_DATA/posting-map-mie-03`）のファイル数・HEAD・working tree・remoteが完全不変（0変更）であること。 | 親製品配下のファイルやGit状態に1ビットでも変化がある。 | `git -C [親パス] status` および `git -C [親パス] remote -v` | 直ちに作業をHARD STOPし、MASTERへ報告。クローンからのアクセス遮断。 | **実証済PASS** (#001, #002確認) |
| **SEC-03** | **GAS安全基準** | `.clasp.json` の `scriptId` が MIE-03 本番ID (`17VISNdx...`) ではなく、新地区専用に発行・承認されたIDであること。 | MIE-03 本番 Script ID のままである、または空・不正な値である。 | `view_file .clasp.json` | `clasp push` / `clasp deploy` 等のコマンド実行を物理的に禁止。 | **策定基準** (現在MIE-03残存中) |
| **SEC-04** | **Spreadsheet安全基準** | `deployment.json` の `spreadsheetId` が新地区専用IDであり、かつそのスプシのファイル名が新地区名と完全一致すること。 | MIE-03 本番ID (`1xQUvlCa...`) のままである、またはスプシ名と地区名が不一致。 | `deployment.json` 読み取りおよび実スプシ名の照合 | `npm run provision:district` やスプシ更新処理を絶対禁止。 | **策定基準** (現在MIE-03残存中) |
| **SEC-05** | **LIFF安全基準** | `deployment.json` の `productionLiffUrl` が新地区専用LIFF URLであること（または新地区方針として未接続を明示）。 | MIE-03 本番LIFF (`2010941735...`) を参照したままLINEログインやLIFF初期化を実行する。 | `deployment.json` および `config.js` の照合 | LIFF関連の接続テスト実行を禁止。 | **策定基準** (現在MIE-03残存中) |
| **SEC-06** | **WebApp安全基準** | `deployment.json` の `webAppUrl` および `deploymentId` が新地区GASから発行された新規エンドポイントであること。 | MIE-03 本番URL (`AKfycbyj...`) が残存した状態でローカルサーバーやAPI通信を実行する。 | `deployment.json` および `config.js` の照合 | WebAppへの通信を伴うスクリプト・検証の実行を禁止。 | **策定基準** (現在MIE-03残存中) |
| **SEC-07** | **Data安全基準** | `data/` 配下のCSV/GeoJSONが新地区のマスター一式に差し替えられ、行数・必須ヘッダー・座標が整合していること。 | MIE-03データ（四日市市や858件）が残存している、またはヘッダー欠損・GeoJSONパースエラー。 | `wc -l`, `head`, `check-provisioning-gate` | プロビジョニング処理の開始を禁止。 | **策定基準** (現在MIE-03残存中) |
| **SEC-08** | **deployment.json安全基準** | `districtId` が新地区名と完全一致し、全リソースが新地区値で満たされ、`sync:config` により `config.js` と完全同期していること。 | 必須キーの欠落、旧MIE-03値の混在、`config.js` との不一致。 | `npm run check:ssot` | SSOT同期エラーが解消されるまで次工程への進行を禁止。 | **策定基準** (現在MIE-03残存中) |
| **SEC-09** | **active/非侵襲基準** | 独立化の全工程を通じて、`active/` 配下のアプリ本体コード（JS/HTML/CSS）に1文字の差分も発生していないこと（0変更）。 | `active/` 配下のコードに変更がある、または地区固有値のハードコードが追加されている。 | `git diff active/ :!active/dashboard/config.js` が空であること | 直ちに変更をリバートし、原因を調査・報告。 | **実証済PASS** (#002で不要を実証) |
| **SEC-10** | **検証・ロールバック基準** | 自動検証ゲート（E2E、プロビジョニング）を通過し、万一失敗した場合は設定ファイルを初期状態へ巻き戻せる手順があること。 | 検証未実施でのリリース、またはロールバック手順の未定義。 | 検証スクリプト実行ログ、ロールバック手順書 | 本番リリース（COPY-READY PASS）を禁止。 | **策定基準** |

---

## 3. 作業境界の定義

独立化作業における対象リソースを以下の3種類に厳格に分類する。

```text
┌─────────────────────────────────────────────────────────────┐
│ ① 必ず変更するもの（境界リソース・設定SSOT・マスターデータ） │
│    ・deployment.json                                        │
│    ・.clasp.json                                            │
│    ・data/ (address_master.csv, municipality_master, etc.)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ npm run sync:config (自動反映)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ ② 条件成立後に変更するもの（自動同期対象）                 │
│    ・active/dashboard/config.js                             │
│    ※手動編集は絶対禁止。deployment.jsonから同期でのみ変更。│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ③ 原則変更してはいけないもの（保護・不変領域）              │
│    ・active/ のアプリケーションコード全域 【変更禁止】       │
│    ・親製品 /Volumes/SSD_DATA/posting-map-mie-03/ 【アクセス禁止】│
│    ・docs/ 配下の過去履歴・仕様書 【変更不要（保持）】       │
│    ・DEPLOYMENT_REGISTRY.md 【変更不要（保持）】            │
│    ・tests/dashboard_verification_gate.mjs 【変更不要】     │
│    ・.agents/ 配下の記録AI定義 【自己改変禁止】             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. 順序依存関係（Golden Path と 危険な逆転パターン）

### ⚠️ 危険な逆転パターン（絶対禁止）
1. **❌ データ先行投入の禁止**:
   `deployment.json` や `.clasp.json` が MIE-03 を向いたまま `npm run provision:district` を実行すると、**MIE-03 本番スプレッドシートへ新地区データが流し込まれ破壊される**。
2. **❌ GAS接続未切替でのclasp実行禁止**:
   `.clasp.json` を変更せずに `clasp push` / `clasp deploy` を実行すると、**MIE-03 本番GASプロジェクトが上書き破壊される**。
3. **❌ リソース未実在での設定更新禁止**:
   Google Drive上に新スプレッドシートが実在しない状態で `deployment.json` を更新すると、アクセス不能エラーとなる。

### 🛡️ 安全な絶対実行順序（Golden Path）
```text
【フェーズ1: 外部リソース先行作成】
  1. Google Drive上に新スプレッドシートを作成（ファイル名 = 新地区名SSOT）
  2. 新GASプロジェクトを作成・デプロイ（Script ID, Deployment ID, WebApp URL取得）
  3. 新LIFFアプリを作成（LIFF ID取得、または未接続を確定）
         │
         ▼
【フェーズ2: ローカル設定安全バインド】
  4. .clasp.json を新 Script ID に書き換え（MIE-03 GASとの接続遮断）
  5. deployment.json を新地区情報で更新（MIE-03 スプシ・WebAppとの接続遮断）
  6. npm run sync:config を実行し、config.js を自動更新
         │
         ▼
【フェーズ3: マスターデータ安全差し替え】
  7. data/ 配下のCSV・GeoJSONを新地区データへ差し替え
         │
         ▼
【フェーズ4: 独立化検証ゲート】
  8. npm run check:ssot (SSOT整合性検証)
  9. npm run provision:district (新スプシへの初回データ安全投入)
 10. npm run check:provisioning (プロビジョニングQuality Gate検証)
 11. npm run test:dashboard:gate (Playwright E2E検証)
         │
         ▼
【フェーズ5: 新Gitリポジトリ設定】
 12. 新地区用GitHubリモートを追加（git remote add origin [新URL]）
 13. 初回コミット＆プッシュ（独立製品の完成）
```

---

## 5. 安全停止条件（HARD STOP）

以下の事象が1つでも発生した場合、Flashは自己判断で処理を続行せず、**直ちに作業をSTOPして人間に報告**しなければならない。

1. **対象地区が未確定**: 新地区名（地区コード）が人間から明示指示されていない。
2. **新規リソースIDの不存在**: 新規GAS/スプシ/LIFFが実在しない、またはIDの所有者・権限が確認できない。
3. **地区名SSOT不一致**: 新スプレッドシートのファイル名と `deployment.json` の `districtId` が1文字でも異なる。
4. **MIE-03リソースへの書込み可能性の残存**: 旧IDが設定に残った状態で、push / deploy / provision が要求された。
5. **予期しないGitリモート**: Git remote に親製品URLが復活している、または不正なURLが存在する。
6. **active/の意図しない差分**: `active/` 配下に `config.js` 以外の変更が1行でも生じた。
7. **検証ゲートのFAIL**: `npm run check:ssot` や `check:provisioning` 等がエラーとなった。
8. **仕様判断の必要性**: データの欠損や仕様解釈が必要な事態において、人間の承認が得られていない。

---

## 6. 意思決定プロセス

### 人間による判断 (MASTER)
- 「今回は基準の策定のみを行う。リソース作成、設定変更、データ差し替え、Git接続、GAS/スプシ操作はすべて禁止。」
- 「#002で確認した事実だけを基準とし、安全基準を自己判断で『実証済み』と誤認させない。」
- 「実証済みの安全性（Git切断、親製品保護、active非侵襲）と、策定した安全基準（GAS/スプシ/LIFF/データ）を厳格に区別する。」

### Flashの提案
- 【提案】10カテゴリの安全基準（PASS/FAIL条件、確認方法、処置）、3層の作業境界、Golden Path順序依存関係、8つのHARD STOP条件を包含する総合安全基準書を策定。
- 【採用】提案通り採用し、完全READ ONLY（変更作業ゼロ）で文書化を完了。

---

## 7. 最終判定

**【判定】**: **🟢 BASELINE READY**

- **判定の限定的意味**:
  本判定は「新地区展開が可能である」という意味ではない。
  あくまで**「新地区展開を安全に開始するための基準・境界・順序・停止条件が漏れなく準備・明文化された」**という意味に限定される。
- **現在状態**:
  依然として `.clasp.json`, `deployment.json`, `data/` は MIE-03 の値を保持しており、実リソースの変更は一切行われていない（安全状態の完全維持）。
