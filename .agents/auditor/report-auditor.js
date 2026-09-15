const fs = require('fs');
const path = require('path');
const { checkEvidence } = require('./evidence-checker');
const { validateCompletion } = require('./completion-validator');

function runAudit(reportPath) {
  if (!fs.existsSync(reportPath)) {
    console.error(`Report file not found: ${reportPath}`);
    process.exit(1);
  }

  const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const claims = reportData.claims || {};
  const evidence = reportData.evidence || {};

  // 証跡確認
  const evidenceChecks = checkEvidence(evidence);

  // 状態判定
  const completionStatus = validateCompletion(claims, evidenceChecks);

  // 総合結果の判定（1つでも FAIL があれば FAIL）
  const hasFail = Object.values(completionStatus).includes("FAIL");
  const overallResult = hasFail ? "FAIL" : "PASS";

  const auditLog = {
    task: reportData.task || "Unknown Task",
    aiClaims: claims,
    evidenceChecks: evidenceChecks,
    completionStatus: completionStatus,
    overallResult: overallResult,
    timestamp: new Date().toISOString()
  };

  const auditLogDir = path.join(__dirname, '..', 'audit-log');
  if (!fs.existsSync(auditLogDir)) {
    fs.mkdirSync(auditLogDir, { recursive: true });
  }

  const logPath = path.join(auditLogDir, 'report-audit.json');
  fs.writeFileSync(logPath, JSON.stringify(auditLog, null, 2));

  console.log("Audit Complete. Log written to .agents/audit-log/report-audit.json");
  console.log(JSON.stringify(auditLog, null, 2));
}

// 実行エントリーポイント
const reportFile = process.argv[2];
if (reportFile) {
  runAudit(reportFile);
} else {
  console.log("Usage: node report-auditor.js <path_to_report_json>");
}
