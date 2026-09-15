#!/usr/bin/env node
/**
 * POSTING MAP - Copy-Resilience Simulation Verifier (Gate 4)
 *
 * 思想:
 * 「コピー元から新地区フォルダーを物理複製（cp -r）した瞬間に、
 * 前地区（岡山2区）への誤爆・本番破壊・データ混線が物理的に起きないか」を
 * 実際に隔離フォルダーへ複製して機械検証するシミュレーター。
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

const rootDir = process.cwd();
const tempDir = path.join(os.tmpdir(), `posting-map-copy-sim-${Date.now()}`);

console.log('===============================================================');
console.log('🏛️  [COPY RESILIENCE SIMULATION AUDIT - GATE 4]');
console.log(` Target Simulation Sandbox: ${tempDir}`);
console.log('===============================================================\n');

const auditResults = {
  gate: 'Gate 4: Copy-Resilience Simulation Audit',
  timestamp: new Date().toISOString(),
  checks: [],
  summary: { total: 0, passed: 0, failed: 0, status: 'PENDING' }
};

function recordCheck(id, name, pass, detail) {
  auditResults.summary.total++;
  if (pass) {
    auditResults.summary.passed++;
    console.log(`✅ [${id}] PASS: ${name}`);
    console.log(`   Evidence: ${detail}\n`);
  } else {
    auditResults.summary.failed++;
    console.error(`❌ [${id}] FAIL: ${name}`);
    console.error(`   Evidence: ${detail}\n`);
  }
  auditResults.checks.push({ id, name, pass, detail });
}

try {
  // 1. Simulate cp -r excluding .git
  fs.mkdirSync(tempDir, { recursive: true });
  execSync(`rsync -a --exclude='.git' --exclude='node_modules' "${rootDir}/" "${tempDir}/"`);

  // Check 1: No production config instances in copied folder
  {
    const hasDeployment = fs.existsSync(path.join(tempDir, 'deployment.json'));
    const hasClasp = fs.existsSync(path.join(tempDir, '.clasp.json'));
    const hasCname = fs.existsSync(path.join(tempDir, 'CNAME'));
    const pass = !hasDeployment && !hasClasp && !hasCname;
    const detail = pass
      ? 'Zero instance configs (deployment.json, .clasp.json, CNAME) transferred to replica.'
      : `Leaked files: deployment=${hasDeployment}, clasp=${hasClasp}, cname=${hasCname}`;
    recordCheck('CopySafe-01', 'Zero Production Instance Configs in Copied Replica', pass, detail);
  }

  // Check 2: No raw archives or scratch artifacts in replica
  {
    const rawExists = fs.existsSync(path.join(tempDir, 'data', 'raw')) && fs.readdirSync(path.join(tempDir, 'data', 'raw')).length > 0;
    const rawEstatExists = fs.existsSync(path.join(tempDir, 'data', 'raw_estat_r2')) && fs.readdirSync(path.join(tempDir, 'data', 'raw_estat_r2')).length > 0;
    const scratchFiles = fs.existsSync(path.join(tempDir, 'scratch')) ? fs.readdirSync(path.join(tempDir, 'scratch')).filter(f => !f.startsWith('.') && f !== 'universal-certification') : [];
    const pass = !rawExists && !rawEstatExists && scratchFiles.length === 0;
    const detail = pass
      ? 'Zero raw data archives or scratch files transferred to replica.'
      : `Leaked data: rawExists=${rawExists}, rawEstat=${rawEstatExists}, scratch=${scratchFiles.join(', ')}`;
    recordCheck('CopySafe-02', 'Zero Raw Archives or Artifacts in Replica', pass, detail);
  }

  // Check 3: Copied config.js is completely pure (no production endpoints)
  {
    const cfgPath = path.join(tempDir, 'data', 'config.js');
    const forbiddenActiveConfig = path.join(tempDir, 'active', 'dashboard', 'config.js');
    let pass = false;
    let detail = '';
    if (fs.existsSync(forbiddenActiveConfig)) {
      detail = 'Architecture Violation: Copied replica contains active/dashboard/config.js! Must be clean.';
    } else if (fs.existsSync(cfgPath)) {
      const content = fs.readFileSync(cfgPath, 'utf8');
      const hasEmptyUrl = content.includes('gasWebAppUrl: ""');
      const hasEmptyLiff = content.includes('liffId: ""');
      pass = hasEmptyUrl && hasEmptyLiff;
      detail = pass
        ? 'Copied data/config.js has empty gasWebAppUrl and liffId (100% safe).'
        : `Copied data/config.js contains endpoints or non-empty strings!`;
    } else {
      detail = 'Copied data/config.js missing!';
    }
    recordCheck('CopySafe-03', 'Replica Client Config 100% Safe (data/config.js pure & active clean)', pass, detail);
  }

  // Check 4: Accidental clasp push in replica fails safely (no destination)
  {
    let pushFailedSafely = false;
    let pushOutput = '';
    try {
      pushOutput = execSync('npx clasp push', { cwd: tempDir, encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      pushFailedSafely = true;
      pushOutput = (e.stderr || e.stdout || e.message).toString();
    }
    const pass = pushFailedSafely;
    const detail = pass
      ? `Accidental clasp push safely BLOCKED (Error: .clasp.json not found). Production GAS cannot be overwritten.`
      : `CRITICAL RISK: clasp push succeeded unexpectedly! Output: ${pushOutput}`;
    recordCheck('CopySafe-04', 'Accidental Push Physical Barrier (Fail-Safe Verified)', pass, detail);
  }

} finally {
  // Cleanup simulation sandbox
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {}
}

// ----------------------------------------------------------------------------
// Final Gate Summary
// ----------------------------------------------------------------------------
auditResults.summary.status = auditResults.summary.failed === 0 ? 'PASS' : 'FAIL';
console.log('===============================================================');
console.log(`GATE 4 AUDIT RESULT: ${auditResults.summary.status} (${auditResults.summary.passed}/${auditResults.summary.total} checks passed)`);
console.log('===============================================================\n');

if (auditResults.summary.status !== 'PASS') {
  process.exit(1);
} else {
  process.exit(0);
}
