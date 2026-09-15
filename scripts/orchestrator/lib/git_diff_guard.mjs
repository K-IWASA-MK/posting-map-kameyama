import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export class DiffGuardViolationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'DiffGuardViolationError';
    this.details = details;
  }
}

export function captureSnapshot(options = {}) {
  const cwd = options.cwd || process.cwd();

  let head = '';
  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  } catch (err) {
    head = 'UNKNOWN_HEAD';
  }

  const rawStatus = execFileSync('git', ['status', '--porcelain', '-uall'], { cwd, encoding: 'utf8' });
  const statusMap = new Map();

  const lines = rawStatus.split('\n').filter(line => line.trim().length > 0);
  for (const line of lines) {
    const code = line.substring(0, 2);
    const filePath = line.substring(3).trim();
    statusMap.set(filePath, code);
  }

  return {
    head,
    rawStatus,
    statusMap,
    timestamp: new Date().toISOString()
  };
}

export function detectDiff(beforeSnapshot, afterSnapshot) {
  const beforeMap = beforeSnapshot.statusMap || new Map();
  const afterMap = afterSnapshot.statusMap || new Map();

  const added = [];
  const modified = [];
  const deleted = [];

  for (const [file, code] of afterMap.entries()) {
    if (!beforeMap.has(file)) {
      if (code === '??' || code.includes('A')) {
        added.push(file);
      } else if (code.includes('D')) {
        deleted.push(file);
      } else {
        modified.push(file);
      }
    } else if (beforeMap.get(file) !== code) {
      if (code.includes('D')) {
        deleted.push(file);
      } else {
        modified.push(file);
      }
    }
  }

  for (const [file] of beforeMap.entries()) {
    if (!afterMap.has(file)) {
      deleted.push(file);
    }
  }

  const allChanged = Array.from(new Set([...added, ...modified, ...deleted]));
  const hasDiff = allChanged.length > 0;

  const summaryLines = [
    `Diff detected: ${hasDiff}`,
    `Added (${added.length}): ${added.join(', ') || 'none'}`,
    `Modified (${modified.length}): ${modified.join(', ') || 'none'}`,
    `Deleted (${deleted.length}): ${deleted.join(', ') || 'none'}`
  ];

  return {
    hasDiff,
    added,
    modified,
    deleted,
    allChanged,
    diffSummary: summaryLines.join('\n')
  };
}

export function assertDiffConstraints(diffResult, constraints = {}) {
  if (!diffResult.hasDiff) {
    return { ok: true, violations: [] };
  }

  const violations = [];

  if (constraints.readOnly === true && diffResult.hasDiff) {
    violations.push(`READ ONLY constraint violated: ${diffResult.allChanged.length} file(s) changed: [${diffResult.allChanged.join(', ')}]`);
  }

  const forbiddenPaths = constraints.forbiddenPaths || ['active/', 'data/', 'deployment.json', 'AGENTS.md'];
  for (const file of diffResult.allChanged) {
    for (const forbidden of forbiddenPaths) {
      if (file === forbidden || file.startsWith(forbidden)) {
        violations.push(`Forbidden path violation: "${file}" matches protected target "${forbidden}"`);
      }
    }
  }

  if (Array.isArray(constraints.allowedWritePaths) && constraints.allowedWritePaths.length > 0) {
    for (const file of diffResult.allChanged) {
      const isAllowed = constraints.allowedWritePaths.some(allowed => {
        if (allowed.endsWith('/')) {
          return file.startsWith(allowed);
        }
        return file === allowed;
      });

      if (!isAllowed) {
        violations.push(`Unallowed write path violation: "${file}" is not in allowedWritePaths [${constraints.allowedWritePaths.join(', ')}]`);
      }
    }
  }

  if (violations.length > 0) {
    throw new DiffGuardViolationError(
      `Physical Diff Guard Blocked Execution:\n- ${violations.join('\n- ')}`,
      { diffResult, constraints, violations }
    );
  }

  return { ok: true, violations: [] };
}

export function rollback(beforeSnapshot, options = {}) {
  const cwd = options.cwd || process.cwd();
  const currentSnapshot = captureSnapshot({ cwd });
  const diff = detectDiff(beforeSnapshot, currentSnapshot);

  if (!diff.hasDiff) {
    return { success: true, restoredFiles: [], postSnapshot: currentSnapshot };
  }

  const restoredFiles = [];

  for (const addedFile of diff.added) {
    const fullPath = resolve(cwd, addedFile);
    if (existsSync(fullPath)) {
      try {
        const s = statSync(fullPath);
        if (s.isDirectory()) {
          rmSync(fullPath, { recursive: true, force: true });
        } else {
          unlinkSync(fullPath);
        }
        restoredFiles.push(`deleted untracked: ${addedFile}`);
      } catch (err) {
        throw new Error(`Rollback failed to delete untracked file ${addedFile}: ${err.message}`);
      }
    }
  }

  const trackedToRestore = [...diff.modified, ...diff.deleted];
  for (const file of trackedToRestore) {
    try {
      execFileSync('git', ['restore', file], { cwd, encoding: 'utf8' });
      restoredFiles.push(`git restore: ${file}`);
    } catch (err) {
      try {
        execFileSync('git', ['checkout', '--', file], { cwd, encoding: 'utf8' });
        restoredFiles.push(`git checkout: ${file}`);
      } catch (err2) {
        throw new Error(`Rollback failed to restore tracked file ${file}: ${err2.message}`);
      }
    }
  }

  const postSnapshot = captureSnapshot({ cwd });
  const postDiff = detectDiff(beforeSnapshot, postSnapshot);

  if (postDiff.hasDiff) {
    throw new Error(`Rollback Verification Failed: working tree still has differences:\n${postDiff.diffSummary}`);
  }

  return {
    success: true,
    restoredFiles,
    postSnapshot
  };
}
