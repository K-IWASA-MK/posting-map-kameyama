# Security & Authentication Rule
- **Data Provisioning Security Rule**: 業務データ（CSV等）は、GitHub Pages等からクライアント側で直接Fetchしてはいけない。必ずGAS（v2_api）を経由し、認証を通過した状態で取得すること。
- **API Authentication**:
  - Hアプリ起動用の Public Bootstrap API（`getSystemSummary`, `getMapsApiKey`）は、初期描画最適化（Optimistic Load）のため無認証アクセスを許可する。
  - 上記2 APIを除くすべてのAPIアクセス（doPost / doGet）は、Tokenまたは適切な認証を通過しなければならない。
  - バックエンド認証境界の詳細は `.agents/skills/h-app-auth-boundary/SKILL.md` をSSOTとする。
