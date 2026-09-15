# Troubleshooting: Deployment Issues

新しい選挙区への展開（Deployment）プロセス中、および `deploy-verify.js` 実行時に発生するエラーと解決手順のトラブルシューティング集。

---

## 1. OAuth & Google ゲートウェイ障害

### 現象: "現在、ファイルを開くことができません。" (Drive Page Error / HTTP 405)
`deploy-verify` の Web App 疎通テストで Google ドライブのエラー画面（HTML）が返却される。

* **原因**:
  Web App のデプロイ実行ユーザーアカウント（`postingareamap@gmail.com`）による GAS プロジェクトへの「手動 OAuth 承認」がまだ一度も行われていないため。Google のセキュリティ仕様により Anonymous POST が入り口でブロックされます。
* **対策**:
  Apps Script エディタを開き、任意の関数（例: `verifyDistrictDeployment`）を一度手動実行して「承認が必要です (Authorization Required)」ポップアップを完了させてください。

---

## 2. 権限 (Access Denied) 障害

### 現象: GAS Rule Engine から FAILED または例外メッセージが返る
`GAS: Spreadsheet Access` が `FAILED` になり、`Exception: Access Denied` や `ファイルをオープンできません` と出力される。

* **原因**:
  スプレッドシート、あるいは画像保存先 Google ドライブフォルダに対する API 実行ユーザーの共有設定が「閲覧者」になっている、または共有されていない。
* **対策**:
  対象スプレッドシートおよびフォルダの「共有」設定を開き、**`postingareamap@gmail.com` に「編集者 (Editor)」権限が付与されていること** を確認してください。

---

## 3. Web App URL / デプロイ不整合

### 現象: HTTP 404 (Not Found) または 別の地区のデータが更新される
`deploy-verify` の実行時に 404 が返る、もしくは `MIE-03` を検証しているはずが `MIE-02` などの古いスプシが更新される。

* **原因**:
  1. `.clasp.json` の Script ID が間違っている。
  2. `deployment.json` 内の `webAppUrl` が、エディタで新しく再デプロイした最新の Web App URL と異なっている（デプロイIDの打ち間違い）。
* **対策**:
  1. エディタ上で「デプロイの管理」を開き、Web App URL を再コピーして `deployment.json` に上書き保存してください。
  2. `.clasp.json` の `scriptId` が新しいプロジェクト ID と一致しているか再確認してください。

---

## 4. スクリプトプロパティ未設定

### 現象: `STORAGE_PARENT_ID is not configured` (WARNING / FAILED)
`deploy-verify` で `GAS: Google Drive Folder` が `WARNING` もしくは `FAILED` になる。

* **原因**:
  GAS プロジェクト設定画面の「スクリプトプロパティ」に値が登録されていない、またはスペルミスがある。
* **対策**:
  エディタの「プロジェクトの設定」->「スクリプトプロパティ」で、以下のプロパティが登録されているか確認してください。
  * `SPREADSHEET_ID` = `(対象スプレッドシートのID)`
  * `STORAGE_PARENT_ID` = `(対象の画像保存先フォルダID)`
