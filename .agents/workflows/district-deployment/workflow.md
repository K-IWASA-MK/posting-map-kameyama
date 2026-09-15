# Workflow: District Deployment（新地区展開オーケストレーション）

本ワークフローは、MASTERからの「次に`<TARGET_DISTRICT>`を作成して」という一言指示を起動トリガーとし、既存の Rule / Skill / Script / Test / Agent を定義済みの順序で接続して新地区を本番稼働状態へ導く**純粋なオーケストレーション層**である。  
ワークフロー自体に独自のデータ生成ロジックや品質基準を記述せず、実証済みの既存資産を順序正しく呼び出す責務に徹する。

---

## 🧭 全体オーケストレーション経路

```text
MASTER:「次に<TARGET_DISTRICT>を作成して」
  ↓
Flash (統括AI)
  ↓ [Entry & Readiness Check]
  │ 既存資産・外部リソース確認（不足時はMASTERへ提示・受領）
  ↓
Deployer (.agents/agents/deployer/agent.md)
  ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Copy Preparation & コピー元資産検証                 │
│         → .agents/rules/district-pre-copy-rule.md           │
│ Step 2: コピー実施確認 & Data Transition                    │
│         → .agents/rules/district-data-transition-rule.md    │
│ Step 3: Master Skill 起動 & Data Quality Gate               │
│         → .agents/skills/census-small-area-master/SKILL.md  │
│         → scripts/generate-boundaries-geojson.py            │
│         → scripts/validate-district-data-gate.mjs           │
│ Step 4: Provisioning Skill 起動 & Gate                      │
│         → .agents/skills/district-provisioning/SKILL.md     │
│         → scripts/safe-deploy.mjs                           │
│         → scripts/provision-district.mjs                    │
│         → scripts/check-provisioning-gate.mjs               │
│ Step 5: Dashboard Quality Gate & Runtime 検証               │
│         → tests/dashboard_verification_gate.mjs             │
│         → scripts/verify-runtime-integrity.mjs              │
└─────────────────────────────────────────────────────────────┘
  ↓
Auditor (.agents/agents/auditor/agent.md)
  ↓ [official-data-confirmation-audit 独立検品]
PASS
  ↓
district-deployment-recorder (.agents/agents/district-deployment-recorder/agent.md)
  ↓ [district-deployment-recording 実証記録作成]
Flash ➔ MASTER 最終完了報告
```

---

## 📋 各フェーズの執行手順

### Entry: 起動 & リソース存在確認
1. **発動契機**: MASTERからの「次に `<DISTRICT_CODE>` を作成して」という指示を受領。
2. **リソース確認**: Flashは新地区展開に必要な以下の外部リソースおよび前提情報の存在を確認する：
   - ① 新規GoogleスプレッドシートID（ファイル名が `<DISTRICT_CODE>` と一致）
   - ② Google Drive 写真保存用フォルダID
   - ③ LINE LIFF URL
   - ④ 対象自治体コード一覧および国勢調査データの配置パス
3. **境界制御**:
   - 不足がある場合: FlashはMASTERへ定型フォーマットで不足項目を提示し、受領を待つ。
   - 揃っている場合: Flashは `deployer` サブエージェントを起動し、パイプライン執行を委譲する。

---

### Step 1: Copy Preparation & コピー元資産検証
- **準拠Rule**: [district-pre-copy-rule.md](../../rules/district-pre-copy-rule.md)
- **Action**:
  - コピー前作業10項目チェックリストの全数点検。
  - 開始禁止条件（開始禁止条件7項目がすべて0件であること）を検証。
- **Gate**: コピー前ゲート PASS を確認。

---

