import { mkdir, mkdtemp, rm, cp, readFile, writeFile, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TestWorkspace {
  cwd: string;
  cleanup: () => Promise<void>;
  workflowPath: (name: string) => string;
  statePath: () => string;
  sessionPath: () => string;
}

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Creates isolated temp directory with fixtures and .claude structure.
 */
export async function createTestWorkspace(): Promise<TestWorkspace> {
  const tempDir = await mkdtemp(join(tmpdir(), 'tsv-test-'));

  // Create .claude/turboshovel structure
  await mkdir(join(tempDir, '.claude', 'turboshovel', 'workflows'), { recursive: true });

  // Copy fixtures to temp dir
  const fixturesDir = join(__dirname, '..', 'fixtures');
  await cp(fixturesDir, join(tempDir, 'workflows'), { recursive: true });

  return {
    cwd: tempDir,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
    workflowPath: (name: string) => join(tempDir, 'workflows', name),
    statePath: () => join(tempDir, '.claude', 'turboshovel', 'workflows'),
    sessionPath: () => join(tempDir, '.claude', 'turboshovel', 'session.json'),
  };
}

/**
 * Run CLI via subprocess in isolated workspace.
 */
export function runCli(args: string, workspace: TestWorkspace): CliResult {
  const cliPath = join(__dirname, '..', '..', 'dist', 'cli.js');

  const result = spawnSync('node', [cliPath, ...args.split(' ').filter(Boolean)], {
    cwd: workspace.cwd,
    encoding: 'utf-8',
    env: {
      ...process.env,
      NO_COLOR: '1',
      TURBOSHOVEL_LOG: '0', // Disable logging during tests
    },
  });

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status ?? 1,
  };
}

/**
 * Read session.json for active/stashed workflow verification.
 */
export async function readSession(workspace: TestWorkspace): Promise<{
  active: string | null;
  stashed: string | null;
}> {
  try {
    const content = await readFile(workspace.sessionPath(), 'utf-8');
    const session = JSON.parse(content) as Record<string, unknown>;
    return {
      active: typeof session.active_workflow === 'string' ? session.active_workflow : null,
      stashed: typeof session.stashedWorkflowId === 'string' ? session.stashedWorkflowId : null
    };
  } catch {
    return { active: null, stashed: null };
  }
}

/**
 * List all workflow state files.
 */
export async function listWorkflowStates(workspace: TestWorkspace): Promise<string[]> {
  try {
    const files = await readdir(workspace.statePath());
    return files.filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
}

/**
 * Read a specific workflow state by ID.
 */
export async function readWorkflowState(
  workspace: TestWorkspace,
  id: string
): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(join(workspace.statePath(), `${id}.json`), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get the active workflow state.
 */
export async function getActiveState(
  workspace: TestWorkspace
): Promise<Record<string, unknown> | null> {
  const session = await readSession(workspace);
  if (!session.active) return null;
  return readWorkflowState(workspace, session.active);
}

/**
 * Write a turboshovel config file.
 */
export async function writeConfig(
  workspace: TestWorkspace,
  config: Record<string, unknown>
): Promise<void> {
  const configPath = join(workspace.cwd, '.claude', 'turboshovel.json');
  await writeFile(configPath, JSON.stringify(config, null, 2));
}
