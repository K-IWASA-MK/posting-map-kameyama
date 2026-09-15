# Architecture Issue Inventory - active/api/v2_api.js
Version: 1.0
Status: SSOT (READ ONLY AUDIT)

---

## 1. Issue Inventory

R-1 〜 R-8 の監査データ（事実）から抽出されたアーキテクチャ上の課題一覧です。推測や主観を排し、監査で確認された客観的事実のみを課題として定義しています。

| Issue ID | Category (Primary) | Title (課題名) | Evidence Sprint (根拠) | Related Sections (影響セクション) |
|----------|--------------------|----------------|------------------------|-----------------------------------|
| **ISS-001** | Routing | 3重ルーティングによるアクション定義の重複 | R-2 | SEC-006, SEC-007, SEC-008, SEC-009, SEC-051 |
| **ISS-002** | Framework | 巨大単一ファイルへの責務集中とインフラ占有 | R-3, R-8 | 全セクション (SEC-001〜066) |
| **ISS-003** | Shared Infrastructure | 共有ユーティリティ `getSS()` への広範な密結合 | R-4, R-5 | 24セクション (Business, Auth 等) |
| **ISS-004** | Business | 業務ドメイン層の物理的な細切れ分断 | R-3, R-7 | Business層 (22セクション) |
| **ISS-005** | External Dependency | 外部 API (`DriveApp`, `UrlFetchApp`) への直接結合 | R-6 | 10セクション (SEC-020, 059等) |
| **ISS-006** | Runtime | サーバーレス環境での共有状態リセットとIO偏重 | R-5, R-6 | 全 Pipeline および Business セクション |
| **ISS-007** | Framework | 多段パイプラインのハードコード順序と状態結合 | R-4, R-8 | Pipeline層 (SEC-036, 058等 8セクション) |

---

## 2. Issue Category Matrix

各課題の分類マトリクスです。各 Issue は1つの Primary Category と 任意の Secondary Category を持ちます。

| Issue ID | Primary Category | Secondary Category | 課題の性質（概要） |
|----------|------------------|--------------------|--------------------|
| **ISS-001** | Routing | Platform | 実行経路の分散と重複による保守性の低下 |
| **ISS-002** | Framework | Responsibility | 物理ファイル単位の凝集度低下と巨大化 |
| **ISS-003** | Shared Infrastructure | Boundary | データアクセス層とビジネスロジックの密結合 |
| **ISS-004** | Business | Responsibility | 同一レイヤー内のコードの物理的分断 |
| **ISS-005** | External Dependency | Runtime | 外部ランタイムとビジネス層の直接結合 |
| **ISS-006** | Runtime | Shared Infrastructure | 状態非保持特性に起因する都度IOの発生 |
| **ISS-007** | Framework | Boundary | 処理ステージ間の暗黙的なデータ依存状態 |

---

## 3. Evidence Mapping

各 Issue が「どのスプリントの、どの客観的事実に基づいているか」の追跡マッピングです。

| Issue ID | Evidence Sprint | 具体的な監査事実 (Fact) |
|----------|-----------------|-------------------------|
| **ISS-001** | R-2 | `registerStaff` 等4アクションが3箇所、12アクションが2箇所にルーティング定義として重複している事実。 |
| **ISS-002** | R-3, R-8 | 単一ファイルが5,235行に達し、その79.00%（4,136行）が非Businessロジック（フレームワーク・インフラ）で占められている事実。 |
| **ISS-003** | R-4, R-5 | ファイル全体の約3割にのぼる24セクションが `getSS()` を直接呼び出し、データストレージ層と密結合している事実。 |
| **ISS-004** | R-3, R-7 | Business層のコードが `L677-1574` と `L2229-2429` の2ブロックに分断され、間に無関係な600行の他レイヤーが挟まっている事実。 |
| **ISS-005** | R-6 | `DriveApp` が8セクション、`UrlFetchApp` が4セクションから呼び出され、抽象化ラッパーが存在しない事実。 |
| **ISS-006** | R-5, R-6 | リクエストごとにプロセスが破棄されるため、`CONFIG` へのプロパティアクセスが31セクションから毎回発生している事実。 |
| **ISS-007** | R-4, R-8 | 15段階の実行ステージ順序がハードコードされ、後続ステージが前段ステージで生成される `Context` オブジェクトの状態に絶対依存している事実。 |

---

## 4. Section Impact Matrix

各 Issue が影響を及ぼしている Section のマッピングです。

