# AI社員教育：支部作成 SOP v1 (Standard Operating Procedure)

## ■ Goal
POSTING MAP の新規支部を、Master Governance (Rule-001〜Rule-005) に従って自律的かつ正確に作成・初期化する。

---

## ■ Procedure (実行標準手順)

### STEP 1: 原本コピー
* POSTING MAP MASTER (`14rblnvJH5hkXHU9-9lhZlDaUi-FenuQQ5DWnTP7TbW4`) をコピーする。

### STEP 2: スプレッドシート名変更
* スプレッドシート名（ファイル名・画面左上）を **`{branchId} v{masterVersionMajor}`** へ変更する。
* *例: `MIE-03 v1` / `NARA-07 v2`*

### STEP 3: 内部シート（タブ）保護
* 内部シート（タブ）は一切変更しない。原本構造を100%完全保持する。

### STEP 4: 表示名設定
* 人名表記用・各種画面/帳票用表示名（`displayName`）を設定する。
* *例: `三重第3支部`*

### STEP 5: deployment.json 生成
* `deployment.json` マニフェストを生成し、`branchId`, `masterVersion`, `createdFrom`, `spreadsheetId`, `spreadsheetTitle`, `displayName` を不変記録する。

### STEP 6: Google Drive 実体保存
* Google Drive (`1FfcVEQjod--rZSucOPFJD2DJ58hV650_`) 内の `03_BRANCH/{branchId}/` フォルダへ作成されたスプレッドシートおよび `deployment.json` を同期保存する。

### STEP 7: 地区データ投入待ち状態移行
* ステータスを `BRANCH_CREATED_READY_FOR_DATA`（地区データ投入待ち）に遷移させて完了する。

---

## ■ Governance (ガバナンス遵守規定)

本 SOP の実行において、以下 5 大原則を絶対遵守すること：

1. **Rule-001 (昇格)**: 新規支部は必ず最新の MASTER から作成する。
2. **Rule-002 (条件)**: 検証・運用・CEO承認済みの原本のみを使用する。
3. **Rule-003 (追跡)**: 支部マニフェストに生成元の世代 (`masterVersion`) と系譜 (`createdFrom`) を記録する。
4. **Rule-004 (不変タイトル)**: ファイル名を `{branchId} v{masterVersionMajor}` とし、内部シート名は原本保持する。
5. **Rule-005 (不変ファイル)**: 既存支部ファイルは永久上書き不可。新世代採用時は別環境として新支部作成する。
