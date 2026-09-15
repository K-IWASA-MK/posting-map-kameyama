# ADR-002: District Master 属性化とソートキー除外・10件分割復元

- **Status**: Accepted & Frozen
- **Date**: 2026-07-22
- **Deciders**: 岩佐CEO, AI OS Total Director (AI総監督), Backend Lead Agent
- **Technical Area**: Batch Processing Engine (`active/gas/v2_batch.js`), District Master (`active/gas/v2_extract.js`)

---

## 1. 背景と課題 (Context & Problem Statement)

POSTING MAP Generation 2 の開発において、四日市市等の詳細な地区情報（富洲原地区、羽津地区等）を住所データへ付与するため `YOKKAICHI_DISTRICT_MASTER` （District Master）が導入された。

しかし初期実装において、`v2_batch.js` 内の住所ソート処理に `district.localeCompare()` による地区名ソートが追加された結果、以下の深刻な副作用が発生した：

1. **シートの断片化 (Sheet Fragmentation)**:
   地区名の切り替わり時にシートが途中で分割され、`四日市市(23)`（7件格納）、`四日市市(24)`（9件格納）など、10件未満の不均一なシートが大量に発生した。
2. **仕様違反**:
   POSTING MAP の基底仕様である「1シート10件分割」および「シート名は自治体名のみ (`四日市市`, `四日市市(2)`...)」の統一性が崩壊した。

---

## 2. 検討された選択肢 (Options Considered)

1. **Option A: 地区ごとに独立したシートを作成する (`四日市市-富洲原地区(1)` 等)**
   - *メリット*: 地区ごとに完璧に整理されたシートが生成される。
   - *デメリット*: 配布員アプリのUI設計（自治体・連番アクセス）と完全衝突し、シート数が肥大化。また既存の現場運用フローを破壊する。
2. **Option B: District Master をソートキーから完全除外する（採用）**
   - *メリット*: 地区情報は住所の「属性」として維持しつつ、ソートおよびシート生成を従来の「自治体優先度 ➔ 郵便番号昇順」に復元。1シート10件フラット分割が100%再確立される。
   - *デメリット*: 同一シート内に複数の地区が含まれる場合があるが、地図描画やフィルタリングで属性として地区名を参照できるため運用上の支障はない。

---

## 3. 意思決定 (Decision)

**Option B** を採用し、以下の設計を固定仕様として確定（Freeze）する。

1. **ソートキーからの地区排除**:
   `v2_batch.js` の `addresses.sort` から地区名によるソート (`localeCompare`) を完全に削除し、`cityOrderPriority`（自治体順）および `postalCode`（郵便番号数値昇順）のみをソート条件とする。
2. **District Master の責務境界設定**:
   District Master は `extractDistrictAddresses` において住所に `district` 属性（例: `"富洲原地区"`）を付与するためだけのデータソースとして利用し、バッチエンジンの順序やシート境界決定には一切関与させない。
3. **シート作成キーの統一**:
   一時シート `__TEMP_ADDRESSES__` の `areaKey`（6列目）には自治体名 (`city`) を設定し、`generateAreaSheetsBatch` において自治体ごとに正確に10件ずつフラットに分割・生成する。

---

## 4. 変更結果と影響 (Consequences)

### 正的影響 (Positive Impact)
- **10件フラット分割の回復**: 四日市市を含む全エリアにおいて、最終シートを除くすべてのエリアシートが正確に10件ずつ格納される。
- **シート名・構造の正常化**: `四日市市`, `四日市市(2)`, `四日市市(3)`... と整然とした連番シート構造が復元された。
- **データ完全性維持**: District Masterによる地区情報の付与は継続されるため、フロントエンドにおける地区別表示・マップピンの色分け等は一切損なわれない。

### 負的影響 (Negative Impact)
- 特になし。

---

## 5. 検証手順 (Verification Evidence)

1. **ソート並び順検証**:
   `MIE_POSTAL.CSV` ➔ `__TEMP_ADDRESSES__` ➔ `Area Sheet` において、郵便番号昇順が全件で一致することを確認。
2. **件数分割検証**:
   全エリアシートの行数がヘッダー除き10行であることを自動検証。
3. **リバース回帰テスト**:
   `tests/integration/g2_rebuild_sorting_regression_test.js` を実行し、地区切り替わり地点でのシート強制閉じが発生しないことを確認。
