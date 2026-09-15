# Workflow: Development (開発・完了報告フロー)

AI社員の作業は、必ず以下の「8-Stage Execution Protocol」と「Verification Gate」に従う。この順序の省略・逆転・自己判断による短縮は絶対禁止とする。

---

## 8-Stage Execution Protocol

### Stage 1: Plan (調査・計画策定)
- READ ONLYで対象範囲と既存実装を調査。
- Scope（変更対象ファイル）を最小限に確定する（全域ホワイトリスト運用の絶対禁止）。
- `implementation_plan.md` を作成し、完了条件および Verification Plan を定義する。

### Stage 2: Approve (MASTER承認)
- MASTER(User)から明示的な `Proceed` を取得する。
- 取得前の実装、Commit/Push/Deployは絶対禁止。
- 承認受領後、コード変更前に `.agents/current-scope.json` を単独コミットする（Phase 1 Scope Commit）。

### Stage 3: Implement (実装)
- 承認されたScope内のみを変更。Scope外変更、仕様の自己定義は禁止。
- **指示外変更の即時停止（発見 ➔ 報告 ➔ STOP）**: 作業中に別機能や他ファイルの改善点・問題を発見した場合、勝手に修正コードを追加してはならない。
- **失敗時の自己拡張禁止**: テスト失敗時に自己判断でScope外ファイルへ修正を拡大してはならない。Scope外が必要な場合は作業をSTOPして追加指示を仰ぐ。

### Stage 4: Verify (検証 & ガバナンス監査)
- V1〜V3検証を実施し、客観的Evidence（証跡5項目）を取得する。
  - **V1 Static Verification**: `git diff`, `git diff --check`, Scope確認, 構文/Lint, Dead Code確認。
  - **V2 Runtime Verification**: 実機起動、DOM/Console/Network等の確認（静的確認のみでのPASS禁止）。
  - **V3 Regression Verification**: 既存機能への副作用がないことの確認。
  - **Auditor Subagent Verification**: 独立検品サブエージェント（`.agents/agents/auditor/agent.md`）へ検品依頼パッケージを渡し、3観点でのPASSを取得。
  - **Mechanical Governance Gate**: `npm run audit:gate` を実行し、Scope Guardおよび機械監査を通過する。
- 問題があればScope内で修正し、PASSするまで再検証を繰り返す。

### Stage 5: Commit Gate
- V1〜V3検証PASS、Auditor Subagent PASS、Mechanical Governance Gate通過、Scope監査（Staged Diff）がすべて完了した場合のみCommitを許可。

### Stage 6: Push Gate
- Commit存在確認、Scope確認、必要な自動監査（Governance Gate等）を通過した場合のみPushを許可。

### Stage 7: Crisp Deployment Gate
- Push完了後、実稼働環境への反映が必要な変更（Deployment対象変更）である場合、独立工程として実際の稼働環境へのデプロイを実施する。
- 実環境への反映を必要としない変更は「Deployment対象外」と明示的に判定・記録すること。対象外であることを根拠なく推測してはならない。

### Stage 8: V4 Deployment Verification & Completion
- **V4成立条件**: Deployment対象なら「実環境で反映を確認した客観的Evidence」、Deployment非対象なら「対象外であることの客観的確認Evidence」を取得し、いずれの場合もそのEvidenceをもってV4 PASSとする。
- **重要**: `git status`、`git log`、`Script is already up to date.` 等のGit/Crisp実行結果だけでは、V4 Deployment VerificationのEvidenceとして扱わない。
- **Evidence不足の場合**: PASSせず即時HARD STOPし、MASTERへ報告すること。
- V4 PASS後にのみ、最終的なGit確認（HEAD一致、working tree clean）と完了報告（Completion Report）を行える。

---

## 完了報告の禁止事項

以下の状態で「完了報告」として提出することは絶対禁止とする：
- 「あとでcommitします」「あとでpushします」という状態。
- 「ユーザーに実機確認してもらう」「検証は別途行う」状態。
- 「問題ないと思われる」「コード上は正しいはず」という推測状態。
- 報告時点で未解決のエラーが存在する状態。
