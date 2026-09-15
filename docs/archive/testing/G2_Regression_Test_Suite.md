# POSTING MAP Generation 2 — Regression Test Suite Documentation

Version: 2.0.0 (Production Freeze Baseline)  
System: POSTING MAP / FIELD OPERATIONS OS  

---

## 1. 概要 (Overview)

本ドキュメントは、POSTING MAP Generation 2 のリビルドエンジンにおける回帰テスト（Regression Test Suite）の仕様および実行手順を定義する。

特に、過去に発生した「District Master導入に伴う地区ソート混入によるシート断片化（中途半端な件数でのシート切り替わり）」の再発を100%防止することを目的とする。

---

## 2. テスト対象と自動検証項目 (Test Scope & Assertions)

### テストファイル
- **パス**: `tests/integration/g2_rebuild_sorting_regression_test.js`
- **環境**: Node.js v18+ (外部依存ライブラリなし / Standard Library `assert` のみ)

### 検証項目一覧

| テスト項目 | 検証ロジック | 期待結果 (Expected Result) |
| :--- | :--- | :--- |
| **1. 住所ソート並び順** | 自治体優先度 ➔ 郵便番号数値昇順 のソート結果を検証。 | 郵便番号が昇順に正しく並び、地区名（例: 富洲原地区 ➔ 羽津地区）の辞書順によって並び順が破壊されないこと。 |
| **2. 10件フラットチャンク** | 複数地区（羽津・富洲原・日永・常磐）に跨る12件のサンプル住所データを用意し、チャンク処理をシミュレーション。 | 地区境界でのシート閉じが発生せず、1シート目 (`四日市市`) が正確に10件、2シート目 (`四日市市(2)`) が2件で分割されること。 |
| **3. シート命名規則** | 連番シート名のフォーマットを検証。 | `<自治体名>` (1枚目), `<自治体名>(2)` (2枚目) の形式が厳密に維持されること。 |

---

## 3. 実行手順 (Execution Guide)

Terminalより以下のコマンドを実行する：

```bash
node tests/integration/g2_rebuild_sorting_regression_test.js
```

### 正常実行時の出力例

```text
==================================================
POSTING MAP Generation 2 - Regression Test Runner
==================================================
▶ Running Test 1: Address Sorting Logic (Zip Code Ascending)
  ✅ Address Sorting Logic test passed.
▶ Running Test 2: Flat 10-Item Chunking & Sheet Naming Logic
  ✅ Flat 10-Item Chunking & Sheet Naming test passed.
==================================================
🎉 ALL REGRESSION TESTS PASSED (100% SUCCESS)
==================================================
```

---

## 4. 開発プロセスへの組み込み (CI/CD Protection)

- **コミット前自動チェック**:
  `v2_batch.js` または `v2_extract.js` に変更が加えられる場合、必ず本テストを実行し、PASSすることを確認する。
- **凍結保証**:
  本テストが失敗する場合、Generation 2 の基本仕様（Baseline Specification）への違反が発生しているため、プロファイルデプロイはブロックされる。
