import fs from 'fs';

const b64Logo = fs.readFileSync('/Volumes/SSD_DATA/posting-map/active/dashboard/assets/icon180-v2.png').toString('base64');
const logoDataUri = `data:image/png;base64,${b64Logo}`;

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>POSTING MAP ご利用ガイド</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+JP:wght@400;500;700;900&family=JetBrains+Mono:wght@500;700;800&display=swap');

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    @page {
      size: A4 portrait;
      margin: 0;
    }

    body {
      font-family: 'Inter', 'Noto Sans JP', sans-serif;
      color: #0F172A;
      background-color: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      line-height: 1.5;
    }

    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }

    .sheet {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      margin: 0 auto;
      padding: 14mm 16mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      background: #FFFFFF;
    }

    /* Header */
    .header-box {
      border-bottom: 2px solid #1E293B;
      padding-bottom: 14px;
    }

    .header-grid {
      display: grid;
      grid-template-columns: 80px 1fr auto;
      align-items: center;
      min-height: 48px;
    }

    .header-left {
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    .logo-img {
      width: 46px;
      height: 46px;
      border-radius: 8px;
      border: 1px solid #CBD5E1;
      object-fit: contain;
    }

    .header-center {
      text-align: center;
      padding: 0 10px;
    }

    .header-center h1 {
      font-size: 23px;
      font-weight: 900;
      color: #0F172A;
      letter-spacing: -0.02em;
      white-space: nowrap;
    }

    .header-right {
      text-align: right;
      font-size: 11.5px;
      font-weight: 700;
      color: #334155;
      line-height: 1.5;
      white-space: nowrap;
    }

    /* Section Container - Spaced out evenly across A4 */
    .sections-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 18px 0 14px 0;
    }

    .section-wrap {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 15px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 9px;
      display: flex;
      align-items: center;
      gap: 6px;
      letter-spacing: -0.01em;
    }

    /* Section 1: 2 URLs (Enlarged & Prominent) */
    .url-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .url-box {
      border: 1.5px solid #CBD5E1;
      border-radius: 8px;
      padding: 15px 16px;
      background: #F8FAFC;
    }
    .url-box.happ {
      border-color: #38BDF8;
      background: #F0F9FF;
    }
    .url-box.dash {
      border-color: #818CF8;
      background: #EEF2FF;
    }
    .url-box-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 5px;
      padding: 3px 10px;
      margin-bottom: 8px;
    }
    .url-box.happ .url-box-badge {
      color: #0369A1;
      border-color: #BAE6FD;
      background: #E0F2FE;
    }
    .url-box.dash .url-box-badge {
      color: #4338CA;
      border-color: #C7D2FE;
      background: #E0E7FF;
    }
    .url-box-title {
      font-size: 19px;
      font-weight: 900;
      color: #0F172A;
      margin-bottom: 6px;
      letter-spacing: -0.01em;
    }
    .url-box-desc {
      font-size: 12.5px;
      color: #334155;
      line-height: 1.55;
    }

    /* Section 2: First Steps */
    .step-setup-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .step-setup-card {
      background: #FFFFFF;
      border: 1.5px solid #CBD5E1;
      border-radius: 8px;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .setup-role {
      font-weight: 800;
      font-size: 14px;
      color: #0F172A;
      background: #F1F5F9;
      padding: 5px 14px;
      border-radius: 6px;
      white-space: nowrap;
      border: 1px solid #E2E8F0;
    }
    .setup-arrow {
      color: #64748B;
      font-weight: 800;
      font-size: 15px;
    }
    .setup-action {
      font-weight: 800;
      color: #1E293B;
      font-size: 14.5px;
    }

    /* Steps Flow (Sections 3 & 4) */
    .flow-grid-4 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .flow-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .flow-card {
      background: #FFFFFF;
      border: 1.5px solid #CBD5E1;
      border-radius: 8px;
      padding: 13px 10px;
      text-align: center;
    }
    .flow-card-label {
      font-size: 11px;
      font-weight: 800;
      color: #64748B;
      background: #F1F5F9;
      border-radius: 4px;
      padding: 2px 8px;
      display: inline-block;
      margin-bottom: 6px;
      font-family: 'JetBrains Mono', monospace;
    }
    .flow-card-name {
      font-size: 14.5px;
      font-weight: 800;
      color: #0F172A;
      display: block;
    }
    .flow-card.highlight-green {
      border-color: #86EFAC;
      background: #F0FDF4;
    }
    .flow-card.highlight-green .flow-card-label {
      color: #15803D;
      background: #DCFCE7;
    }
    .flow-card.highlight-green .flow-card-name { color: #15803D; }

    .flow-card.highlight-blue {
      border-color: #C7D2FE;
      background: #EEF2FF;
    }
    .flow-card.highlight-blue .flow-card-label {
      color: #4338CA;
      background: #E0E7FF;
    }
    .flow-card.highlight-blue .flow-card-name { color: #3730A3; }

    /* Section 5: Troubleshooting */
    .trouble-block {
      background: #FFFBEB;
      border: 1.5px solid #FCD34D;
      border-radius: 8px;
      padding: 15px 22px;
      display: grid;
      grid-template-columns: 210px 1fr;
      gap: 20px;
      align-items: center;
    }
    .trouble-symptoms {
      font-size: 13.5px;
      font-weight: 800;
      color: #92400E;
      line-height: 1.7;
    }
    .trouble-actions {
      font-size: 13.5px;
      font-weight: 700;
      color: #78350F;
      line-height: 1.7;
      border-left: 1.5px solid #FDE68A;
      padding-left: 20px;
    }

    /* Section 6: Support */
    .support-block {
      background: #F8FAFC;
      border: 1.5px solid #CBD5E1;
      border-radius: 8px;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .support-title-box {
      font-size: 14.5px;
      font-weight: 800;
      color: #0F172A;
    }
    .support-mail {
      font-size: 16px;
      font-weight: 800;
      color: #2563EB;
      background: #EFF6FF;
      padding: 6px 18px;
      border-radius: 6px;
      border: 1px solid #DBEAFE;
    }

    /* Footer */
    .report-footer {
      border-top: 1.5px solid #1E293B;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #475569;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .report-footer .brand {
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      color: #0F172A;
      letter-spacing: 0.05em;
    }

    .report-footer .catch {
      font-weight: 700;
      color: #0F172A;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <!-- ヘッダーブロック -->
    <div class="header-box">
      <div class="header-grid">
        <div class="header-left">
          <img src="${logoDataUri}" alt="POSTING MAP" class="logo-img">
        </div>
        <div class="header-center">
          <h1>POSTING MAP ご利用ガイド</h1>
        </div>
        <div class="header-right">
          <div>スタートアップ 1枚マニュアル</div>
          <div style="color: #64748B; font-size: 10.5px; margin-top: 2px;">対象：ご購入者様（管理者・現場配布員）</div>
        </div>
      </div>
    </div>

    <!-- セクションコンテナ（A4全面に均等配置） -->
    <div class="sections-container">

      <!-- ① まず、この2つを使います -->
      <div class="section-wrap">
        <div class="section-title">① まず、この2つを使います</div>
        <div class="url-grid">
          <div class="url-box happ">
            <div class="url-box-badge">現場・配布員（スマホ）</div>
            <div class="url-box-title">Hアプリ URL</div>
            <div class="url-box-desc">
              エリア確認、配布開始、枚数入力、完了写真の送信
            </div>
          </div>
          <div class="url-box dash">
            <div class="url-box-badge">本部・管理者（PC / スマホ）</div>
            <div class="url-box-title">Dashboard URL</div>
            <div class="url-box-desc">
              全体の配布進捗、各エリアの状況、配布状況の確認
            </div>
          </div>
        </div>
      </div>

      <!-- ② 最初にやること -->
      <div class="section-wrap">
        <div class="section-title">② 最初にやること</div>
        <div class="step-setup-grid">
          <div class="step-setup-card">
            <span class="setup-role">管理者</span>
            <span class="setup-arrow">→</span>
            <span class="setup-action">Dashboard URLを開く</span>
          </div>
          <div class="step-setup-card">
            <span class="setup-role">配布員</span>
            <span class="setup-arrow">→</span>
            <span class="setup-action">Hアプリ URLを開く</span>
          </div>
        </div>
      </div>

      <!-- ③ 配布員の操作 -->
      <div class="section-wrap">
        <div class="section-title">③ 配布員の操作</div>
        <div class="flow-grid-4">
          <div class="flow-card">
            <span class="flow-card-label">STEP 1</span>
            <span class="flow-card-name">エリア確認</span>
          </div>
          <div class="flow-card">
            <span class="flow-card-label">STEP 2</span>
            <span class="flow-card-name">配布開始</span>
          </div>
          <div class="flow-card">
            <span class="flow-card-label">STEP 3</span>
            <span class="flow-card-name">配布</span>
          </div>
          <div class="flow-card highlight-green">
            <span class="flow-card-label">STEP 4</span>
            <span class="flow-card-name">完了報告</span>
          </div>
        </div>
      </div>

      <!-- ④ 管理者の操作 -->
      <div class="section-wrap">
        <div class="section-title">④ 管理者の操作</div>
        <div class="flow-grid-3">
          <div class="flow-card">
            <span class="flow-card-label">STEP 1</span>
            <span class="flow-card-name">Overviewで全体確認</span>
          </div>
          <div class="flow-card">
            <span class="flow-card-label">STEP 2</span>
            <span class="flow-card-name">必要なエリアを確認</span>
          </div>
          <div class="flow-card highlight-blue">
            <span class="flow-card-label">STEP 3</span>
            <span class="flow-card-name">詳細を見る</span>
          </div>
        </div>
      </div>

      <!-- ⑤ 困ったとき -->
      <div class="section-wrap">
        <div class="section-title">⑤ 困ったとき</div>
        <div class="trouble-block">
          <div class="trouble-symptoms">
            地図が出ない<br>
            位置情報が取れない<br>
            アプリが動かない
          </div>
          <div class="trouble-actions">
            → まず再読み込み（リロード）<br>
            → 位置情報・カメラの許可を確認<br>
            → 改善しない場合はサポートへ
          </div>
        </div>
      </div>

      <!-- ⑥ サポート -->
      <div class="section-wrap">
        <div class="section-title">⑥ サポート</div>
        <div class="support-block">
          <div class="support-title-box">
            サポート窓口
          </div>
          <div class="support-mail font-mono">
            postingareamap@gmail.com
          </div>
        </div>
      </div>

    </div>

    <!-- フッターブロック -->
    <div class="report-footer">
      <span class="brand">POSTING MAP - FIELD OPERATIONS PLATFORM</span>
      <span class="catch">届いた2つのURLを開くだけで即日スタート</span>
    </div>
  </div>
</body>
</html>
`;

export { html };

if (process.argv[1] && process.argv[1].endsWith('build_template_guide.mjs')) {
  const tmpPath = '/tmp/POSTING_MAP_GUIDE.html';
  fs.writeFileSync(tmpPath, html, 'utf8');
  console.log(`HTML written to ${tmpPath}`);
}
