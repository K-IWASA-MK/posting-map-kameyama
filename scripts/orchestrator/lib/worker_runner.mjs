import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import {
  assertHandover,
  assertResult
} from './handover_schema.mjs';
import {
  captureSnapshot,
  detectDiff,
  assertDiffConstraints
} from './git_diff_guard.mjs';

export function spawnWorker(workerRelativePath, handover, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    assertHandover(handover);

    const cwd = options.cwd || process.cwd();
    const workerFullPath = resolve(cwd, workerRelativePath);
    const timeoutMs = options.timeoutMs || handover.constraints.maxDurationMs || 30000;
    const shouldCheckDiff = options.checkDiff !== false;

    const parentPid = process.pid;
    const beforeSnapshot = captureSnapshot({ cwd });
    const startTimeMs = Date.now();
    const startTimeIso = new Date(startTimeMs).toISOString();

    const child = spawn(process.execPath, [workerFullPath], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, POSTING_MAP_WORKER: '1' }
    });

    const workerPid = child.pid;
    let stdoutBuffer = '';
    let stderrBuffer = '';

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      rejectPromise(new Error(`Worker process timed out after ${timeoutMs}ms (PID: ${workerPid})`));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdoutBuffer += chunk;
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      stderrBuffer += chunk;
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);

      const endTimeMs = Date.now();
      const endTimeIso = new Date(endTimeMs).toISOString();
      const durationMs = endTimeMs - startTimeMs;

      const afterSnapshot = captureSnapshot({ cwd });
      const diffResult = detectDiff(beforeSnapshot, afterSnapshot);

      if (shouldCheckDiff) {
        try {
          assertDiffConstraints(diffResult, handover.constraints);
        } catch (diffErr) {
          return rejectPromise(diffErr);
        }
      }

      if (code !== 0) {
        const errorMsg = `Worker process exited with non-zero code ${code} (signal: ${signal}): ${stderrBuffer || stdoutBuffer}`;
        const err = new Error(errorMsg);
        err.code = code;
        err.workerPid = workerPid;
        err.stderr = stderrBuffer;
        err.stdout = stdoutBuffer;
        return rejectPromise(err);
      }

      let parsedResult;
      try {
        parsedResult = JSON.parse(stdoutBuffer.trim());
      } catch (jsonErr) {
        return rejectPromise(new Error(`Failed to parse Worker output as JSON: ${jsonErr.message}\nRaw stdout: ${stdoutBuffer}`));
      }

      try {
        assertResult(parsedResult, handover.taskId);
      } catch (schemaErr) {
        return rejectPromise(schemaErr);
      }

      resolvePromise({
        success: true,
        parentPid,
        workerPid,
        startTime: startTimeIso,
        endTime: endTimeIso,
        durationMs,
        result: parsedResult,
        beforeSnapshot,
        afterSnapshot,
        diffResult,
        exitCode: code
      });
    });

    child.stdin.write(JSON.stringify(handover));
    child.stdin.end();
  });
}