| Issue ID | SEC-006~009 (Entry) | SEC-011~029 (Business) | SEC-036~045 (Pipeline) | SEC-049~066 (Framework) |
|----------|:-------------------:|:----------------------:|:----------------------:|:-----------------------:|
| **ISS-001** | ○ | - | - | ○ (SEC-051) |
| **ISS-002** | ○ | ○ | ○ | ○ |
| **ISS-003** | ○ | ○ | - | ○ |
| **ISS-004** | - | ○ | - | - |
| **ISS-005** | - | ○ | - | ○ |
| **ISS-006** | ○ | ○ | ○ | ○ |
| **ISS-007** | - | - | ○ | ○ |

---

## 5. Layer Impact Matrix

各 Issue が影響を及ぼしているアーキテクチャレイヤーの集計です。

| Issue ID | Business | Framework | Infrastructure | Runtime |
|----------|:--------:|:---------:|:--------------:|:-------:|
| **ISS-001** | - | ○ | - | - |
| **ISS-002** | ○ | ○ | ○ | - |
| **ISS-003** | ○ | - | ○ | - |
| **ISS-004** | ○ | - | - | - |
| **ISS-005** | ○ | - | - | ○ |
| **ISS-006** | ○ | - | ○ | ○ |
| **ISS-007** | - | ○ | - | - |

---

## 6. Dependency Impact Matrix

各 Issue が関係している依存要素のマッピングです。

| Issue ID | Shared Infrastructure | External API | Framework | Business |
|----------|:---------------------:|:------------:|:---------:|:--------:|
| **ISS-001** | - | - | ○ | - |
| **ISS-002** | ○ | ○ | ○ | ○ |
| **ISS-003** | ○ (`getSS()`) | - | - | ○ |
| **ISS-004** | - | - | - | ○ |
| **ISS-005** | - | ○ (`DriveApp`等) | - | ○ |
| **ISS-006** | ○ (`CONFIG`) | - | ○ | - |
| **ISS-007** | - | - | ○ | - |

---

## 7. Constraint Mapping

各課題に紐づく実行環境上の制約事項のマッピングです。

| Issue ID | Runtime | GAS | Shared State | Pipeline | Entry |
|----------|:-------:|:---:|:------------:|:--------:|:-----:|
| **ISS-001** | - | - | - | - | ○ |
| **ISS-002** | - | ○ (ファイルサイズ/ホイスティング) | - | - | - |
| **ISS-003** | - | ○ (スプレッドシートIO) | - | - | - |
| **ISS-004** | - | - | - | - | - |
| **ISS-005** | ○ | ○ (GASネイティブAPI) | - | - | - |
| **ISS-006** | ○ (ステートレス)| - | ○ | - | - |
| **ISS-007** | - | - | ○ (Context依存) | ○ | - |

---

## 8. Evidence Coverage

R-1 から R-8 の各監査スプリントが、どの Issue のエビデンス（事実提供元）として機能しているかのカバレッジ一覧です。
（※すべてのIssueがR-1〜R-8のいずれかの事実に裏付けられています）

| Sprint | 監査対象 | 裏付けを提供している Issue ID |
|--------|---------|-------------------------------|
| **R-1** | Structure Mapping | ISS-002, ISS-004 (構造の基礎データとして) |
| **R-2** | Entry & Routing | ISS-001 |
| **R-3** | Responsibility Analysis | ISS-002, ISS-004 |
| **R-4** | Boundary Analysis | ISS-003, ISS-007 |
| **R-5** | Shared Infrastructure | ISS-003, ISS-006 |
| **R-6** | External Dependency | ISS-005, ISS-006 |
| **R-7** | Business Domain Mapping | ISS-004 |
| **R-8** | Framework & Platform Mapping | ISS-002, ISS-007 |

---

## 9. Architecture Issue Summary

抽出された課題の客観的な定量サマリです。改善案や主観的評価は含みません。

- **Issue 総数**: 7件
- **Category (Primary) 分布**:
  - Routing: 1件
  - Framework: 2件
  - Shared Infrastructure: 1件
  - External Dependency: 1件
  - Business: 1件
  - Runtime: 1件
- **Layer 影響数**:
  - Business層へ影響する課題: 5件
  - Framework層へ影響する課題: 4件
  - Infrastructure層へ影響する課題: 3件
  - Runtime層へ影響する課題: 2件
- **Section 影響数**:
  - 全セクション（または広範なセクション）にまたがる課題: 5件 (ISS-002, 003, 004, 006, 007)
  - 特定層に局所化されている課題: 2件 (ISS-001, ISS-005)
- **Sprint Coverage**: 100%（R-1〜R-8の全ての監査データがエビデンスとして活用され、EvidenceのないIssueは存在しない）

---

> [!IMPORTANT]
> ## 監査免責事項
> **本監査は READ ONLY とする。監査結果に基づく修正計画は別工程（Phase 2）で策定し、本監査ではコード・設定・Git・GASへの変更や具体的な改善策の提案を一切行わない。**
