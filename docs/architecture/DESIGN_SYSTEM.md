# POSTING MAP Design System v2.0

* **Figma Design SSOT URL**: [https://www.figma.com/design/cmjPPVlC7d373Vv5YYf0Xo/%E7%84%A1%E9%A1%8C?node-id=0-1&t=4nxLb6FmkkA7sjd4-1](https://www.figma.com/design/cmjPPVlC7d373Vv5YYf0Xo/%E7%84%A1%E9%A1%8C?node-id=0-1&t=4nxLb6FmkkA7sjd4-1)

本ドキュメントは、Figma 上で手作業で定義される共通コンポーネント・デザイントークンを、実装（HTML / CSS / JavaScript）へ正確にマッピングするための設計ガイドラインです。

---

## 🛡️ Design System Architecture

```
Design Tokens (JSON / CSS) ➔ Components (JS Functions) ➔ Pages (Composition / render.js)
```

1. **Design Tokens (`design-tokens.json` / `style.css`)**:
   - 設計変数の SSOT。色・余白・フォントスケール等を一元管理。
2. **Components (`/components/`)**:
   - 再利用可能な UI レンダリングの **Single Source of Truth (SSOT)**。
   - 状態を持たず（Stateless）、API コールを行わず（No API Access）、HTML 文字列（HTML string）を返却する。
3. **Pages (`render.js`)**:
   - 画面合成（Composition）および状態管理（State Management）の所有者。

---

## 🎭 Brand Voice & Outdoor Usability (ブランド方針)

### 1. Brand Voice (ブランドのトーン＆マナー)
* **Professional** (正確で信頼のおける振る舞い)
* **Reliable** (データ欠損のない堅牢さ)
* **Friendly** (現場スタッフに寄り添う親しみやすさ)
* **Fast** (瞬時に判断・操作できる速度)
* **Outdoor First** (屋外使用を最優先とした画面構成)

### 2. Outdoor Readability Check (屋外視認性必須要件)
各コンポーネントおよび画面レイアウトは、以下の基準をすべてクリアしなければならない：
* **晴天下での可読性**: 直射日光や屋外の環境でもコントラストが十分に確保され、読めるか。
* **操作の容易さ**: 手袋や濡れた手でもタップしやすい十分なサイズ（最小44px〜48px以上）が確保されているか。
* **色依存の排除**: 赤や緑などの「色だけ」で成功・エラーを表現せず、テキストやアイコンを併用して状態を判別できるか。
* **文字サイズの確保**: 小さすぎるフォント（10px未満）を避け、屋外歩行中でも見えやすい文字サイズになっているか。

---

## 🔒 Freeze Scope (凍結範囲)

本デザインシステムにおける各要素の凍結・非凍結範囲は以下のように定義されます。

| Scope | Category | 対象要素 | 管理方針 |
|---|---|---|---|
| ❄️ **Frozen** | Color Tokens | アクセントカラー、成功/警告/エラー色、背景色、文字色 | 変更不可（JSON SSOT） |
| ❄️ **Frozen** | Typography | 見出し・本文・数値などのフォントサイズ・太さ（ウエイト） | 変更不可（JSON SSOT） |
| ❄️ **Frozen** | Spacing | 8px グリッドシステム（4px, 8px, 16px, 24px 等の固定スケール） | 変更不可（JSON SSOT） |
| ❄️ **Frozen** | Radius & Shadows | カード・ボタンの角丸半径、半透明シャドウ（ぼかし量） | 変更不可（JSON SSOT） |
| ❄️ **Frozen** | Component API | コンポーネント関数の入力（Input）/ 出力（Output = HTML string） | 変更不可（シグネチャ固定） |
| 🟢 **Not Frozen** | Screen Layout | 各画面（HOME, AREA, ID, Dashboard (Mobile)）における部品の配置・順序 | アプリケーション側で変更可能 |
| 🟢 **Not Frozen** | Animations | ホバーエフェクトやローディングアニメーションの挙動・速度 | UX 改善のためにチューニング可能 |
| 🟢 **Not Frozen** | Screen Composition| 新しい画面・セクションの追加・レイアウト構成 | 既存コンポーネントの組み合わせで自由 |

---

## 01. Design Tokens (Figma ➔ CSS Variables)

Figma 上のスタイルは、すべて以下の CSS 変数（カスタムプロパティ）にマッピングされ、`style.css` 内で一元管理されます。H-App および Dashboard (Mobile) のコード内での生コード（色のハードコードや ad-hoc な Tailwind クラス）の記述は禁止します。

### 🎨 Colors
| Figma Style | CSS Variable | Value (Default) | 用途 |
|---|---|---|---|
| Primary Orange | `--color-primary` | `#f4700f` | 主要アクション、アクセントカラー |
| Success Green | `--color-success` | `#22C55E` | 正常、ONLINE、同期良好インジケータ |
| Warning Orange | `--color-warning` | `#F59E0B` | 警告、SYNCING |
| Danger Red | `--color-danger` | `#EF4444` | エラー、削除、危険操作 |
| Text Main | `--color-text-main` | `#FFFFFF` | 主要テキスト |
| Text Muted | `--color-text-muted`| `rgba(255,255,255,0.4)` | 補助テキスト、ラベル |
| Card Backdrop | `--color-bg-card` | `rgba(28,28,30,0.65)` | グラスモーフィズムカード背景 |

### 📐 Spacing (8px Grid System)
| Figma Auto-Layout | CSS Variable | Value | 用途 |
|---|---|---|---|
| Space Extra Small | `--space-4` | `4px` | 微細な位置調整 |
| Space Small | `--space-8` | `8px` | 子要素間の基本余白 |
| Space Medium | `--space-16` | `16px` | コンテナ内部の基本パディング |
| Space Large | `--space-24` | `24px` | カード間の余白、ヘッダー間隔 |
| Space Extra Large | `--space-32` | `32px` | 大規模セクションの区切り |

### 🔘 Radii & Shadows
| Figma Corner Radius | CSS Variable | Value | 用途 |
|---|---|---|---|
| Card Rounded | `--radius-card` | `24px` | 各種グラスモーフィズムカードの角丸 |
| Button Rounded | `--radius-btn` | `16px` | ボタン、フォーム入力部品の角丸 |
| Avatar Circle | `--radius-avatar` | `50%` | プロフィールアイコンの円形化 |
| Border Thin | `--border-width-thin`| `1px` | グラスモフィズム用のアウトライン幅 |

---

## 02. Component API Freeze Spec (Input ➔ Output)

### 05. Card Component (`/components/card.js`)
* **Signature**: `renderCard(contentHtml, options)`
* **Input**: `contentHtml` (string), `options` (object: `{ className?: string }`)
* **Output**: `HTML string` (representing glassmorphism card element)

### 06. Button Component (CSS Classes)
* **Usage**: `<button class="btn-primary">Text</button>` (Primary), `<button class="btn-secondary">Text</button>` (Secondary)
* **Output**: Styled buttons using standardized rounded corner and spacing tokens.

### 07. Badge Component (`/components/badge.js`)
* **Signature**: `renderStatusBadge(status)`
* **Input**: `status` (string: `'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ERROR'`)
* **Output**: `HTML string` (representing styled status badge)

### 08. Progress Component (`/components/progress.js`)
* **Signature**: `renderProgressBar(done, total)`
* **Input**: `done` (number), `total` (number)
* **Output**: `HTML string` (representing horizontal progress bar container)

### 09. Bottom Navigation Component (`/components/navigation.js`)
* **Signature**: `renderBottomNavigation(activePage)`
* **Input**: `activePage` (string: `'areas' | 'ranking' | 'settings' | 'storage-register' | 'storage-list'`)
* **Output**: `HTML string` (representing responsive bottom navigation bar)

### 10. List Item Components (`/components/area.js`, `/components/ranking.js`, `/components/staff.js`)
* **Signatures**:
  - `renderStaffCard(userInfo)` ➔ Returns `HTML string` for staff ID card.
  - `renderAreaCard(areaData)` ➔ Returns `HTML string` for area stats card.
  - `renderRankingCard(rankingData)` ➔ Returns `HTML string` for ranking row.
