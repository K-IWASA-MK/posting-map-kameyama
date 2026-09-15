# Real Device ID Card DOM Tree Specification (SSOT Extraction)

本ドキュメントは、実機スクショ（POSTING MAP 公式配布員 デジタルIDカード画面）に基づく確実な DOM 構造およびレイアウト階層仕様である。

---

## 1. DOM 階層ツリー構造 (Real Device SSOT)

```text
html (lang="ja")
└── body (.bg-[#000000], .text-white, .font-sans, .overflow-hidden, .p-4, .flex, .justify-center, .items-center)
    └── app (#app, .w-full, .max-w-[390px], .h-[844px], .bg-[#000000], .flex, .flex-col, .justify-between)
        ├── header (#header-hud, .bg-[#1C1C1E], .border-white/10, .rounded-full, .px-5, .py-3, .flex, .justify-between)
        │   ├── div (Progress, .flex, .items-center, .gap-2) ["全体進捗", "0/ 858"]
        │   └── div (Sync Status, .flex, .items-center, .gap-2) ["ONLINE", "●", "0%"]
        │
        ├── div (#id-title-section, .flex, .items-center, .justify-center, .gap-4)
        │   ├── h2 (.text-sm, .font-black, .text-white) ["公式配布員"]
        │   └── div (.px-4, .py-1.5, .rounded-full, .bg-[#2563eb]/10, .shadow-glow) ["STAFF ID 001"]
        │
        ├── main (#id-card-main, .gyro-card, .bg-[#1C1C1E], .rounded-[2.5rem], .p-6, .flex, .flex-col, .items-center, .justify-between)
        │   ├── div (Authorized Badge, .flex, .items-center, .gap-2) ["● AUTHORIZED STAFF"]
        │   ├── div (Avatar Image Container, .w-32, .h-32, .rounded-full, .overflow-hidden) [Img: Sea/Fish Avatar]
        │   ├── div (Name & Organization, .space-y-2)
        │   │   ├── h1 (.text-3xl, .font-black) ["K. IWASA"]
        │   │   └── div (.text-[11px], .font-mono) ["MIE-03 支部", "FIELD OPERATIONS"]
        │   └── div (Footer Links, .flex, .justify-center, .gap-6) ["TERMS", "PRIVACY", "LICENSE"]
        │
        └── nav (#bottom-nav, .bg-[#1C1C1E], .rounded-full, .p-3, .flex, .justify-around)
            ├── div (Area Tab) ["🗺️ エリア"]
            ├── div (Ranking Tab) ["🏆 ランキング"]
            ├── div (ID Tab - Active) ["👤 ID"]
            └── div (Next Tab) ["⚙️ 次へ"]
```

---

## 2. 主要エレメントとレイアウトプロパティ対応表

| ノードID / クラス | 役割 | レイアウトプロパティ |
| :--- | :--- | :--- |
| `#header-hud` | トップヘッダーHUD | `background: #1C1C1E; border-radius: 9999px; padding: 12px 20px; justify-content: space-between;` |
| `#id-title-section` | タイトル＆ID番号枠 | `flex; align-items: center; justify-content: center; gap: 16px;` |
| `STAFF ID 001` | 青発光ホログラムバッジ | `background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.3); color: #2563eb; font-mono;` |
| `#id-card-main` | 公式IDカード本体 | `background: #1C1C1E; border-radius: 2.5rem (40px); padding: 24px; flex-direction: column; align-items: center;` |
| `Avatar Container` | 円形プロフィール画像 | `width: 128px; height: 128px; border-radius: 9999px (full circle); overflow: hidden;` |
| `K. IWASA` | 配布員氏名 | `font-size: 1.875rem (30px); font-weight: 900; letter-spacing: -0.05em;` |
| `#bottom-nav` | ボトムフローティングナビ | `background: #1C1C1E; border-radius: 9999px; padding: 12px; justify-content: space-around;` |
