# Business Remaining Responsibility Inventory Report

## 1. Audit Scope & READ ONLY Declaration

### Audit Policy
- **Target File**: `active/api/v2_api.js` (`SEC-001`〜`SEC-066`)
- **Execution Mode**: READ ONLY Fact Inspection (ソースコード変更 0 件)
- **Primary Source**: `active/` 配下の最新コードベースおよび P2-11A 実装結果 (`active/business/staff/`)

---

## 2. Completed Migration Record

### P2-11A Staff Domain Status

| 機能 / クラス | 移行前位置 (`v2_api.js`) | 移行先モジュール | 移行ステータス |
| :--- | :--- | :--- | :--- |
| **`registerStaff()`** | L972〜L1144 | [staff_service.js](file:///Volumes/SSD_DATA/AI%20Development%20OS/projects/posting-map/active/business/staff/staff_service.js) | 🟢 **Completed** (`LEGACY_STAFF_BACKUP`) |
| **`StaffIdentityResolver`** | L2623〜L2658 | [staff_service.js](file:///Volumes/SSD_DATA/AI%20Development%20OS/projects/posting-map/active/business/staff/staff_service.js) | 🟢 **Completed** (`LEGACY_STAFF_BACKUP`) |
| **`Staff` Model** | - | [staff_model.js](file:///Volumes/SSD_DATA/AI%20Development%20OS/projects/posting-map/active/business/staff/staff_model.js) | 🟢 **Completed** |
| **`StaffRepository`** | - | [staff_repository.js](file:///Volumes/SSD_DATA/AI%20Development%20OS/projects/posting-map/active/business/staff/staff_repository.js) | 🟢 **Completed** |

---

## 3. Remaining Business Responsibility Matrix

`active/api/v2_api.js` に残存する主要 Business 責務の一覧：

| Function / Class | SEC | Target Domain | API Entry | Data Owner | Read/Write | Infrastructure Dependency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`submitDistribution`** | SEC-012 | Distribution | POST `/submitDistribution` | エリアシート, EventLog | Write | `getSS()`, `LockService`, `appendEventLog()` | 🟡 Pending |
| **`getDeliveryStats`** | SEC-013 | Distribution | GET `/getDeliveryStats` | エリアシート | Read | `getSS()` | 🟡 Pending |
| **`getRankingData`** | SEC-014 | Distribution | GET `/getRankingData` | EventLog | Read | `getSS()`, Cache | 🟡 Pending |
| **`getAppData`** | SEC-010 | Area | GET `/getAppData` | エリアシート, EventLog | Read | `getSS()`, `CacheService` | 🟡 Pending |
| **`getAreaDetails`** | SEC-011 | Area | GET `/getAreaDetails` | エリアシート | Read | `getSS()` | 🟡 Pending |
| **`getCityAreaDetails`**| SEC-011 | Area | GET `/getCityAreaDetails` | エリアシート | Read | `getSS()` | 🟡 Pending |
| **`getFlyerStock`** | SEC-015 | Flyer | GET `/getFlyerStock` | チラシ保管庫 | Read | `getSS()` | 🟡 Pending |
| **`updateFlyerStock`** | SEC-016 | Flyer | POST `/updateFlyerStock` | チラシ保管庫 | Write | `getSS()`, `LockService` | 🟡 Pending |
| **`handleRequestFlyerTransfer`** | SEC-017 | Flyer | POST `/requestFlyerTransfer` | チラシ移動リクエスト | Write | `getSS()`, `UrlFetchApp` | 🟡 Pending |
| **`getTransferRequests`**| SEC-018 | Flyer | GET `/getTransferRequests` | チラシ移動リクエスト | Read | `getSS()` | 🟡 Pending |
| **`resolveTransferRequest`** | SEC-019 | Flyer | POST `/resolveTransferRequest` | チラシ移動リクエスト, 保管庫 | Write | `getSS()`, `LockService` | 🟡 Pending |
| **`updateRecordWithGPSPhoto`** | SEC-020 | GPS / Evidence | POST `/updateRecordWithGPSPhoto` | エリアシート, Google Drive | Write | `getSS()`, `DriveApp`, `LockService` | 🟡 Pending |
| **`getRoster`** | SEC-021 | Staff (Admin) | GET `/getRoster` | 名簿シート | Read | `getSS()` | 🟡 Pending |
| **`registerAdmin`** | SEC-022 | Staff (Admin) | POST `/registerAdmin` | 管理者名簿シート | Write | `getSS()`, `LockService` | 🟡 Pending |

---

## 4. Domain Reality Matrix

| Candidate Domain | Fact Validation Result | Description & Rationale |
| :--- | :--- | :--- |
| **Staff Domain** | 🟢 **CONFIRMED / Partially Migrated** | P2-11A にて `registerStaff`, `StaffIdentityResolver` を抽出完了。残存: `getRoster`, `registerAdmin` |
| **Distribution Domain** | 🟡 **CONFIRMED / Pending Migration** | `submitDistribution`, `getDeliveryStats`, `getRankingData` が実在。コア業務機能 |
| **Area Domain** | 🟡 **CONFIRMED / Pending Migration** | `getAppData`, `getAreaDetails`, `getCityAreaDetails` が実在。マップ・進捗管理基盤 |
| **Flyer Domain** | 🟡 **CONFIRMED / Pending Migration** | `getFlyerStock`, `updateFlyerStock`, `handleRequestFlyerTransfer`, `resolveTransferRequest` が実在。在庫・移動管理 |
| **GPS / Evidence Domain**| 🟡 **CONFIRMED / Pending Migration** | `updateRecordWithGPSPhoto` が実在。現場写真・位置情報エビデンス管理 |

---

## 5. Business Entry Mapping

主要な業務パスの実在ルーティング構造：

```
1. Distribution Path:
   HTTP POST -> PlatformPostEntryHandler -> ApiRouter -> Pipeline -> submitDistribution() -> EventLog / Area Sheet

2. Area Summary Path:
   HTTP GET -> PlatformGetEntryHandler -> ApiRouter -> Pipeline -> getAppData() -> Area Sheets

3. Flyer Stock Path:
   HTTP POST -> PlatformPostEntryHandler -> ApiRouter -> Pipeline -> updateFlyerStock() -> チラシ保管庫 Sheet

4. GPS Evidence Path:
   HTTP POST -> PlatformPostEntryHandler -> ApiRouter -> Pipeline -> updateRecordWithGPSPhoto() -> Drive / Area Sheet
```

---

## 6. Infrastructure Dependency Findings

Business Layer 内に直接記述されている Native API / Adapter 未経由箇所：

1. **Spreadsheet Native Direct Access**: `getSS()` / `sheet.getRange().setValues()` が全業務関数内に直書き。
2. **Lock Native Direct Access**: `LockService.getScriptLock()` が `updateFlyerStock`, `resolveTransferRequest`, `updateRecordWithGPSPhoto` に直書き。
3. **Drive Native Direct Access**: `DriveApp` 呼び出しおよびフォルダ検索が `updateRecordWithGPSPhoto` に直書き。
4. **External API (LINE Push)**: `UrlFetchApp.fetch()` が `sendLinePushMessage` に直書き。

---

## 7. Next Migration Priority Input

P2-11C〜E へ向けたFactベースの推奨移行順序：

1. **P2-11C: Distribution Domain Service** (`submitDistribution`, `getDeliveryStats`)
   - **理由**: システムの最核心業務であり、P2-11A (Staff) と直接連携するため最高優先度。
2. **P2-11D: Area Domain Service** (`getAppData`, `getAreaDetails`, `getCityAreaDetails`)
   - **理由**: ダッシュボードおよび地図表示データの参照基盤。
3. **P2-11E: Flyer Domain Service** (`getFlyerStock`, `updateFlyerStock`, `handleRequestFlyerTransfer`, `resolveTransferRequest`)
   - **理由**: チラシ在庫・移動トランザクション管理。
4. **P2-11F: GPS / Evidence Domain Service** (`updateRecordWithGPSPhoto`)
   - **理由**: Drive 連携および写真ストレージ操作を含む最終統合ドメイン。
