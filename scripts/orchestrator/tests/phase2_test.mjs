import { spawnWorker } from '../lib/worker_runner.mjs';
import { createHandover } from '../lib/handover_schema.mjs';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) {
      console.error(`     ${err.stack.split('\n').slice(1, 4).join('\n     ')}`);
    }
  }
}

async function main() {
  console.log('Phase 2 Test Suite: Auditor Worker Minimal Verification');

  await runAsyncTest('Auditor Worker Independent Process Execution & PID Separation', async () => {
    const handover = createHandover({
      taskId: 'task-p2-auditor-001',
      targetAgent: 'auditor',
      action: 'audit-phase2-verification',
      scope: [
        'scripts/orchestrator/lib/handover_schema.mjs',
        'scripts/orchestrator/lib/git_diff_guard.mjs'
      ],
      context: { gitHead: 'e0044a3' },
      constraints: { readOnly: true, maxDurationMs: 15000 }
    });

    const execution = await spawnWorker('scripts/orchestrator/workers/auditor_worker.mjs', handover);

    if (!execution.success) throw new Error('Execution did not succeed');
    if (typeof execution.workerPid !== 'number' || execution.workerPid <= 0) {
      throw new Error(`Invalid workerPid: ${execution.workerPid}`);
    }
    if (execution.workerPid === execution.parentPid) {
      throw new Error(`Worker PID (${execution.workerPid}) is identical to parent PID (${execution.parentPid})! Process isolation violated.`);
    }
  });

  await runAsyncTest('Millisecond-Precision Timestamp Verification', async () => {
    const handover = createHandover({
      taskId: 'task-p2-auditor-002',
      targetAgent: 'auditor',
      action: 'audit-timestamps',
      scope: ['scripts/orchestrator/lib/handover_schema.mjs'],
      constraints: { readOnly: true }
    });

    const execution = await spawnWorker('scripts/orchestrator/workers/auditor_worker.mjs', handover);

    if (typeof execution.startTime !== 'string' || !execution.startTime.includes('T')) {
      throw new Error(`Invalid startTime: ${execution.startTime}`);
    }
    if (typeof execution.endTime !== 'string' || !execution.endTime.includes('T')) {
      throw new Error(`Invalid endTime: ${execution.endTime}`);
    }
    if (typeof execution.durationMs !== 'number' || execution.durationMs < 0) {
      throw new Error(`Invalid durationMs: ${execution.durationMs}`);
    }
    if (!execution.result.details.workerStartTime || !execution.result.details.workerEndTime) {
      throw new Error('Worker internal start/end timestamps missing in details');
    }
  });

  await runAsyncTest('Result JSON Schema & 5-Viewpoint Verification', async () => {
    const handover = createHandover({
      taskId: 'task-p2-auditor-003',
      targetAgent: 'auditor',
      action: 'audit-5-viewpoints',
      scope: ['scripts/orchestrator/lib/handover_schema.mjs'],
      constraints: { readOnly: true }
    });

    const execution = await spawnWorker('scripts/orchestrator/workers/auditor_worker.mjs', handover);
    const res = execution.result;

    if (res.agent !== 'auditor') throw new Error(`Agent mismatch: ${res.agent}`);
    if (res.status !== 'PASS') throw new Error(`Status is not PASS: ${res.status}`);
    if (!Array.isArray(res.changedFiles) || res.changedFiles.length !== 0) {
      throw new Error(`changedFiles must be empty, got: ${res.changedFiles.length}`);
    }

    const d = res.details;
    if (d.viewpoint1_districtAgnostic !== 'PASS') throw new Error('viewpoint1 failed');
    if (d.viewpoint2_scopeStrictness !== 'PASS') throw new Error('viewpoint2 failed');
    if (d.viewpoint3_objectiveEvidence !== 'PASS') throw new Error('viewpoint3 failed');
    if (d.viewpoint4_zeroManualIntervention !== 'PASS') throw new Error('viewpoint4 failed');
    if (d.viewpoint5_readOnlyIntegrity !== 'PASS') throw new Error('viewpoint5 failed');
  });

  await runAsyncTest('READ ONLY Physical Zero-Diff Verification', async () => {
    const handover = createHandover({
      taskId: 'task-p2-auditor-004',
      targetAgent: 'auditor',
      action: 'audit-zero-diff',
      scope: ['scripts/orchestrator/lib/handover_schema.mjs'],
      constraints: { readOnly: true }
    });

    const execution = await spawnWorker('scripts/orchestrator/workers/auditor_worker.mjs', handover);

    if (execution.diffResult.hasDiff !== false) {
      throw new Error(`Auditor Worker produced unexpected diff:\n${execution.diffResult.diffSummary}`);
    }
    if (execution.diffResult.allChanged.length !== 0) {
      throw new Error(`Changed file count must be 0, got: ${execution.diffResult.allChanged.length}`);
    }
  });

  await runAsyncTest('Rejection of Non-Existent Scope Target', async () => {
    const handover = createHandover({
      taskId: 'task-p2-auditor-005',
      targetAgent: 'auditor',
      action: 'audit-missing-scope',
      scope: ['non_existent_file_xyz.txt'],
      constraints: { readOnly: true }
    });

    const execution = await spawnWorker('scripts/orchestrator/workers/auditor_worker.mjs', handover);
    const res = execution.result;

    if (res.status !== 'FAIL') {
      throw new Error('Auditor should have failed on missing scope file');
    }
    if (res.details.viewpoint2_scopeStrictness !== 'FAIL') {
      throw new Error('viewpoint2_scopeStrictness should be FAIL for missing file');
    }
    if (!res.issues.some(i => i.type === 'SCOPE_FILE_MISSING')) {
      throw new Error('Expected SCOPE_FILE_MISSING issue');
    }
  });

  console.log(`Phase 2 Test Summary: Total: ${totalTests}, Passed: ${passedTests}, Failed: ${failedTests}`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

main();
