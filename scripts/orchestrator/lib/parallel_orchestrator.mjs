import { spawnWorker } from './worker_runner.mjs';
import {
  captureSnapshot,
  detectDiff,
  assertDiffConstraints,
  DiffGuardViolationError
} from './git_diff_guard.mjs';

const WORKER_SCRIPT_MAP = {
  auditor: 'scripts/orchestrator/workers/auditor_worker.mjs',
  deployer: 'scripts/orchestrator/workers/deployer_worker.mjs',
  recorder: 'scripts/orchestrator/workers/recorder_worker.mjs'
};

export function checkIntervalOverlap(workerA, workerB) {
  const startA = new Date(workerA.startTime).getTime();
  const endA = new Date(workerA.endTime).getTime();
  const startB = new Date(workerB.startTime).getTime();
  const endB = new Date(workerB.endTime).getTime();

  const overlapMs = Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
  const overlaps = startA < endB && startB < endA;

  return {
    overlaps,
    overlapMs,
    pair: `${workerA.agent || workerA.result?.agent} <-> ${workerB.agent || workerB.result?.agent}`
  };
}

export async function runParallelOrchestrator(handovers, options = {}) {
  const orchestratorStartTime = new Date().toISOString();
  const orchestratorStartMs = Date.now();
  const cwd = options.cwd || process.cwd();

  const globalBeforeSnapshot = captureSnapshot({ cwd });

  const promises = handovers.map(handover => {
    const scriptPath = WORKER_SCRIPT_MAP[handover.targetAgent];
    if (!scriptPath) {
      return Promise.reject(new Error(`Unknown target agent: ${handover.targetAgent}`));
    }
    return spawnWorker(scriptPath, handover, { cwd, checkDiff: false })
      .then(res => ({
        targetAgent: handover.targetAgent,
        taskId: handover.taskId,
        status: 'FULFILLED',
        data: res
      }))
      .catch(err => ({
        targetAgent: handover.targetAgent,
        taskId: handover.taskId,
        status: 'REJECTED',
        error: err.message,
        details: err
      }));
  });

  const settledResults = await Promise.all(promises);
  const orchestratorEndMs = Date.now();
  const orchestratorEndTime = new Date(orchestratorEndMs).toISOString();
  const totalDurationMs = orchestratorEndMs - orchestratorStartMs;

  const globalAfterSnapshot = captureSnapshot({ cwd });
  const globalDiff = detectDiff(globalBeforeSnapshot, globalAfterSnapshot);

  const successfulWorkers = [];
  const failedWorkers = [];

  for (const item of settledResults) {
    if (item.status === 'FULFILLED') {
      successfulWorkers.push({
        agent: item.targetAgent,
        taskId: item.taskId,
        workerPid: item.data.workerPid,
        parentPid: item.data.parentPid,
        startTime: item.data.startTime,
        endTime: item.data.endTime,
        durationMs: item.data.durationMs,
        result: item.data.result,
        diffResult: item.data.diffResult
      });
    } else {
      failedWorkers.push({
        agent: item.targetAgent,
        taskId: item.taskId,
        error: item.error,
        details: item.details
      });
    }
  }

  const allDeclaredChangedFiles = [];
  for (const w of successfulWorkers) {
    const declared = w.result?.changedFiles || [];
    allDeclaredChangedFiles.push(...declared);

    if (w.agent === 'auditor' && declared.length > 0) {
      throw new DiffGuardViolationError(`Auditor Worker violated READ ONLY contract by declaring changedFiles: [${declared.join(', ')}]`);
    }
    if (w.agent === 'recorder') {
      for (const f of declared) {
        if (!f.startsWith('.agents/records/')) {
          throw new DiffGuardViolationError(`Recorder Worker declared changedFile outside .agents/records/: ${f}`);
        }
      }
    }
  }

  assertDiffConstraints(globalDiff, {
    forbiddenPaths: ['active/', 'data/', 'deployment.json', 'AGENTS.md'],
    allowedWritePaths: Array.from(new Set(allDeclaredChangedFiles))
  });

  const overlapAnalysis = [];
  let allPairsOverlap = true;

  if (successfulWorkers.length >= 2) {
    for (let i = 0; i < successfulWorkers.length; i++) {
      for (let j = i + 1; j < successfulWorkers.length; j++) {
        const analysis = checkIntervalOverlap(successfulWorkers[i], successfulWorkers[j]);
        overlapAnalysis.push(analysis);
        if (!analysis.overlaps) {
          allPairsOverlap = false;
        }
      }
    }
  } else {
    allPairsOverlap = false;
  }

  const allPassed = failedWorkers.length === 0 && successfulWorkers.every(w => w.result?.status === 'PASS');
  const overallStatus = allPassed ? 'ALL_PASS' : (successfulWorkers.length > 0 ? 'PARTIAL_FAIL' : 'ALL_FAIL');

  const summaryReport = {
    orchestratorStartTime,
    orchestratorEndTime,
    totalDurationMs,
    overallStatus,
    workerCount: handovers.length,
    successCount: successfulWorkers.length,
    failCount: failedWorkers.length,
    isTrueParallel: allPairsOverlap && successfulWorkers.length >= 2,
    overlapAnalysis,
    globalDiff,
    workers: settledResults.map(s => {
      if (s.status === 'FULFILLED') {
        return {
          agent: s.targetAgent,
          taskId: s.taskId,
          status: s.data.result?.status,
          workerPid: s.data.workerPid,
          parentPid: s.data.parentPid,
          startTime: s.data.startTime,
          endTime: s.data.endTime,
          durationMs: s.data.durationMs,
          changedFiles: s.data.result?.changedFiles || [],
          issues: s.data.result?.issues || [],
          evidence: s.data.result?.evidence || []
        };
      }
      return {
        agent: s.targetAgent,
        taskId: s.taskId,
        status: 'REJECTED',
        error: s.error
      };
    })
  };

  return {
    summaryReport,
    successfulWorkers,
    failedWorkers,
    settledResults,
    globalDiff
  };
}
