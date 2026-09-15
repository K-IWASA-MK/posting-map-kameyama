const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { checkEvidence } = require('./evidence-checker');
const { validateCompletion } = require('./completion-validator');

function runGate(reportPath) {
  if (!fs.existsSync(reportPath)) {
    console.error(JSON.stringify({
      status: "WARNING",
      issues: [{ type: "FILE_NOT_FOUND", message: `Report file not found: ${reportPath}`, action: "報告書を作成してください" }],
      allowCommit: false
    }, null, 2));
    process.exit(0);
  }

  const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const claims = reportData.claims || {};
  const evidence = reportData.evidence || {};
  const evidenceChecks = checkEvidence(evidence);
  
  const issues = [];

  const completionStatus = validateCompletion(claims, evidenceChecks);
  if (Object.values(completionStatus).includes("FAIL")) {
    issues.push({
      type: "COMPLETION_STATE_INVALID",
      message: "完了ステータスに飛び級または証跡不足の違反が存在します。",
      action: "Completion Status と証跡を確認してください"
    });
  }

  // Rule 1: Verification Evidence Check
  if (claims.verified && !evidenceChecks.hasVerificationEvidence) {
    issues.push({
      type: "EVIDENCE_MISSING",
      message: "検証完了と報告されていますが、検証結果の証跡がありません。",
      action: "追加確認してください"
    });
  }

  // Rule 2: Git Evidence Check
  // claims.implemented などの完了報告時に、Gitコミット等の証跡が提示されているか
  if (claims.implemented && (!evidence.commitHash || evidence.commitHash.trim() === '')) {
    issues.push({
      type: "EVIDENCE_MISSING",
      message: "Git操作完了報告がありますが、証跡不足（commit hashなし）です。",
      action: "証跡を追加してください"
    });
  }

  // Rule 3: Deployment Evidence Check
  if (claims.deployed && !evidenceChecks.hasDeploymentEvidence) {
    issues.push({
      type: "EVIDENCE_MISSING",
      message: "Deployment完了報告がありますが、Deployment証跡がありません。",
      action: "証跡を追加してください"
    });
  }

  // Rule 4 & 5: Layer 1 Mechanical Diff Guard (STAGED_DIFF & WORKTREE_DIFF)
  try {
    const stagedDiff = execSync('git diff --cached').toString();
    const worktreeDiff = execSync('git diff').toString();
    
    if (worktreeDiff.trim().length > 0) {
      const worktreeFiles = execSync('git diff --name-only').toString().split('\n').filter(Boolean);
      issues.push({
        type: "WORKTREE_DIRTY",
        severity: "BLOCK",
        source: "MECHANICAL",
        target: worktreeFiles.join(', '),
        message: "Working Tree に未 Stage の変更保留が存在します。完了報告は許可されません。",
        action: "対象変更を commit するか git reset / restore でクリーンにしてください"
      });
    }

    // 2. STAGED_DIFF: Commit対象の正式メカニカル監査
    if (stagedDiff.trim().length > 0) {
      // Rule 4: Legacy Cleanup Check (コメントアウト残存)
      if (stagedDiff.match(/^[+]\s*(\/\/|\/\*)/m)) {
        issues.push({
          type: "LEGACY_CODE",
          severity: "BLOCK",
          source: "MECHANICAL",
          message: "Staged差分にコメント行が含まれています。旧コード残存の可能性があります。",
          action: "不要コードか確認し、必要なら削除してください"
        });
      }

      // Rule 5: Architecture Quality Check (直書きアクセスのチェック)
      if (stagedDiff.includes('active/api/v2_api.js') && stagedDiff.match(/^[+].*(SpreadsheetApp|CacheService)/m)) {
        issues.push({
          type: "ARCHITECTURE_WARNING",
          severity: "BLOCK",
          source: "MECHANICAL",
          target: "active/api/v2_api.js",
          message: "v2_api.js にビジネスロジック（直接的なデータアクセス等）が追加されています。",
          action: "Service層への分離を検討してください"
        });
      }

      // Scope 整合性の機械チェック (STAGED_DIFF 内の全ファイルが許可Scope内か)
      const stagedFiles = execSync('git diff --cached --name-only').toString().split('\n').filter(Boolean);
      const scopeJsonPath = path.join(__dirname, '../current-scope.json');
      if (fs.existsSync(scopeJsonPath)) {
        try {
          const allowedScope = JSON.parse(fs.readFileSync(scopeJsonPath, 'utf8'));
          const allowedSet = new Set(allowedScope.map(p => path.normalize(p)));
          allowedSet.add(path.normalize('.agents/current-scope.json'));
          allowedSet.add(path.normalize('.agents/auditor/report-governance-gate.js'));

          const outOfScopeStaged = stagedFiles.filter(f => !allowedSet.has(path.normalize(f)));
          if (outOfScopeStaged.length > 0) {
            issues.push({
              type: "INTENT_MISMATCH",
              severity: "BLOCK",
              source: "MECHANICAL",
              target: outOfScopeStaged.join(', '),
              message: "許可Scope外のファイルが Commit 対象 (STAGED_DIFF) に含まれています。",
              action: "対象ファイルを git reset するか current-scope.json を更新してください"
            });
          }
        } catch (e) {
          // Scope file read fallback
        }
      }
    }
  } catch (e) {
    // git command failed, ignore diff checks
  }

  const status = issues.length > 0 ? "WARNING" : "PASS";
  
  const result = {
    status: status,
    issues: issues,
    allowCommit: status === "PASS"
  };

  const auditLogPath = path.join(__dirname, '../audit-log/latest-report-audit.json');
  const finalOutput = {
    status: result.status,
    allowCommit: result.allowCommit,
    report: path.basename(reportPath),
    commitAllowed: result.allowCommit,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(auditLogPath, JSON.stringify(finalOutput, null, 2));

  console.log(JSON.stringify(result, null, 2));
  return result;
}

// CLI Entrypoint
const reportFile = process.argv[2];
if (reportFile) {
  runGate(reportFile);
} else {
  console.log(JSON.stringify({
    status: "WARNING",
    issues: [{ type: "INVALID_ARGUMENT", message: "Usage: node report-governance-gate.js <path>", action: "パスを指定してください" }],
    allowCommit: false
  }, null, 2));
}
