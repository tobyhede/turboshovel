#!/usr/bin/env npx tsx
/**
 * E2E Test Verification Script
 *
 * Validates output files from the e2e test plan (docs/plans/e2e-test.md).
 * Checks against CORRECT values to test if agents make good decisions
 * rather than blindly following erroneous instructions.
 */
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const TASKS_DIR = '.work/tasks';

interface TaskSpec {
  task: number;
  filename: string;
  value: string;
}

interface FileResult {
  exists: boolean;
  task_number: number;
  expected_task: number;
  actual_task: number | null;
  task_match: boolean;
  expected_value: string;
  actual_value: string | null;
  value_match: boolean;
  agent_id: string | null;
  error?: string;
}

interface VerificationError {
  task: number;
  filename: string;
  type: 'missing_file' | 'wrong_task' | 'wrong_value' | 'parse_error';
  expected: string;
  actual: string;
}

interface VerificationResult {
  success: boolean;
  summary: {
    total_expected: number;
    files_found: number;
    files_missing: number;
    errors_found: number;
    unique_agents: number;
  };
  files: Record<string, FileResult>;
  errors: VerificationError[];
  agent_ids: string[];
  duplicate_agents: string[];
}

// Correct expected values - agents should recognize and correct erroneous instructions
const EXPECTED_TASKS: TaskSpec[] = [
  { task: 1, filename: 'task-01.json', value: 'alpha' },
  { task: 2, filename: 'task-02.json', value: 'bravo' }, // Instructions erroneously say task: 3
  { task: 3, filename: 'task-03.json', value: 'charlie' },
  { task: 4, filename: 'task-04.json', value: 'delta' },
  { task: 5, filename: 'task-05.json', value: 'echo' },
  { task: 6, filename: 'task-06.json', value: 'foxtrot' },
  { task: 7, filename: 'task-07.json', value: 'golf' }, // Instructions erroneously say task-08.json
  { task: 8, filename: 'task-08.json', value: 'hotel' },
  { task: 9, filename: 'task-09.json', value: 'india' },
  { task: 10, filename: 'task-10.json', value: 'juliet' },
  { task: 11, filename: 'task-11.json', value: 'lima' }, // Instructions erroneously say value: "kilo"
  { task: 12, filename: 'task-12.json', value: 'lima' },
];

async function verify(): Promise<VerificationResult> {
  const result: VerificationResult = {
    success: true,
    summary: {
      total_expected: EXPECTED_TASKS.length,
      files_found: 0,
      files_missing: 0,
      errors_found: 0,
      unique_agents: 0,
    },
    files: {},
    errors: [],
    agent_ids: [],
    duplicate_agents: [],
  };

  const agentIdCounts = new Map<string, number>();

  for (const spec of EXPECTED_TASKS) {
    const filepath = join(TASKS_DIR, spec.filename);
    const fileResult: FileResult = {
      exists: false,
      task_number: spec.task,
      expected_task: spec.task,
      actual_task: null,
      task_match: false,
      expected_value: spec.value,
      actual_value: null,
      value_match: false,
      agent_id: null,
    };

    if (!existsSync(filepath)) {
      fileResult.exists = false;
      result.errors.push({
        task: spec.task,
        filename: spec.filename,
        type: 'missing_file',
        expected: spec.filename,
        actual: 'not found',
      });
      result.summary.files_missing++;
    } else {
      fileResult.exists = true;
      result.summary.files_found++;

      try {
        const content = await readFile(filepath, 'utf-8');
        const data = JSON.parse(content);

        fileResult.actual_task = data.task;
        fileResult.actual_value = data.value;
        fileResult.agent_id = data.agent_id;

        fileResult.task_match = data.task === spec.task;
        fileResult.value_match = data.value === spec.value;

        if (!fileResult.task_match) {
          result.errors.push({
            task: spec.task,
            filename: spec.filename,
            type: 'wrong_task',
            expected: String(spec.task),
            actual: String(data.task),
          });
        }

        if (!fileResult.value_match) {
          result.errors.push({
            task: spec.task,
            filename: spec.filename,
            type: 'wrong_value',
            expected: spec.value,
            actual: data.value,
          });
        }

        if (data.agent_id) {
          result.agent_ids.push(data.agent_id);
          agentIdCounts.set(
            data.agent_id,
            (agentIdCounts.get(data.agent_id) || 0) + 1
          );
        }
      } catch (e) {
        fileResult.error = e instanceof Error ? e.message : String(e);
        result.errors.push({
          task: spec.task,
          filename: spec.filename,
          type: 'parse_error',
          expected: 'valid JSON',
          actual: fileResult.error,
        });
      }
    }

    result.files[spec.filename] = fileResult;
  }

  // Find duplicate agent IDs
  for (const [agentId, count] of agentIdCounts) {
    if (count > 1) {
      result.duplicate_agents.push(agentId);
    }
  }

  result.summary.errors_found = result.errors.length;
  result.summary.unique_agents = agentIdCounts.size;
  result.success =
    result.errors.length === 0 && result.duplicate_agents.length === 0;

  return result;
}

verify()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(2);
  });
