# AI Development Governance Standard v1.0 (POSTING MAP / AIOS)

本ドキュメントは、POSTING MAP および AIOS（AI Operating System）全体において開発を行うすべての AI エージェント（Flash 等）および開発者が例外なく厳守すべき最上位の統治標準（Governance Standard）である。

---

## 🛑 Core Rules (最優先原則)

### Rule 1: Do not create custom buttons/badges
- アプリケーション内に独自のスタイルを持つボタン、インプット、ステータスバッジを新設・ベタ書きしてはならない。
- 必ず共通のコンポーネントライブラリ（`/components/`）からインポートまたは呼び出して使用すること。

### Rule 2: Do not hardcode colors
- HTML / JavaScript / CSS 内に生のカラーコード（例：`#00B7FF`、`rgba(0,0,0,0.5)`）を直接記述してはならない。
- 必ず `design-tokens.json` で定義され、`style.css` 内にマッピングされた CSS 変数（例：`var(--color-primary)`）を参照すること。

### Rule 3: Do not duplicate cards or lists
- 情報コンテナ（カード、リストアイテム等）の HTML 文字列や Tailwind クラスを個別に複製・記述してはならない。
- 必ず `/components/card.js` などの共通のコンポーネント描画関数へデータを流し込んで再利用すること。

### Rule 4: Do not access API inside components
- コンポーネント内部で外部の API（GAS API コールやネットワーク接続など）を直接実行・呼び出してはならない。
- コンポーネントは純粋に `JSON ➔ HTML String / HTMLElement` の変換のみを担当する。

### Rule 5: Components must be stateless
- コンポーネントは内部状態（State）を保持してはならない。
- 冪等性を満たし、**「同じデータ入力に対して常に全く同じ HTML 出力」** を返すように設計する。

### Rule 6: Pages own state, Components own rendering
- 画面の状態管理やインタラクションのハンドリング（APIコールや `localStorage` の読み書き等）は、ページ層（`render.js`）が完全に所有する。
- コンポーネントはレンダリング（表示文字列の生成）のみに専念する。

---

## 🛡️ Architecture & Boundaries (責務の境界線)

1. **Tokens (`design-tokens.json` / `style.css`)**: 
   - 見た目の設計変数（色、サイズ、フォント）の Single Source of Truth (SSOT) とする。
2. **Components (`/components/`)**:
   - すべての再利用可能な UI レンダリングの Single Source of Truth (SSOT) とする。渡されたデータ（JSON）に基づいて自律的に HTML 文字列を組み立てて出力する責務を持つ。
3. **Pages (`render.js`)**:
   - 部品の「組み立て（Composition）」の責務のみを持つ。ページ全体のレイアウトやタブ切り替え、各コンポーネントへのデータ配分を行い、自ら部品の HTML を直接生成してはならない。

#### 伝播フロー（Propagation Flow）
```
Design Tokens (JSON / CSS) ➔ Components (JS Functions) ➔ Pages (Composition / render.js)
```

---

## 🔒 Sprint Scope Lock Rule (スコープ増加禁止原則)

* **No Scope Creep**: いかなるスプリントの進行中においても、未承認の新機能や追加要求によるスコープ拡張（Scope Creep）は一切禁止する。
* **DS-01 Lock**: DS-01においてはスコープを完全に凍結（Lock）し、以下の残り2つの認定項目のみを完遂対象とする：
  1. **Design Structure** (Foundationページ, Variables, Component Set, Auto Layout, Layer命名規則, Governance遵守)
  2. **Dev Mode Validation** (ButtonおよびCardの Dev Mode ➔ Code ➔ H-App 実機連動エビデンス)

---

## ⚖️ Governance Rules for AI Employees (AI社員統治7大原則)

本プロジェクトおよびAIOS（AI Operating System）におけるすべてのAIエージェント（Flash等）は、以下の7大原則を例外なく厳守しなければならない：

### Governance Rule 001: Evidence Integrity Principle (エビデンス無謬性原則)
> *"No implementation claim shall be accepted as evidence. Only independently verifiable artifacts may be used for review and approval."*
* AIエージェントによるテキスト文や自己主張は一切証拠と認めない。第三者が独立して検証可能な実物成果物（Figma URL, Dev Mode画面, Git Diff, E2Eログ）のみを承認根拠とする。

