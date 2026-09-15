export const ALLOWED_AGENTS = ['auditor', 'deployer', 'recorder', 'test'];
export const ALLOWED_STATUSES = ['PASS', 'FAIL', 'REJECT'];

function isValidIsoDate(str) {
  if (typeof str !== 'string') return false;
  const d = new Date(str);
  return !isNaN(d.getTime()) && str.includes('T');
}

export function validateHandover(handover) {
  const errors = [];

  if (!handover || typeof handover !== 'object') {
    return { valid: false, errors: ['Handover must be a non-null object'] };
  }

  if (typeof handover.taskId !== 'string' || handover.taskId.trim().length === 0) {
    errors.push('taskId is required and must be a non-empty string');
  }

  if (!isValidIsoDate(handover.timestamp)) {
    errors.push('timestamp is required and must be a valid ISO 8601 string');
  }

  if (!ALLOWED_AGENTS.includes(handover.targetAgent)) {
    errors.push(`targetAgent must be one of: ${ALLOWED_AGENTS.join(', ')} (got: ${handover.targetAgent})`);
  }

  if (typeof handover.action !== 'string' || handover.action.trim().length === 0) {
    errors.push('action is required and must be a non-empty string');
  }

  if (!Array.isArray(handover.scope)) {
    errors.push('scope is required and must be an array of file path strings');
  } else {
    for (let i = 0; i < handover.scope.length; i++) {
      if (typeof handover.scope[i] !== 'string') {
        errors.push(`scope[${i}] must be a string`);
      }
    }
  }

  if (!handover.context || typeof handover.context !== 'object' || Array.isArray(handover.context)) {
    errors.push('context is required and must be an object');
  }

  if (!handover.constraints || typeof handover.constraints !== 'object' || Array.isArray(handover.constraints)) {
    errors.push('constraints is required and must be an object');
  } else {
    if (typeof handover.constraints.readOnly !== 'boolean') {
      errors.push('constraints.readOnly is required and must be a boolean');
    }

    if (handover.targetAgent === 'auditor' && handover.constraints.readOnly !== true) {
      errors.push('constraints.readOnly must be true when targetAgent is "auditor"');
    }

    if (handover.constraints.maxDurationMs !== undefined) {
      if (!Number.isInteger(handover.constraints.maxDurationMs) || handover.constraints.maxDurationMs <= 0) {
        errors.push('constraints.maxDurationMs must be a positive integer');
      }
    }

    if (handover.constraints.allowedWritePaths !== undefined) {
      if (!Array.isArray(handover.constraints.allowedWritePaths)) {
        errors.push('constraints.allowedWritePaths must be an array of strings');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function assertHandover(handover) {
  const { valid, errors } = validateHandover(handover);
  if (!valid) {
    const err = new Error(`Handover Schema Validation Failed:\n- ${errors.join('\n- ')}`);
    err.validationErrors = errors;
    throw err;
  }
}

export function validateResult(result, expectedTaskId = null) {
  const errors = [];

  if (!result || typeof result !== 'object') {
    return { valid: false, errors: ['Result must be a non-null object'] };
  }

  if (typeof result.taskId !== 'string' || result.taskId.trim().length === 0) {
    errors.push('taskId is required and must be a non-empty string');
  } else if (expectedTaskId && result.taskId !== expectedTaskId) {
    errors.push(`taskId mismatch: expected "${expectedTaskId}", got "${result.taskId}"`);
  }

  if (!isValidIsoDate(result.timestamp)) {
    errors.push('timestamp is required and must be a valid ISO 8601 string');
  }

  if (!ALLOWED_AGENTS.includes(result.agent)) {
    errors.push(`agent must be one of: ${ALLOWED_AGENTS.join(', ')} (got: ${result.agent})`);
  }

  if (!ALLOWED_STATUSES.includes(result.status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')} (got: ${result.status})`);
  }

  if (typeof result.summary !== 'string' || result.summary.trim().length === 0) {
    errors.push('summary is required and must be a non-empty string');
  }

  if (!result.details || typeof result.details !== 'object' || Array.isArray(result.details)) {
    errors.push('details is required and must be an object');
  }

  if (!Array.isArray(result.issues)) {
    errors.push('issues is required and must be an array');
  }

  if (!Array.isArray(result.evidence)) {
    errors.push('evidence is required and must be an array');
  }

  if (!Array.isArray(result.changedFiles)) {
    errors.push('changedFiles is required and must be an array of file path strings');
  } else {
    if (result.agent === 'auditor' && result.status === 'PASS' && result.changedFiles.length > 0) {
      errors.push(`Auditor PASS result must have empty changedFiles, but found ${result.changedFiles.length} files`);
    }
  }

  if (result.durationMs !== undefined && (typeof result.durationMs !== 'number' || result.durationMs < 0)) {
    errors.push('durationMs must be a non-negative number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function assertResult(result, expectedTaskId = null) {
  const { valid, errors } = validateResult(result, expectedTaskId);
  if (!valid) {
    const err = new Error(`Result Schema Validation Failed:\n- ${errors.join('\n- ')}`);
    err.validationErrors = errors;
    throw err;
  }
}

export function createHandover({
  taskId,
  targetAgent,
  action,
  scope = [],
  context = {},
  constraints = {}
}) {
  const isAuditor = targetAgent === 'auditor';
  const handover = {
    taskId: taskId || `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    targetAgent,
    action,
    scope,
    context,
    constraints: {
      readOnly: isAuditor ? true : Boolean(constraints.readOnly),
      maxDurationMs: constraints.maxDurationMs || 30000,
      allowedWritePaths: constraints.allowedWritePaths || [],
      ...constraints,
      ...(isAuditor ? { readOnly: true } : {})
    }
  };

  assertHandover(handover);
  return handover;
}

export function createResult({
  taskId,
  agent,
  status,
  summary,
  details = {},
  issues = [],
  evidence = [],
  changedFiles = [],
  durationMs = 0
}) {
  const result = {
    taskId,
    timestamp: new Date().toISOString(),
    agent,
    status,
    summary,
    details,
    issues,
    evidence,
    changedFiles,
    durationMs
  };

  assertResult(result, taskId);
  return result;
}
