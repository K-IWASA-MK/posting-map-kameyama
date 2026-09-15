import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHandover } from '../lib/handover_schema.mjs';
import { runParallelOrchestrator } from '../lib/parallel_orchestrator.mjs';
import { captureSnapshot, detectDiff } from '../lib/git_diff_guard.mjs';

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
  console.log('Phase 5 Test Suite: 3 Worker True Parallel Execution and Result Aggregation');

  const testRecordFile = '.agents/records/record-999-phase5-parallel-test.md';
  const testRecordFullPath = resolve(process.cwd(), testRecordFile);

  const testDeployFile = 'scripts/orchestrator/tests/.tmp_phase5_deploy.json';
  const testDeployFullPath = resolve(process.cwd(), testDeployFile);

  await runAsyncTest('3 Worker Concurrent Execution, PID Separation, and True Time Overlap', async () => {
    try {
      const auditorHandover = createHandover({
        taskId: 'task-p5-auditor',
        targetAgent: 'auditor',
        action: 'parallel-audit',
        scope: ['scripts/orchestrator/lib/handover_schema.mjs'],
        context: { simulationDelayMs: 120 },
        constraints: { readOnly: true }
      });

      const deployerHandover = createHandover({
        taskId: 'task-p5-deployer',
        targetAgent: 'deployer',
        action: 'parallel-deploy-sim',
        scope: [testDeployFile],
        context: {
          writeTarget: testDeployFile,
          simulationDelayMs: 100
        },
        constraints: {
          readOnly: false,
          allowedWritePaths: [testDeployFile]
        }
      });

      const recorderHandover = createHandover({
        taskId: 'task-p5-recorder',
        targetAgent: 'recorder',
        action: 'parallel-record',
        scope: [testRecordFile],
        context: {
          title: 'Phase 5 Parallel Execution Record',
          recordFileName: testRecordFile,
          simulationDelayMs: 110
        },
        constraints: {
          readOnly: false,
          allowedWritePaths: ['.agents/records/']
        }
      });

      const { summaryReport, successfulWorkers, failedWorkers } = await runParallelOrchestrator([
        auditorHandover,
        deployerHandover,
        recorderHandover
      ]);

      if (failedWorkers.length > 0) {
        throw new Error(`Workers failed during parallel run: ${failedWorkers.map(f => f.error).join('; ')}`);
      }
      if (successfulWorkers.length !== 3) {
        throw new Error(`Expected 3 successful workers, got ${successfulWorkers.length}`);
      }

      const pids = successfulWorkers.map(w => w.workerPid);
      const uniquePids = new Set(pids);
      if (uniquePids.size !== 3) {
        throw new Error(`PIDs are not distinct among 3 workers: [${pids.join(', ')}]`);
      }
      for (const w of successfulWorkers) {
        if (w.workerPid === w.parentPid) {
          throw new Error(`Worker PID (${w.workerPid}) is identical to parent PID!`);
        }
      }

      if (!summaryReport.isTrueParallel) {
        throw new Error(`True parallel execution was not confirmed: ${JSON.stringify(summaryReport.overlapAnalysis)}`);
      }

      for (const analysis of summaryReport.overlapAnalysis) {
        if (!analysis.overlaps || analysis.overlapMs <= 0) {
          throw new Error(`Pair ${analysis.pair} did not overlap in time: ${analysis.overlapMs}ms`);
        }
      }

      const auditorRes = successfulWorkers.find(w => w.agent === 'auditor');
      if (auditorRes.result.changedFiles.length !== 0) {
        throw new Error('Auditor breached READ ONLY contract in parallel run');
      }

      const recorderRes = successfulWorkers.find(w => w.agent === 'recorder');
      if (!recorderRes.result.changedFiles.includes(testRecordFile)) {
        throw new Error('Recorder did not write expected record in parallel run');
      }

      const deployerRes = successfulWorkers.find(w => w.agent === 'deployer');
      if (!deployerRes.result.changedFiles.includes(testDeployFile)) {
        throw new Error('Deployer did not write expected deploy target in parallel run');
      }

      if (summaryReport.overallStatus !== 'ALL_PASS') {
        throw new Error(`Overall status is not ALL_PASS: ${summaryReport.overallStatus}`);
      }
    } finally {
      if (existsSync(testRecordFullPath)) unlinkSync(testRecordFullPath);
      if (existsSync(testDeployFullPath)) unlinkSync(testDeployFullPath);
    }
  });

  await runAsyncTest('Fault Isolation: 1 Worker Failure Does Not Disrupt Other Workers', async () => {
    try {
      const badAuditorHandover = createHandover({
        taskId: 'task-p5-bad-auditor',
        targetAgent: 'auditor',
        action: 'illegal-audit-failure',
        scope: ['non_existent_file_for_failure.txt'],
        context: { simulationDelayMs: 60 },
        constraints: { readOnly: true }
      });

      const deployerHandover = createHandover({
        taskId: 'task-p5-good-deployer',
        targetAgent: 'deployer',
        action: 'parallel-deploy-good',
        scope: [testDeployFile],
        context: {
          writeTarget: testDeployFile,
          simulationDelayMs: 80
        },
        constraints: {
          readOnly: false,
          allowedWritePaths: [testDeployFile]
        }
      });

      const recorderHandover = createHandover({
        taskId: 'task-p5-good-recorder',
        targetAgent: 'recorder',
        action: 'parallel-record-good',
        scope: [testRecordFile],
        context: {
          title: 'Fault Isolation Test Record',
          recordFileName: testRecordFile,
          simulationDelayMs: 70
        },
        constraints: {
          readOnly: false,
          allowedWritePaths: ['.agents/records/']
        }
      });

      const { summaryReport, successfulWorkers, failedWorkers } = await runParallelOrchestrator([
        badAuditorHandover,
        deployerHandover,
        recorderHandover
      ]);

      const auditorRes = successfulWorkers.find(w => w.agent === 'auditor');
      if (!auditorRes || auditorRes.result.status !== 'FAIL') {
        throw new Error('Auditor should have returned FAIL status');
      }

      const deployerRes = successfulWorkers.find(w => w.agent === 'deployer');
      if (!deployerRes || deployerRes.result.status !== 'PASS') {
        throw new Error('Deployer result was disrupted by Auditor failure');
      }

      const recorderRes = successfulWorkers.find(w => w.agent === 'recorder');
      if (!recorderRes || recorderRes.result.status !== 'PASS') {
        throw new Error('Recorder result was disrupted by Auditor failure');
      }

      if (summaryReport.overallStatus === 'ALL_PASS') {
        throw new Error('overallStatus should reflect failure in partial run');
      }
    } finally {
      if (existsSync(testRecordFullPath)) unlinkSync(testRecordFullPath);
      if (existsSync(testDeployFullPath)) unlinkSync(testDeployFullPath);
    }
  });

  await runAsyncTest('Clean Working Tree Verification After Parallel Execution', async () => {
    const snapBefore = captureSnapshot();

    const auditorHandover = createHandover({
      taskId: 'task-p5-clean-auditor',
      targetAgent: 'auditor',
      action: 'clean-audit',
      scope: ['scripts/orchestrator/lib/handover_schema.mjs'],
      constraints: { readOnly: true }
    });

    const deployerHandover = createHandover({
      taskId: 'task-p5-clean-deployer',
      targetAgent: 'deployer',
      action: 'clean-deployer-preflight',
      scope: ['scripts/orchestrator/lib/handover_schema.mjs'],
      constraints: { readOnly: false, allowedWritePaths: [] }
    });

    const { summaryReport } = await runParallelOrchestrator([
      auditorHandover,
      deployerHandover
    ]);

    if (summaryReport.overallStatus !== 'ALL_PASS') {
      throw new Error('Clean run failed');
    }

    const snapAfter = captureSnapshot();
    const diff = detectDiff(snapBefore, snapAfter);

    if (diff.hasDiff) {
      throw new Error(`Tree was modified during parallel preflight:\n${diff.diffSummary}`);
    }
  });

  console.log(`Phase 5 Test Summary: Total: ${totalTests}, Passed: ${passedTests}, Failed: ${failedTests}`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

main();
