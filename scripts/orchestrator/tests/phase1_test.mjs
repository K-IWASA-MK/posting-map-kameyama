import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateHandover,
  assertHandover,
  validateResult,
  assertResult,
  createHandover,
  createResult
} from '../lib/handover_schema.mjs';
import {
  captureSnapshot,
  detectDiff,
  assertDiffConstraints,
  rollback,
  DiffGuardViolationError
} from '../lib/git_diff_guard.mjs';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) {
      console.error(`     ${err.stack.split('\n').slice(1, 3).join('\n     ')}`);
    }
  }
}

console.log('Phase 1 Test Suite: Handover Schema and Git Diff Guard');

runTest('Auditor Valid Handover (readOnly: true)', () => {
  const handover = {
    taskId: 'task-test-001',
    timestamp: new Date().toISOString(),
    targetAgent: 'auditor',
    action: 'audit-phase1',
    scope: ['scripts/orchestrator/lib/handover_schema.mjs'],
    context: { gitHead: '6b77d5b' },
    constraints: { readOnly: true, maxDurationMs: 15000 }
  };
  const { valid, errors } = validateHandover(handover);
  if (!valid) throw new Error(errors.join('; '));
  assertHandover(handover);
});

runTest('Deployer Valid Handover (allowedWritePaths specified)', () => {
  const handover = createHandover({
    taskId: 'task-test-002',
    targetAgent: 'deployer',
    action: 'deploy-prep',
    scope: ['deployment.json'],
    constraints: { readOnly: false, allowedWritePaths: ['deployment.json'] }
  });
  if (handover.targetAgent !== 'deployer') throw new Error('targetAgent mismatch');
  if (handover.constraints.readOnly !== false) throw new Error('readOnly should be false');
});

runTest('Recorder Valid Handover (records write path)', () => {
  const handover = createHandover({
    taskId: 'task-test-003',
    targetAgent: 'recorder',
    action: 'record-evidence',
    scope: ['.agents/records/'],
    constraints: { readOnly: false, allowedWritePaths: ['.agents/records/'] }
  });
  if (handover.targetAgent !== 'recorder') throw new Error('targetAgent mismatch');
});

runTest('Result Valid Package (Auditor PASS with changedFiles: [])', () => {
  const result = createResult({
    taskId: 'task-test-001',
    agent: 'auditor',
    status: 'PASS',
    summary: '全観点PASS。差分なし。',
    details: { viewpoint1: 'PASS', viewpoint2: 'PASS' },
    changedFiles: []
  });
  assertResult(result, 'task-test-001');
});

runTest('Result Valid Package (Deployer PASS with updated deployment.json)', () => {
  const result = createResult({
    taskId: 'task-test-002',
    agent: 'deployer',
    status: 'PASS',
    summary: '設定生成完了',
    changedFiles: ['deployment.json']
  });
  assertResult(result, 'task-test-002');
});

runTest('Reject Handover without taskId', () => {
  const bad = {
    timestamp: new Date().toISOString(),
    targetAgent: 'auditor',
    action: 'test',
    scope: [],
    context: {},
    constraints: { readOnly: true }
  };
  const { valid, errors } = validateHandover(bad);
  if (valid) throw new Error('Should have rejected missing taskId');
  if (!errors.some(e => e.includes('taskId'))) throw new Error('Expected taskId error');
});

runTest('Reject Handover with unknown targetAgent', () => {
  const bad = {
    taskId: 'task-bad-agent',
    timestamp: new Date().toISOString(),
    targetAgent: 'malicious-hacker',
    action: 'test',
    scope: [],
    context: {},
    constraints: { readOnly: true }
  };
  const { valid, errors } = validateHandover(bad);
  if (valid) throw new Error('Should have rejected unknown targetAgent');
  if (!errors.some(e => e.includes('targetAgent'))) throw new Error('Expected targetAgent error');
});

runTest('Reject Auditor Handover with readOnly: false (Safety Rule)', () => {
  const badAuditor = {
    taskId: 'task-auditor-write',
    timestamp: new Date().toISOString(),
    targetAgent: 'auditor',
    action: 'audit',
    scope: [],
    context: {},
    constraints: { readOnly: false }
  };
  const { valid, errors } = validateHandover(badAuditor);
  if (valid) throw new Error('Should have rejected Auditor with readOnly: false');
  if (!errors.some(e => e.includes('readOnly must be true when targetAgent is "auditor"'))) {
    throw new Error('Expected Auditor readOnly constraint error');
  }
});

runTest('Reject Result Package with Auditor PASS but changedFiles not empty', () => {
  const badResult = {
    taskId: 'task-test-001',
    timestamp: new Date().toISOString(),
    agent: 'auditor',
    status: 'PASS',
    summary: 'PASS判定だがファイル変更あり（不正）',
    details: {},
    issues: [],
    evidence: [],
    changedFiles: ['active/index.html']
  };
  const { valid, errors } = validateResult(badResult);
  if (valid) throw new Error('Should have rejected Auditor PASS with non-empty changedFiles');
  if (!errors.some(e => e.includes('Auditor PASS result must have empty changedFiles'))) {
    throw new Error('Expected empty changedFiles error for Auditor');
  }
});

runTest('Reject Result Package with taskId mismatch', () => {
  const result = {
    taskId: 'task-uuid-actual',
    timestamp: new Date().toISOString(),
    agent: 'auditor',
    status: 'FAIL',
    summary: 'タスク失敗',
    details: {},
    issues: [],
    evidence: [],
    changedFiles: []
  };
  const { valid, errors } = validateResult(result, 'task-uuid-expected');
  if (valid) throw new Error('Should have rejected taskId mismatch');
  if (!errors.some(e => e.includes('taskId mismatch'))) throw new Error('Expected taskId mismatch error');
});

