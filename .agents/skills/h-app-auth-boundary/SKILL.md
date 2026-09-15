---
name: h-app-auth-boundary
description: POSTING MAP Hアプリの認証境界を維持するための共通セキュリティプロトコル。起動用パブリックAPIと認証必須APIを明確に分離し、他地区展開時の認証境界逸脱を防止する。
---

# Skill: Hアプリ認証境界プロトコル v1

## 目的

POSTING MAP Hアプリにおける「起動時の可用性」と「重要データ・書き込みAPIの認証保護」を両立するため、GASバックエンドの認証境界を地区横断で統一する。

このSkillは、OKAYAMA-02で実証された認証境界を基準実装として、MIE-03等の他地区へ展開する際にも同じ境界を維持するために使用する。

## 絶対ルール

### 1. 無認証で許可するAPIは2つだけ

HアプリのOptimistic Loadにより、LINE/LIFF認証完了前に以下の2 APIが呼ばれるため、無認証アクセスを許可する。

- `getSystemSummary`
- `getMapsApiKey`

この2つ以外を「起動のため」という理由で無認証許可してはならない。

### 2. その他のRead APIはすべて認証必須

特に以下を含む全Read APIは `authenticateRequest` を通過させる。

- `getRoster`
- `getFlyerStock`
- `getRanking`
- `getGlobalPinStatus`
- `getLatestDistribution`
- `getTier1`
- `getSystemInfo`
- `getDashboardData`
- `getDeliveryStats`
- `getAreaDetails`

### 3. Write APIはすべて認証必須

以下を含む全Write APIは `authenticateRequest` を必須とする。

- `updateRecordWithGPSPhoto`
- `registerStaff`
- `submitDistribution`
- `setPinInProgress`
- `updateFlyerStock`
- `requestFlyerTransfer`
- `resolveTransferRequest`
- `resetRoster`
- `resetDeviceManagement`

### 4. Provisioning APIは別の保護境界を維持する

Provisioning系APIについては `verifyProvisioningToken` による保護を維持し、Hアプリの公開Bootstrap APIとは混同しない。

### 5. Manager認証とHアプリ認証を混同しない

PC ManagerがLIFF tokenを持たないことを理由として、HアプリAPI全体の認証を緩和してはならない。

Managerの閲覧認証は、管理者専用認証機構として独立したIssueで設計・実装する。

### 6. 認証境界の変更でHアプリのOptimistic Loadを壊さない

HアプリはLINE認証完了を待たずに画面骨格・起動基盤情報を先行取得する設計である。

そのため、`getSystemSummary` と `getMapsApiKey` を認証必須へ変更する「全面認証化」は禁止する。

## 実装原則

`v2_api.js` 等のAPIディスパッチャでは、公開Bootstrap APIを明示的なホワイトリストとして扱う。

概念例:

```javascript
const isPublicBootstrapAction = [
  'getSystemSummary',
  'getMapsApiKey'
].includes(action);
```

- `isPublicBootstrapAction === true`: tokenなしでも処理を許可
- それ以外: `authenticateRequest` を必須化
- 「Read APIだから公開」「Dashboardだから公開」という包括的バイパスは禁止

## 必須検証ゲート

デプロイ前に最低限、次の2方向を機械的に確認する。

### 可用性ゲート

無認証で:

- `getSystemSummary` → `success: true`
- `getMapsApiKey` → `success: true`

### 機密性・完全性ゲート

無認証で:

- `getRoster` → `success: false` / `Unauthorized: Missing liffToken`
- `updateRecordWithGPSPhoto` → `success: false` / `Unauthorized: Missing liffToken`

HTTP statusだけで判定せず、GASが返すJSONの `success` と `message` を確認する。

## HアプリRuntime確認

認証境界変更後は、Hアプリ実機相当環境で最低限以下を確認する。

- 全体件数が `0/0` のまま凍結していない
- 実データの総数・完了数が表示される
- Google Maps JavaScript SDKがロードされる
- マップコンテナが生成される
- マップが正常描画される

OKAYAMA-02 Version @21では `13/508`、`3%`、Maps SDK loaded、Map container生成を確認し、障害復旧を実証した。

## 他地区展開時の扱い

他地区へ展開する場合、このSkillの認証境界を基準として実装・監査する。

地区固有のAPI追加や変更がある場合は、次の分類を必ず行う。

1. Public Bootstrapに該当するか
2. Read + 認証必須か
3. Write + 認証必須か
4. Provisioning + 専用tokenか
5. Manager専用機能か

分類が不明なAPIを無認証ホワイトリストへ追加してはならない。

## 禁止事項

- Read API全体を無認証化する
- Dashboard APIを包括的に無認証化する
- Manager対応のためHアプリAPI認証を緩和する
- `getRoster` 等の重要データAPIをBootstrap扱いする
- HTTP 200だけを根拠に認証テストをPASSとする
- 実機Runtime確認なしに「マップ復旧」を宣言する

## 基準実証

基準地区: OKAYAMA-02

実証版本番: GAS Version @21

実証コミット: `4e2493e`

実証結果:

- `getSystemSummary` 無認証 → PASS
- `getMapsApiKey` 無認証 → PASS
- `getRoster` 無認証 → Unauthorized
- `updateRecordWithGPSPhoto` 無認証 → Unauthorized
- Hアプリ Map / Header → 復旧

この実証結果を、同一アーキテクチャを採用する地区展開時の認証境界確認基準とする。
