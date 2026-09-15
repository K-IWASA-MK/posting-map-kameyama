# POSTING MAP — AGENTS.md (基本就業規則)

## 1. Architecture — ABSOLUTE

- POSTING MAP is a standalone application and a standalone repository.
- Each district is an independent application and repository.
- active/ = district-agnostic universal engine. Never modify active/ for district specialization.
- data/ = district-specific data and client configuration (address_master.csv, boundaries.geojson, municipality_master.csv, config.js, area_mapping.json).
- Spreadsheet = Pure DB. No scripts allowed inside.
- GAS = Standalone only.
- Container-bound Apps Script is NOT part of the current architecture. Never create, restore, synchronize, or depend on it.
- District identity comes dynamically from Spreadsheet name and data/. Never hardcode district names, IDs, or endpoints in active/.

## 2. District Independence — ABSOLUTE

- Each district must operate 100% independently.
- A new district is created by copying Universal POSTING MAP and replacing data/.
- No cross-district repository, branch, code, data, or runtime dependency.
- All production resources (Spreadsheet, GAS, Drive, LIFF) are strictly isolated per district.

## 3. Execution — ABSOLUTE

- No Plan → No Proceed → No Implementation.
- Never expand scope without approval.
- Discover unexpected conditions → Report → STOP.
- Never claim PASS without objective evidence.

## 4. Data Protection

- Never modify production data outside approved scope.
- Never delete production resources without explicit approval.
- Preserve rollback until final verification passes.

## 5. Completion

- Implementation → Test → Diff/Audit → Commit → Push → Deploy → Runtime Verify.
- If any required verification FAILS: STOP.
- Git PASS is not deployment PASS.
- Production deployment requires production runtime evidence.

## 6. Detailed Rules & Workflows

AI社員は作業フェーズに応じて、必ず以下の詳細規程・ワークフローを参照・遵守すること。

- 現行アーキテクチャ定義: [docs/architecture/CURRENT_ARCHITECTURE.md](docs/architecture/CURRENT_ARCHITECTURE.md)
- 開発・完了報告手順: [.agents/workflows/development/workflow.md](.agents/workflows/development/workflow.md)
- 検証・検品規程 & HARD STOP条件: [.agents/rules/verification-gates.md](.agents/rules/verification-gates.md)
- 権限境界・Scope最小化・禁止事項: [.agents/rules/agent-authority.md](.agents/rules/agent-authority.md)
- 新地区展開ワークフロー: [.agents/workflows/district-deployment/workflow.md](.agents/workflows/district-deployment/workflow.md)
- AI社員基盤・アーキテクチャ体系: [docs/ai-foundation.md](docs/ai-foundation.md)