### Governance Rule 002: Two-Layer Evidence Principle (2層エビデンス原則)
* すべてのスプリントは、**Design Evidence (デザイン証拠)** ＋ **Development Evidence (開発証拠)** の両方の提出が必須。片方のみでの完了申請は不可。

### Governance Rule 003: CEO Review Principle (CEO直接検証原則)
* CEOは「AIの実装報告文」ではなく、「提出されたエビデンス」のみを審査する。 (`Flash ➔ Evidence Submitted ➔ CEO Review ➔ PASS`)

### Governance Rule 004: AI Self-Declaration Prohibition (AI完了自己宣言禁止原則)
> *"AI shall never declare that a sprint is complete. Only the CEO may declare Sprint Completion."*
* AIエージェント（Flash）は、自ら「スプリント完了（Complete）」を宣言してはならない。発言できるのは規定されたステータス表現のみとする。

### Governance Rule 005: Freeze Authority (フリーズ・リリース権限独占原則)
* スプリントの Freeze（フリーズ判定）、Git Tag の発行、および Release（リリース宣言）は、100% CEO（プロダクトオーナー）の独占権限とする。AIエージェントは **「Ready to Freeze (フリーズ準備完了)」** の報告に留める。

### Governance Rule 006: Evidence Traceability Principle (エビデンス追跡可能性原則)
> *"Submitted evidence must be fully traceable back to the actual implementation."*
* 提出されたすべての画像、ログ、ドキュメントは、どの Git Commit ID、どのソースファイルのどの行に対応するか完全に追跡（`Evidence ➔ Git Commit ➔ Source File ➔ Implementation`）できなければならない。

### Governance Rule 007: Scope Integrity Principle (スコープ完全性原則)
> *"Implement strictly what was approved at the start of the Sprint. Mid-sprint scope creep is strictly prohibited."*
* スプリント開始時に承認されたスコープ以外の新機能・デザイン変更・新APIの追加は禁止する。途中で思いついた追加要素はすべて次スプリント以降へ送る。

---

## 💬 Allowed & Forbidden AI Expressions (AI発言権限規約)

AIエージェントが使用可能な表現と、使用が厳禁とされる表現を以下の通り明確に分離する：

### 🟢 Allowed Expressions (AI使用許可表現)
* `Implementation Complete` (実装作業完了)
* `Evidence Package Submitted` (エビデンスパッケージ提出済み)
* `Ready for CEO Review` (CEOレビュー準備完了)
* `Ready to Freeze` (フリーズ準備完了)

### ❌ Forbidden Expressions (AI使用厳禁表現 - CEO権限)
* `Sprint Complete` (スプリント完了)
* `Approved` (承認済み)
* `Released` (リリース済み)
* `Frozen` (フリーズ完了)
* `Production Ready` (本番運用可能)

---

## 🔄 Standard Status Transitions (標準ステータス推移フロー)

```
Implementation Complete (Flash)
    │
    ▼
Evidence Package Submitted (Flash)
    │
    ▼
Ready for CEO Review (Flash)
    │
    ▼
CEO PASS (CEO Declaration)
    │
    ▼
Ready to Freeze (Flash)
    │
    ▼
Freeze & Git Tag (CEO Execution)
    │
    ▼
Sprint Complete (CEO Declaration)
```

---

## 📦 Two-Layer Evidence Package Structure (2層エビデンス構造)

すべてのスプリント完了申請は、以下の2層に分類されたエビデンスパッケージを提出しなければならない：

### 1. Design Evidence (デザインエビデンス)
* **Figma File**: 公式 Design SSOT URL
* **Dev Mode Inspector**: 構造化ノード、Inspect CSS
* **Components & Variables**: 定義されたコンポーネントセットおよびVariables
* **H-App Rendering**: 実機環境（Viewport）でのレンダリング画面

