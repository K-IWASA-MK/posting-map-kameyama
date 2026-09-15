import { writeFileSync, existsSync } from 'node:fs';
import { resolve, normalize } from 'node:path';
import {
  validateHandover,
  createResult
} from '../lib/handover_schema.mjs';

function readStdin() {
  return new Promise((resolvePromise, rejectPromise) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolvePromise(data);
    });
    process.stdin.on('error', err => {
      rejectPromise(err);
    });
  });
}

async function getHandoverData() {
  const arg = process.argv.slice(2).find(a => a.startsWith('--handover='));
  if (arg) {
    const raw = arg.slice('--handover='.length);
    return JSON.parse(raw);
  }
  const stdinData = await readStdin();
  if (stdinData.trim().length > 0) {
    return JSON.parse(stdinData.trim());
  }
  throw new Error('No Handover Package provided to Deployer Worker');
}

const FORBIDDEN_PROTECTED_TARGETS = [
  'active/',
  'data/',
  'deployment.json',
  'AGENTS.md',
  '.agents/rules/',
  '.agents/skills/',
  '.agents/workflows/',
  '.agents/agents/',
  '.agents/current-scope.json'
];

function validateWriteTarget(targetPath, allowedWritePaths = []) {
  const normalized = normalize(targetPath).replace(/\\/g, '/');

  for (const forbidden of FORBIDDEN_PROTECTED_TARGETS) {
    if (normalized === forbidden || normalized.startsWith(forbidden)) {
      throw new Error(`Deployer Boundary Violation: Target "${targetPath}" matches protected destination "${forbidden}"`);
    }
  }

  const isAllowed = allowedWritePaths.some(allowed => {
    const normAllowed = normalize(allowed).replace(/\\/g, '/');
    if (normAllowed.endsWith('/')) {
      return normalized.startsWith(normAllowed);
    }
    return normalized === normAllowed;
  });

  if (!isAllowed) {
    throw new Error(`Deployer Permission Denied: Target "${targetPath}" is not within allowedWritePaths: [${allowedWritePaths.join(', ')}]`);
  }

  return normalized;
}

async function deployTask(handover, workerStartTime) {
  const cwd = process.cwd();
  const context = handover.context || {};
  const simulationDelayMs = typeof context.simulationDelayMs === 'number' ? context.simulationDelayMs : 80;

  if (simulationDelayMs > 0) {
    await new Promise(res => setTimeout(res, simulationDelayMs));
  }

  const writeTarget = context.writeTarget;
  const allowedWritePaths = handover.constraints.allowedWritePaths || [];

  const changedFiles = [];
  const evidence = [];

  if (writeTarget) {
    const validatedPath = validateWriteTarget(writeTarget, allowedWritePaths);
    const fullPath = resolve(cwd, validatedPath);
    const content = context.writeContent || JSON.stringify({
      deploySimulation: true,
      timestamp: new Date().toISOString(),
      action: handover.action,
      workerPid: process.pid
    }, null, 2);

    writeFileSync(fullPath, content, 'utf8');
    changedFiles.push(validatedPath);
    evidence.push(`Deployer successfully executed allowed write: ${validatedPath} (${Buffer.byteLength(content, 'utf8')} bytes)`);
  } else {
    evidence.push('Deployer completed pre-flight verification with zero write operations.');
  }

  evidence.push('Scope guard assertion passed: zero mutations to active/, data/, or deployment.json.');
  evidence.push('Execution completed autonomously via independent Worker process.');

  const workerEndTime = Date.now();
  const durationMs = workerEndTime - workerStartTime;

  const result = createResult({
    taskId: handover.taskId,
    agent: 'deployer',
    status: 'PASS',
    summary: `Deployer execution succeeded for action: ${handover.action}`,
    details: {
      action: handover.action,
      workerPid: process.pid,
      parentPid: process.ppid,
      workerStartTime: new Date(workerStartTime).toISOString(),
      workerEndTime: new Date(workerEndTime).toISOString(),
      simulationDelayMs
    },
    issues: [],
    evidence,
    changedFiles,
    durationMs
  });

  return result;
}

async function main() {
  const workerStartTime = Date.now();
  try {
    const handover = await getHandoverData();
    const { valid, errors } = validateHandover(handover);
    if (!valid) {
      console.error(JSON.stringify({ error: 'Invalid Handover', details: errors }));
      process.exit(1);
    }
    if (handover.targetAgent !== 'deployer') {
      console.error(JSON.stringify({ error: `Deployer Worker received non-deployer targetAgent: ${handover.targetAgent}` }));
      process.exit(1);
    }
    if (handover.constraints.readOnly === true && handover.context && handover.context.writeTarget) {
      console.error(JSON.stringify({ error: 'Deployer Worker cannot perform writes when readOnly is true' }));
      process.exit(1);
    }

    const result = await deployTask(handover, workerStartTime);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({
      error: err.message,
      workerPid: process.pid,
      stack: err.stack
    }));
    process.exit(1);
  }
}

main();
