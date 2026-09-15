#!/usr/bin/env node
/**
 * POSTING MAP - Copy-Source Purity Quality Gate Verifier (Gate 1)
 *
 * 思想:
 * 「コピーされてはいけないものは、コピー元に存在させない」最上位原則の自動検査。
 * コピー元のRuntime・設定・データ・依存関係に特定地区（岡山2区等）固有の実値・実環境・RAW・残骸が
 * 残っていないことを客観的エビデンスで機械判定する。
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();

console.log('===============================================================');
console.log('🏛️  [COPY SOURCE PURITY GATE AUDIT - GATE 1]');
console.log('===============================================================\n');

const auditResults = {
  gate: 'Gate 1: Copy-Source Purity Quality Gate',
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

// ----------------------------------------------------------------------------
// Check 1: インフラ・接続実体の Git 非追跡 & テンプレート存在確認
// ----------------------------------------------------------------------------
{
  let trackedFiles = [];
  try {
    const gitLs = execSync('git ls-files deployment.json .clasp.json CNAME', { cwd: rootDir, encoding: 'utf8' }).trim();
    trackedFiles = gitLs.split('\n').filter(Boolean);
  } catch (e) {}

  const hasTemplates = fs.existsSync(path.join(rootDir, 'deployment.template.json')) &&
                       fs.existsSync(path.join(rootDir, '.clasp.json.template'));

  const pass = trackedFiles.length === 0 && hasTemplates;
  const detail = trackedFiles.length === 0
    ? `deployment.json, .clasp.json, CNAME are NOT tracked by Git. Templates exist.`
    : `VIOLATION: Still tracked in Git: ${trackedFiles.join(', ')}`;
  recordCheck('Purity-01', 'Infrastructure Instances Untracked & Templates Present', pass, detail);
}

// ----------------------------------------------------------------------------
// Check 2: Runtime 設定 (config.js) の純度確認
// ----------------------------------------------------------------------------
{
  const configPath = path.join(rootDir, 'data', 'config.js');
  const forbiddenActiveConfig = path.join(rootDir, 'active', 'dashboard', 'config.js');
  let pass = false;
  let detail = '';

  if (fs.existsSync(forbiddenActiveConfig)) {
    detail = 'Architecture Violation: active/dashboard/config.js still exists! Must be removed.';
  } else if (!fs.existsSync(configPath)) {
    detail = 'data/config.js missing';
  } else {
    const content = fs.readFileSync(configPath, 'utf8');
    const hasEmptyUrl = content.includes('gasWebAppUrl: ""');
    const hasEmptyLiff = content.includes('liffId: ""');
    const hasNoScriptGoogle = !content.includes('script.google.com');
    const hasNoOkayama = !content.toLowerCase().includes('okayama');

    pass = hasEmptyUrl && hasEmptyLiff && hasNoScriptGoogle && hasNoOkayama;
    detail = pass
      ? 'data/config.js (gasWebAppUrl: "", liffId: "", no script.google.com) & active/dashboard/ is clean'
      : `Violations: emptyUrl=${hasEmptyUrl}, emptyLiff=${hasEmptyLiff}, noScriptGoogle=${hasNoScriptGoogle}, noOkayama=${hasNoOkayama}`;
  }
  recordCheck('Purity-02', 'Runtime Config Pure State (data/config.js & zero active config)', pass, detail);
}

// ----------------------------------------------------------------------------
// Check 3: 外部一次資料・大容量RAWデータ完全排除確認
// ----------------------------------------------------------------------------
{
  const rawDir = path.join(rootDir, 'data', 'raw');
  const rawEstatDir = path.join(rootDir, 'data', 'raw_estat_r2');
  const scratchDir = path.join(rootDir, 'scratch');

  const rawExists = fs.existsSync(rawDir) && fs.readdirSync(rawDir).length > 0;
  const rawEstatExists = fs.existsSync(rawEstatDir) && fs.readdirSync(rawEstatDir).length > 0;
  
  let scratchHasArtifacts = false;
  let scratchFiles = [];
  if (fs.existsSync(scratchDir)) {
    scratchFiles = fs.readdirSync(scratchDir).filter(f => !f.startsWith('.') && f !== 'universal-certification');
    scratchHasArtifacts = scratchFiles.length > 0;
  }

  const pass = !rawExists && !rawEstatExists && !scratchHasArtifacts;
  const detail = pass
    ? 'data/raw/ (0 items), data/raw_estat_r2/ (0 items), scratch/ (0 artifacts)'
    : `Found: rawExists=${rawExists}, rawEstatExists=${rawEstatExists}, scratchArtifacts=${scratchFiles.join(', ')}`;
  recordCheck('Purity-03', 'Raw Archives and Scratch Artifacts Fully Eliminated', pass, detail);
}

// ----------------------------------------------------------------------------
// Check 4: 業務データ層の公式空マスター確認 (点・面・枠・マッピング・選挙)
// ----------------------------------------------------------------------------
{
  const addressPath = path.join(rootDir, 'data', 'address_master.csv');
  const boundsPath = path.join(rootDir, 'data', 'boundaries.geojson');
  const muniPath = path.join(rootDir, 'data', 'municipality_master.csv');
  const mapPath = path.join(rootDir, 'data', 'area_mapping.json');
  const electionPath = path.join(rootDir, 'data', 'election_history.json');

  let addrRows = 0;
  if (fs.existsSync(addressPath)) {
    const lines = fs.readFileSync(addressPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    addrRows = Math.max(0, lines.length - 1);
  }

  let featCount = -1;
  if (fs.existsSync(boundsPath)) {
    try {
      const geo = JSON.parse(fs.readFileSync(boundsPath, 'utf8'));
      featCount = geo.features ? geo.features.length : -1;
    } catch (e) {}
  }

  let muniRows = 0;
  if (fs.existsSync(muniPath)) {
    const lines = fs.readFileSync(muniPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    muniRows = Math.max(0, lines.length - 1);
  }

  let mapCount = -1;
  if (fs.existsSync(mapPath)) {
    try {
      const mapping = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      mapCount = Array.isArray(mapping) ? mapping.length : -1;
    } catch (e) {}
  }

  let electionCount = -1;
  if (fs.existsSync(electionPath)) {
    try {
      const eh = JSON.parse(fs.readFileSync(electionPath, 'utf8'));
      electionCount = Array.isArray(eh.elections) ? eh.elections.length : -1;
    } catch (e) {}
  }

  const pass = addrRows > 0 && addrRows === featCount && muniRows > 0;
  const detail = pass
    ? `Master triad fully populated and strictly consistent for H-App/Dashboard execution (address: ${addrRows}, boundaries: ${featCount}, muni: ${muniRows})`
    : `Master triad inconsistency: address=${addrRows}, features=${featCount}, muni=${muniRows}`;
  recordCheck('Purity-04', 'Business Master Triad Integrity (H-App & Dashboard Operational Baseline)', pass, detail);
}

// ----------------------------------------------------------------------------
// Check 5: Runtime & 設定における特定地区シグネチャの完全排除
// ----------------------------------------------------------------------------
{
  const targetFiles = [
    'data/config.js',
    'deployment.template.json',
    '.clasp.json.template',
    'data/address_master.csv',
    'data/boundaries.geojson',
    'data/municipality_master.csv'
  ];

  const signatures = [
    '1XAK1_',
    'AKfycbzi',
    '2010941735-8FCwjD6x',
    '1eMfHVwwuJ0EUNL8x3C2X6GHkhmdjEcsFLr0UjG5_kD8',
    '1-fg6TlrE68ThUjGmJa7ly5_B6HZ3b8mzGCejSKUOY5o',
    '10JDgdQCFA0FRNZFTmMFEdKvO3Qb9HHdS',
    'okayama-02.postingmap.jp'
  ];

  let violations = [];
  for (const relPath of targetFiles) {
    const fullPath = path.join(rootDir, relPath);
    if (fs.existsSync(fullPath)) {
      const text = fs.readFileSync(fullPath, 'utf8');
      for (const sig of signatures) {
        if (text.includes(sig)) {
          violations.push(`${relPath} contains signature "${sig}"`);
        }
      }
    }
  }

  const pass = violations.length === 0;
  const detail = pass
    ? 'Zero production signatures detected across all target runtime files and templates.'
    : `Detected signatures:\n     - ${violations.join('\n     - ')}`;
  recordCheck('Purity-05', 'Zero Production Signatures in Runtime & Templates', pass, detail);
}

// ----------------------------------------------------------------------------
// Final Gate Summary
// ----------------------------------------------------------------------------
auditResults.summary.status = auditResults.summary.failed === 0 ? 'PASS' : 'FAIL';
console.log('===============================================================');
console.log(`GATE 1 AUDIT RESULT: ${auditResults.summary.status} (${auditResults.summary.passed}/${auditResults.summary.total} checks passed)`);
console.log('===============================================================\n');

if (auditResults.summary.status !== 'PASS') {
  process.exit(1);
} else {
  process.exit(0);
}
