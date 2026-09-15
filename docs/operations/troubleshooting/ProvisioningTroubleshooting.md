# Troubleshooting: Provisioning Failures

新規地区の自動プロビジョニング実行時に発生する代表的なエラーコードとその解消手順。

---

## 1. 認証・トークン関連エラー

### 現象: "clasp is not logged in. Please run 'clasp login' first."
* **原因**:
  ローカルのホームディレクトリ配下に clasp の認証情報（`~/.clasprc.json`）が存在しないため、Drive API コール用のトークンが解決できません。
* **対策**:
  ターミナルで `clasp login` を実行し、ブラウザでログインを完了させてください。

### 現象: Google API から HTTP 401 Unauthorized または 403 Forbidden が返る
* **原因**:
  1. `clasp` の認証トークンの期限切れ。
  2. テンプレート元（MIE-03）のファイルに対するアクセス権限がアカウントにありません。
* **対策**:
  1. ターミナルで `clasp logout` 後、再度 `clasp login` を実行してトークンをリフレッシュします。
  2. テンプレート元のファイルがアカウント `postingareamap@gmail.com` に共有されているか確認します。

---

## 2. clasp push & deploy 関連エラー

### 現象: "User has not enabled the Apps Script API"
* **原因**:
  Google アカウントの設定で Apps Script API が「オン」になっていません。
* **対策**:
  https://script.google.com/home/usersettings にアクセスし、Google Apps Script API を **オン (Enabled)** に変更してください。

---

## 3. 自動ロールバックが失敗した場合の手動回復

### 現象: 構築中に CLI が異常終了したが、Drive 上にコピーされたファイルが残ってしまった
* **原因**:
  プロセス強制終了（Ctrl+C など）により、ロールバック処理が途中で遮断されたため。
* **対策**:
  以下のクリーンアップコマンドを実行することで、マニフェストに残された未完了リソースを自動で一括削除できます。
  ```bash
  node development/cleanup-district.js
  ```