runTest('Capture Snapshot on Clean Tree', () => {
  const snap1 = captureSnapshot();
  if (!snap1.head || snap1.head === 'UNKNOWN_HEAD') {
    throw new Error('Failed to resolve git HEAD');
  }
  const snap2 = captureSnapshot();
  const diff = detectDiff(snap1, snap2);
  if (diff.hasDiff) {
    throw new Error(`Unexpected diff detected on clean tree: ${diff.diffSummary}`);
  }
  const check = assertDiffConstraints(diff, { readOnly: true });
  if (!check.ok) throw new Error('Clean state constraint check failed');
});

const testFilePath = resolve(process.cwd(), 'scripts/orchestrator/tests/.tmp_phase1_test_file.txt');

runTest('Detect Intentional Untracked File Creation', () => {
  const snapBefore = captureSnapshot();

  try {
    writeFileSync(testFilePath, 'Phase 1 Diff Guard Test Content', 'utf8');

    const snapAfter = captureSnapshot();
    const diff = detectDiff(snapBefore, snapAfter);

    if (!diff.hasDiff) throw new Error('Diff was not detected!');
    if (!diff.added.some(f => f.includes('.tmp_phase1_test_file.txt'))) {
      throw new Error(`Added file not found in diff: ${diff.diffSummary}`);
    }

    let readOnlyBlocked = false;
    try {
      assertDiffConstraints(diff, { readOnly: true });
    } catch (err) {
      if (err instanceof DiffGuardViolationError && err.message.includes('READ ONLY constraint violated')) {
        readOnlyBlocked = true;
      } else {
        throw err;
      }
    }
    if (!readOnlyBlocked) {
      throw new Error('assertDiffConstraints failed to block READ ONLY violation');
    }

    let unallowedBlocked = false;
    try {
      assertDiffConstraints(diff, { allowedWritePaths: ['.agents/records/'] });
    } catch (err) {
      if (err instanceof DiffGuardViolationError && err.message.includes('Unallowed write path violation')) {
        unallowedBlocked = true;
      } else {
        throw err;
      }
    }
    if (!unallowedBlocked) {
      throw new Error('assertDiffConstraints failed to block Unallowed write path violation');
    }

    const rollbackResult = rollback(snapBefore);
    if (!rollbackResult.success) throw new Error('Rollback reported failure');

    if (existsSync(testFilePath)) {
      throw new Error('Test file still exists after rollback!');
    }

    const snapFinal = captureSnapshot();
    const finalDiff = detectDiff(snapBefore, snapFinal);
    if (finalDiff.hasDiff) {
      throw new Error(`Tree not completely restored: ${finalDiff.diffSummary}`);
    }
  } finally {
    if (existsSync(testFilePath)) {
      try { unlinkSync(testFilePath); } catch {}
    }
  }
});

runTest('Detect Intentional Forbidden Path (active/) Violation', () => {
  const fakeDiff = {
    hasDiff: true,
    added: [],
    modified: ['active/manager/index.html'],
    deleted: [],
    allChanged: ['active/manager/index.html'],
    diffSummary: 'Modified: active/manager/index.html'
  };

  let forbiddenBlocked = false;
  try {
    assertDiffConstraints(fakeDiff, {
      forbiddenPaths: ['active/', 'data/', 'deployment.json']
    });
  } catch (err) {
    if (err instanceof DiffGuardViolationError && err.message.includes('Forbidden path violation')) {
      forbiddenBlocked = true;
    } else {
      throw err;
    }
  }

  if (!forbiddenBlocked) {
    throw new Error('Failed to block forbidden path active/ access');
  }
});

runTest('Detect Tracked File Modification and Verify git restore Rollback', () => {
  const targetFile = 'scripts/check-scope.mjs';
  const targetFullPath = resolve(process.cwd(), targetFile);
  const snapBefore = captureSnapshot();

  const originalContent = readFileSync(targetFullPath, 'utf8');

  try {
    writeFileSync(targetFullPath, originalContent + '\nconsole.log("TEMPORARY_TEST");\n', 'utf8');

    const snapAfter = captureSnapshot();
    const diff = detectDiff(snapBefore, snapAfter);

    if (!diff.hasDiff) throw new Error('Tracked modification was not detected!');
    if (!diff.modified.includes(targetFile)) {
      throw new Error(`Target file not found in modified list: ${diff.diffSummary}`);
    }

    let readOnlyBlocked = false;
    try {
      assertDiffConstraints(diff, { readOnly: true });
    } catch (err) {
      if (err instanceof DiffGuardViolationError && err.message.includes('READ ONLY constraint violated')) {
        readOnlyBlocked = true;
      }
    }
    if (!readOnlyBlocked) {
      throw new Error('assertDiffConstraints failed to block tracked modification under readOnly: true');
    }

    const rollbackResult = rollback(snapBefore);
    if (!rollbackResult.success) throw new Error('Rollback reported failure');

    const restoredContent = readFileSync(targetFullPath, 'utf8');
    if (restoredContent !== originalContent) {
      throw new Error('Tracked file content was not restored to exact original state!');
    }

    const snapFinal = captureSnapshot();
    const finalDiff = detectDiff(snapBefore, snapFinal);
    if (finalDiff.hasDiff) {
      throw new Error(`Tree not completely clean after rollback: ${finalDiff.diffSummary}`);
    }
  } finally {
    if (readFileSync(targetFullPath, 'utf8') !== originalContent) {
      writeFileSync(targetFullPath, originalContent, 'utf8');
    }
  }
});

console.log(`Phase 1 Test Summary: Total: ${totalTests}, Passed: ${passedTests}, Failed: ${failedTests}`);

if (failedTests > 0) {
  process.exit(1);
}
