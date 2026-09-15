import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnWorker } from '../lib/worker_runner.mjs';
import { createHandover } from '../lib/handover_schema.mjs';
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
  console.log('Phase 4 Test Suite: Deployer Worker Minimal Verification');

  const testFixtureRelativePath = 'scripts/orchestrator/tests/.tmp_deploy_fixture.json';
  const testFixtureFullPath = resolve(process.cwd(), testFixtureRelativePath);

  await runAsyncTest('Deployer Worker Independent Process Execution & PID Separation', async () => {
    try {
      const handover = createHandover({
        taskId: 'task-p4-deployer-001',
        targetAgent: 'deployer',
        action: 'deploy-phase4-test',
        scope: [testFixtureRelativePath],
        context: {
          writeTarget: testFixtureRelativePath,
          writeContent: JSON.stringify({ status: 'OK', test: 'deployer-pid-test' }),
          simulationDelayMs: 50
        },
        constraints: {
          readOnly: false,
          allowedWritePaths: [testFixtureRelativePath],
          maxDurationMs: 15000
        }
      });

      const execution = await spawnWorker('scripts/orchestrator/workers/deployer_worker.mjs', handover);

      if (!execution.success) throw new Error('Execution did not succeed');
      if (typeof execution.workerPid !== 'number' || execution.workerPid <= 0) {
        throw new Error(`Invalid workerPid: ${execution.workerPid}`);
      }
      if (execution.workerPid === execution.parentPid) {
        throw new Error(`Worker PID (${execution.workerPid}) is identical to parent PID (${execution.parentPid})! Process isolation violated.`);
      }

      if (!existsSync(testFixtureFullPath)) {
        throw new Error('Target fixture was not written to disk');
      }

      const content = readFileSync(testFixtureFullPath, 'utf8');
      if (!content.includes('deployer-pid-test')) {
        throw new Error('Written content mismatch');
      }

      const res = execution.result;
      if (res.agent !== 'deployer') throw new Error(`Agent mismatch: ${res.agent}`);
      if (res.status !== 'PASS') throw new Error(`Status is not PASS: ${res.status}`);
      if (!res.changedFiles.includes(testFixtureRelativePath)) {
        throw new Error(`changedFiles does not include ${testFixtureRelativePath}`);
      }
    } finally {
      if (existsSync(testFixtureFullPath)) {
        unlinkSync(testFixtureFullPath);
      }
    }
  });

  await runAsyncTest('Millisecond-Precision Timestamp Verification', async () => {
    try {
      const handover = createHandover({
        taskId: 'task-p4-deployer-002',
        targetAgent: 'deployer',
        action: 'deploy-timestamps',
        scope: [testFixtureRelativePath],
        context: {
          writeTarget: testFixtureRelativePath,
          simulationDelayMs: 60
        },
        constraints: {
          readOnly: false,
          allowedWritePaths: [testFixtureRelativePath]
        }
      });

      const execution = await spawnWorker('scripts/orchestrator/workers/deployer_worker.mjs', handover);

      if (typeof execution.startTime !== 'string' || !execution.startTime.includes('T')) {
        throw new Error(`Invalid startTime: ${execution.startTime}`);
      }
      if (typeof execution.endTime !== 'string' || !execution.endTime.includes('T')) {
        throw new Error(`Invalid endTime: ${execution.endTime}`);
      }
      if (typeof execution.durationMs !== 'number' || execution.durationMs < 40) {
        throw new Error(`durationMs (${execution.durationMs}) was less than expected simulation delay`);
      }
    } finally {
      if (existsSync(testFixtureFullPath)) {
        unlinkSync(testFixtureFullPath);
      }
    }
  });

  await runAsyncTest('Scope Guard: Rejection of Unallowed Write Paths', async () => {
    const unallowedPath = 'scripts/orchestrator/tests/.tmp_unallowed_deploy.json';
    const unallowedFullPath = resolve(process.cwd(), unallowedPath);

    const handover = createHandover({
      taskId: 'task-p4-deployer-003',
      targetAgent: 'deployer',
      action: 'deploy-unallowed-attempt',
      scope: [unallowedPath],
      context: {
        writeTarget: unallowedPath
      },
      constraints: {
        readOnly: false,
        allowedWritePaths: ['scripts/orchestrator/allowed_only/']
      }
    });

    let blocked = false;
    try {
      await spawnWorker('scripts/orchestrator/workers/deployer_worker.mjs', handover);
    } catch (err) {
      if (err.message.includes('not within allowedWritePaths') || err.message.includes('Permission Denied')) {
        blocked = true;
      }
    }

    if (!blocked) {
      throw new Error('Deployer Worker failed to block unallowed write path');
    }
    if (existsSync(unallowedFullPath)) {
      unlinkSync(unallowedFullPath);
      throw new Error('Unallowed file was created on disk!');
    }
  });

  await runAsyncTest('Scope Guard: Rejection of Protected Path (active/)', async () => {
    const protectedPath = 'active/dashboard/test_illegal_deploy.js';
    const protectedFullPath = resolve(process.cwd(), protectedPath);

    const handover = createHandover({
      taskId: 'task-p4-deployer-004',
      targetAgent: 'deployer',
      action: 'deploy-active-attempt',
      scope: [protectedPath],
      context: {
        writeTarget: protectedPath
      },
      constraints: {
        readOnly: false,
        allowedWritePaths: [protectedPath]
      }
    });

    let blocked = false;
    try {
      await spawnWorker('scripts/orchestrator/workers/deployer_worker.mjs', handover);
    } catch (err) {
      if (err.message.includes('matches protected destination') || err.message.includes('Boundary Violation')) {
        blocked = true;
      }
    }

    if (!blocked) {
      throw new Error('Deployer Worker failed to block protected destination active/');
    }
    if (existsSync(protectedFullPath)) {
      unlinkSync(protectedFullPath);
      throw new Error('Protected destination file was created on disk!');
    }
  });

  await runAsyncTest('Pre-Flight Simulation with Zero Writes and Clean Tree', async () => {
    const snapBefore = captureSnapshot();

    const handover = createHandover({
      taskId: 'task-p4-deployer-005',
      targetAgent: 'deployer',
      action: 'deploy-preflight-dryrun',
      scope: ['scripts/orchestrator/lib/handover_schema.mjs'],
      context: {
        simulationDelayMs: 30
      },
      constraints: {
        readOnly: false,
        allowedWritePaths: []
      }
    });

    const execution = await spawnWorker('scripts/orchestrator/workers/deployer_worker.mjs', handover);

    if (!execution.success) throw new Error('Preflight dryrun failed');
    if (execution.diffResult.hasDiff !== false) {
      throw new Error(`Dryrun produced unexpected diff:\n${execution.diffResult.diffSummary}`);
    }

    const snapAfter = captureSnapshot();
    const diff = detectDiff(snapBefore, snapAfter);
    if (diff.hasDiff) {
      throw new Error(`Tree was modified during dryrun: ${diff.diffSummary}`);
    }
  });

  console.log(`Phase 4 Test Summary: Total: ${totalTests}, Passed: ${passedTests}, Failed: ${failedTests}`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

main();