### Step 2: コピー実施確認 & Data Transition
- **準拠Rule**: [district-data-transition-rule.md](../../rules/district-data-transition-rule.md), [district-external-data-governance-rule.md](../../rules/district-external-data-governance-rule.md)
- **Action**:
  - 親機フォルダーから新地区フォルダーへの複製実施を確認。
  - Git リモートの切り離しを確認（AGENTS.md 第0原則: 地区別完全独立リポジトリ）。
  - `data/area_mapping.json` を空配列 `[]` に初期化（実績移行地区を除く）。
  - 前地区の一次原本（`data/raw/`, `data/raw_estat_r2/` 等）の混入がないことを確認。

---

### Step 3: Master Skill 起動 & Data Quality Gate
- **準拠Skill**: [census-small-area-master](../../skills/census-small-area-master/SKILL.md)
- **Action**:
  1. `python3 scripts/generate-boundaries-geojson.py --city-codes "<自治体コード:自治体名,...>"` を実行。
  2. `address_master.csv`, `boundaries.geojson`, `municipality_master.csv` の3点を生成・配置。
  3. `node scripts/validate-district-data-gate.mjs` を実行。
- **Gate**: 全6ルール（件数整合、rowId連続性、市町村名、件数合計、座標有効性、前地区残骸ゼロ）の ALL PASS を確認。

---

### Step 4: Provisioning Skill 起動 & Gate
- **準拠Skill**: [district-provisioning](../../skills/district-provisioning/SKILL.md)
- **Action**:
  1. `deployment.json` に新地区リソースID群（`districtId`, `spreadsheetId`, `storageFolderId`, `productionLiffUrl` 等）を設定。
  2. `node scripts/safe-deploy.mjs`（`clasp push` ➔ `clasp deploy`）でGAS本番バージョンを反映。
  3. **OAuth同意チェックポイント**: エディタURLを提示し、人間へ初回権限許可を依頼して待機。
  4. `npm run sync:config` ➔ `npm run check:ssot` でクライアント設定を一方向同期。
  5. `npm run provision:district` を実行し、スプレッドシート上に12シートを完全自動生成・0件初期化・トリガー登録。
  6. `npm run check:provisioning` を実行。
- **Gate**: 12シート完全性、件数一致、SSOT一致、0%初期化の ALL GATES PASS を確認。

---

### Step 5: Dashboard Quality Gate & Runtime 検証
- **Action**:
  1. `npm run test:dashboard:gate` を実行し、Dashboard深層E2E（全6フェーズ）の検証を実施。
  2. `node scripts/verify-runtime-integrity.mjs` を実行し、HアプリおよびDashboardの実機ブラウザランタイム（Console/Networkエラー0件）を検証。
- **Gate**: 全テスト ALL PASS を確認。

---

### Step 6: Auditor 独立検品
- **準拠Agent**: [auditor](../../agents/auditor/agent.md)
- **準拠Skill**: [official-data-confirmation-audit](../../skills/official-data-confirmation-audit/SKILL.md)
- **Action**:
  - Deployer は、変更差分および取得した客観的Evidenceを「検品依頼パッケージ」として `auditor` サブエージェントへ提出。
  - Auditor が 5観点（地区非依存、スコープ厳守、客観的エビデンス、ゼロ手作業、公式データ確定）で独立査読を実施。
- **Gate**: Auditor からの PASS 判定を受領。

---

### Step 7: Recorder 実証記録
- **準拠Agent**: [district-deployment-recorder](../../agents/district-deployment-recorder/agent.md)
- **準拠Skill**: [district-deployment-recording](../../skills/district-deployment-recording/SKILL.md)
- **Action**:
  - Deployer は、Auditor PASS ログおよび実施コマンド・差分・証跡を `district-deployment-recorder` サブエージェントへ引き渡す。
  - Recorder が必須14項目を満たす `.agents/records/record-XXX.md` を作成。
- **Gate**: 記録ファイルが生成され、Gitステータスに反映されたことを確認。

---

### Step 8: 完了報告
- Flash（統括AI）が全証跡（スプレッドシート12シート生成、E2Eテスト結果、Auditor査読結果、作成記録ファイル）を取りまとめ、MASTERへ新地区の完全稼働を報告する。