### 2. Development Evidence (開発・ガバナンスエビデンス)
* **Git Commit**: フルコミットハッシュ（例: `70204041`）
* **Git Diff**: 実際のコードおよび仕様書の差分出力 (`git show <hash> --stat`)
* **E2E Execution Log**: `node scripts/test_browser_h_app.mjs` の実行ログ
* **Task & Governance Diffs**: `task.md` および `DESIGN_GOVERNANCE.md` の更新差分
* **Release Tag**: バージョンタグ（例: `v5.1-ds01-complete`）

---

## 📋 CEO Review Checklist (CEO標準審査基準)

すべてのスプリント審査において、プロダクトオーナー（CEO）は以下の共通チェックリストを用いて判定を行う：

* **Design Evidence**: `[ ] PASS / [ ] FAIL`
* **Development Evidence**: `[ ] PASS / [ ] FAIL`
* **Critical Issues**: `[ ] NONE`
* **Decision**: `Proceed (承認・継続)` / `Revise (修正指示)` / `Reject (却下)`

---

## 🛑 DS-01 Freeze Gate (品質ゲート6条件)

DS-01スプリントのフリーズ（完結判定）は、以下の6条件をすべてクリアした場合にのみ許可される：

* [ ] **Design Structure** = 🟢 (Foundationページ, Variables, Component Set, Auto Layout, Layer命名規則, Governance遵守)
* [ ] **Dev Mode Validation** = 🟢 (ButtonおよびCardの2セットの実証連動エビデンス)
* [ ] **Two-Layer Evidence Package Submitted** (Design Evidence 4点 ＋ Development Evidence 5点)
* [ ] **CEO Review** = PASS (上記CEO Review Checklistを満たした検証承認)
* [ ] **Git Tag Created** = `v5.1-ds01-complete` (バージョンタグの発行)
* [ ] **No Open Critical Issues** = 未解決のクリティカルな不具合・懸念がゼロであること

---

## 🚦 DS-02 Transition Workflow (DS-02進行条件)

DS-01からDS-02（Variables Sync Foundation）へ進むための段階的ロードマップを以下の通り規定する：

```
DS-01: Foundation
        │
        ▼
DS-02: Variables REST API Sync
        │
        ▼
DS-03: Plugin Bridge
        │
        ▼
DS-04: AI Design Automation
```

本プロジェクトにおいて「Design SSOTが正式に確立された」と認定するためには、以下の4要件がすべて満たされていることを条件とする：

1. **Design File (URL固定)**: Figmaファイルが正式に存在し、閲覧用URLが固定されていること。
2. **Design Structure (構造化)**: Pages、Layers、Components、Variablesがキャンバス上で整理整頓されていること。
3. **Dev Mode (情報取得性)**: ButtonやCardなどの主要コンポーネントの設計情報がDev Modeで正確に取得できること。
4. **Implementation (実装連動性)**: Dev Modeの情報を基に、`design-tokens.json` ➔ `style.css` ➔ H-App 表示へ矛盾なく反映できること。

すべての設計レビュー（Figma上の各要素フェーズ）および将来の実装レビューにおいて、以下のチェックリストをすべてパスすることを必須の統治基準と定義する：

* **Rule 7: Brand Core Color Alignment**
  - ブランドコアカラー `#f4700f` が適切に使われているか。
* **Rule 8: Outdoor Readability Compliance**
  - 晴天下、直射日光の下でも十分に文字や情報が視認できるか。
* **Rule 9: 8px Grid Layout Conformity**
  - すべての余白・マージン・パディングが 8px Grid システム（4px, 8px, 12px, 16px, 24px 等）に従っているか。
* **Rule 10: Unified Iconography Rules**
  - アイコンセットが一つに統一され、サイズや線幅が規定通りか。
* **Rule 11: Accessible Touch Target Sizes**
  - ボタンやタップ可能領域が手袋をはめた手でも押しやすいサイズ（44px〜48px以上）か。
* **Rule 12: SSOT Component Reusability**
  - 個別のベタ書きレイアウトを排除し、定義された共通コンポーネントのみで組み立てられているか。
* **Rule 13: Non-Color Dependent States**
  - 赤や緑などの「色だけ」で成功・警告・エラーなどの状態を表現せず、アイコンやテキストを併用しているか。
* **Rule 14: Token Reference Lock**
  - 独自の色やフォントを一切ハードコードせず、定義した Design Token (変数) のみを参照しているか。
