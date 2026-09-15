# Specification: Domain Architecture

Version: 1.6.0 (Brand Unification Approved)
Status: APPROVED
Author: POSTING MAP Infrastructure Department
Target System: POSTING MAP / FIELD OPERATIONS OS

---

## 1. Overview

本仕様書は、POSTING MAP を販売版サービスとして運用するための独自ドメイン（`posting-map.jp`）基盤、サブドメイン構成、DNS レコード配置、GitHub Pages Custom Domain 設定、および SSL/TLS 通信の技術仕様を統一定義する。

---

## 2. Subdomain Architecture & Role Mapping

販売版 POSTING MAP は単一ブランドドメイン `posting-map.jp` のもと、以下の役割別サブドメインで運用する。

```
                    posting-map.jp (Root Domain)
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
  app.posting-map.jp     admin.posting-map.jp     api.posting-map.jp
 (App: 現場入力 PWA)    (Dashboard: 運営管理)    (GAS Web API Proxy)
```

| サブドメイン | 対象コンポーネント | 主なユーザー | 提供機能 / エンドポイント |
| :--- | :--- | :--- | :--- |
| `app.posting-map.jp` | **App** | ボランティア・配布員 | 現場入力専用（GPS記録、写真送信、LINE/LIFF起動） |
| `admin.posting-map.jp` | **Dashboard** | 支部長・候補者・県連・本部 | 支部〜本部統一運営・分析システム（単一システム） |
| `api.posting-map.jp` | **API Gateway Proxy** | システム間通信 | GAS Web App URL 隠蔽プロキシ、レスポンス高速化 |

---

## 3. GitHub Pages Custom Domain & CNAME Specification

### 3.1. CNAME File Placement
リポジトリの配信ルートに `CNAME` ファイルを配置する。

- **ファイルパス**: `/CNAME`
- **記述内容**: `app.posting-map.jp`

### 3.2. GitHub Pages Setting Requirements
1. **Source**: Deploy from a branch (`main` branch / root `/`)
2. **Custom Domain**: `app.posting-map.jp` を指定
3. **Enforce HTTPS**: **有効化 (CHECKED)**
4. **Bypass Jekyll (`.nojekyll`)**: リポジトリルートへの `.nojekyll` 配置を必須とし、直接静的ファイル配信を行う。

---

## 4. DNS Record Configuration (DNS Infrastructure)

DNS プロバイダーにおける設定値。

### 4.1. GitHub Pages IP (Apex / Apex Redirect)
Apex ドメイン (`posting-map.jp`) を使用する場合は、以下の GitHub Pages 配信 IP アドレスへの A レコードを設定する。

- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

### 4.2. CNAME Records for Subdomains

| レコードタイプ | ホスト名 (Name) | 値 (Value / Target) | TTL | 備考 |
| :--- | :--- | :--- | :--- | :--- |
| **CNAME** | `app` | `area-management.github.io.` | 3600 | App (現場入力) 配信 |
| **CNAME** | `admin` | `area-management.github.io.` | 3600 | Dashboard (統一管理) 配信 |
| **CNAME** | `api` | `gateway.posting-map.workers.dev.` | 3600 | Worker/Proxy Gateway |

---

## 5. SSL/TLS Certificate & Security Standards

- **SSL 方式**: TLS 1.3 必須
- **証明書発行**: GitHub Pages 自動 Let's Encrypt 証明書
- **HSTS (HTTP Strict Transport Security)**: 有効化（ヘッダー: `max-age=31536000; includeSubDomains`）
- **CORS (Cross-Origin Resource Sharing)**: `app.posting-map.jp` および `admin.posting-map.jp` から `api.posting-map.jp` への通信のみを限定許可。

---

## 6. LIFF Endpoint URL Integration

LINE Developers (`Civic Tech Inc.` / `POSTING MAP Login`) コンソールにおける LIFF Endpoint URL とドメインの対応規則。

- **LIFF App (App)**: `https://app.posting-map.jp/active/dashboard/index.html`
- **LIFF Redirect / Callback URI**: `https://app.posting-map.jp/`
