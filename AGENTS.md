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

## 2. District Independence & Repository Boundary — ABSOLUTE

- Each district must operate 100% independently.
- A new district is created by copying Universal POSTING MAP and replacing data/.
- No cross-district repository, branch, code, data, or runtime dependency.
- All production resources (Spreadsheet, GAS, Drive, LIFF) are strictly isolated per district.

### リポジトリ境界・他地区参照禁止【永久原則】
- 現在作業対象としているリポジトリのGit rootを作業・探索・検索・読み取り・操作の絶対境界とする。
- SSD上に存在する他地区（OKAYAMA-02、KUWANA等）のリポジトリやフォルダーを、通常時・監査時・実装時・比較時を問わず参照・探索・検索・読み取りしない。
- 「参考」「比較」「検証」の目的でも他リポジトリを見ない。
- 他リポジトリのコード、データ、設定、Git履歴、監査結果、Runtime情報等を判断材料に使用しない。
- リポジトリ内部だけでは判断できない事項は、他地区を見て補完・推測せず UNDETERMINED とする。
- 「アクセスできる」と「参照してよい」は別であり、現在のリポジトリ以外はAIエージェントにとって存在しないものとして扱う。
- 複数リポジトリを同時に参照しない。

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
