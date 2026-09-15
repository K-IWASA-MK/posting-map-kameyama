# Phase 3: Deployment Audit

## 監査日時
2026-07-24 15:10 JST

## 監査手法
GitHub CLI (`gh api` および `gh run list`) を使用し、リポジトリのコミット履歴とGitHub Pagesのビルド履歴をトレース。

## 監査結果（事実ベース）

### 1. 最新Git Commit (`origin-dev/main`)
* **Hash**: `ab300e1ebbcf4abacf697834e6320f484a34a484`
* **Message**: `feat(liff): add PC web fallback in initLiff to enable seamless PC browser preview`
* **変更ファイル**:
  * `projects/posting-map/active/dashboard/index.html`
  * `projects/posting-map/index.html`

### 2. GitHub Pages Build & Deploy
* **最新ビルドID**: `1110610424`
* **対象Commit Hash**: `ab300e1ebbcf4abacf697834e6320f484a34a484` (リポジトリ最新と一致)
* **Deploy Status**: `completed (success)`
* **完了時刻**: `2026-07-23T10:58:30Z`
* **Deploy Target**: `/` (Rootディレクトリ)
* **デプロイ経路**: `pages-build-deployment` (Legacy push trigger)

## 結論
GitHub Pagesのデプロイメントパイプライン自体は完全に正常に稼働しています。
`ab300e1` を含む最近のコミットに対して正常にビルドと公開処理が行われ、エラーは発生していません。しかし、前述のコミットがルートディレクトリのファイルではなく `projects/posting-map/` 配下のファイルのみを更新したため、デプロイ結果として公開されているルート側のソースに変更が反映されませんでした。
