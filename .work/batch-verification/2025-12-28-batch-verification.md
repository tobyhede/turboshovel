# Batch Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add batch verification capability to systematically verify large content (docs, code) that exceeds agent context limits, with progress persistence, cycle tracking, and multi-workflow support.

**Architecture:** CLI (`tsv batch`) generates token-based batches. Workflow orchestrates verification. N-verification runs per batch. Reports are pure markdown (agents read/write directly). Named workflows enable long-running verification across sessions.

**Tech Stack:** TypeScript, Node.js, existing turboshovel workflow system, glob patterns, SHA-256 hashing.

---

## Phase 0: Standard Report Format

Standardize verification report format BEFORE adding batch features. This ensures batch verification reuses the same format.

---

### Task 0.1: Create Report Template

**Files:**
- Create: `plugin/templates/verify-report.md`

**Step 1: Create the template file**

Create `plugin/templates/verify-report.md`:

```markdown
# Verification Report Template

Use this template for ALL verification report output. Pure markdown - no YAML, no structured data.

## Report Structure

```markdown
# Verification Report

**Subject:** `<glob pattern or description>`
**Date:** <YYYY-MM-DD>
**Files:** <count> | **Agents:** <count>

---

## Findings

### COMMON (all agents agree)

#### 1. path/to/file.md:42 - Issue title
Description of the issue.
**Suggestion:** How to fix it.

### VALIDATED (cross-checked)

#### 2. path/to/file.md:88 - Issue title
Description of the issue.
**Evidence:** `path/to/evidence.ts:42`
**Suggestion:** How to fix it.

### UNCERTAIN (needs decision)

#### 3. path/to/file.md:200 - Issue title
Description of the issue.
**Question:** What decision is needed?

---

## Summary

| Tier | Count |
|------|-------|
| COMMON | N |
| VALIDATED | N |
| UNCERTAIN | N |

## Next Steps

Run `tsv revise` to address COMMON and VALIDATED findings.
Review UNCERTAIN findings manually before proceeding.
```

## Key Points

- **No structured data blocks** - pure markdown throughout
- **Agents read markdown directly** - no parsing needed
- **Consistent heading structure** - findings organized by confidence tier
- **File:line format** - `path/to/file.md:42` for easy navigation
```

**Step 2: Verify file created**

Run: `cat plugin/templates/verify-report.md | head -20`
Expected: Shows template header

**Step 3: Commit**

```bash
git add plugin/templates/verify-report.md
git commit -m "feat(verify): add standard report template"
```

---

### Task 0.2: Update Verifying-by-Consensus Skill to Reference Template

**Files:**
- Modify: `plugin/skills/verifying-by-consensus/SKILL.md`

**Step 1: Read current skill file**

Run: `cat plugin/skills/verifying-by-consensus/SKILL.md`

**Step 2: Add template reference to Output Files section**

Find the "Output Files" section and update to reference the new template:

```markdown
## Output Files

All reports follow the standard template: `${CLAUDE_PLUGIN_ROOT}templates/verify-report.md`

Files saved to `.work/` with timestamp-based naming:
- `{date}-verify-{agent-index}-{time}.md` - Individual agent reviews
- `{date}-verify-collated-{time}.md` - Collation report (uses template)
- `{date}-verify-crosscheck-{time}.md` - Cross-check results (updates template)
```

**Step 3: Add format reference to Phase 2 (Collate)**

In the Collate phase, add instruction to use template format:

```markdown
### Phase 2: Collate

After all agents complete, dispatch collation:
- Read all N review files
- Compare findings across agents
- **Output using standard report template** (`verify-report.md`)
- Organize findings by confidence tier (COMMON, VALIDATED, UNCERTAIN)
- Use `file:line` format for navigation
```

**Step 4: Commit**

```bash
git add plugin/skills/verifying-by-consensus/SKILL.md
git commit -m "feat(verify): reference standard report template in skill"
```

---

## Phase 1: CLI Foundation

Build the `tsv batch` subcommand with token counting and batch generation.

---

### Task 1.0: Set Up Jest in packages/shared

**Files:**
- Modify: `packages/shared/package.json`
- Create: `packages/shared/jest.config.js`

**Step 1: Install Jest dependencies**

Run: `cd packages/shared && npm install -D jest @types/jest ts-jest`

**Step 2: Create Jest config**

Create `packages/shared/jest.config.js`:

```javascript
/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: ['**/*.test.ts'],
};
```

**Step 3: Update package.json test script**

Change the test script in `packages/shared/package.json`:

```json
"scripts": {
  "build": "tsc",
  "test": "NODE_OPTIONS='--experimental-vm-modules' jest",
  "clean": "rm -rf dist"
}
```

**Step 4: Verify Jest works**

Run: `cd packages/shared && npm test`
Expected: "No tests found" (not an error)

**Step 5: Commit**

```bash
git add packages/shared/package.json packages/shared/jest.config.js
git commit -m "chore(shared): add Jest test infrastructure"
```

---

### Task 1.1: Create Token Counting Utility

**Files:**
- Create: `packages/shared/src/tokens.ts`
- Create: `packages/shared/src/tokens.test.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/tokens.test.ts`:

```typescript
import { countTokens, countTokensInFile } from './tokens.js';

describe('countTokens', () => {
  it('counts tokens as words * 1.3', () => {
    const text = 'Hello world this is a test';
    // 6 words * 1.3 = 7.8, rounded = 8
    expect(countTokens(text)).toBe(8);
  });

  it('handles empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  it('handles whitespace-only string', () => {
    expect(countTokens('   \n\t  ')).toBe(0);
  });

  it('handles markdown with code blocks', () => {
    const markdown = `
# Heading

Some text here.

\`\`\`typescript
const x = 1;
\`\`\`
`;
    // Count all words including code
    const result = countTokens(markdown);
    expect(result).toBeGreaterThan(0);
  });
});

describe('countTokensInFile', () => {
  it('returns 0 for non-existent file', async () => {
    const result = await countTokensInFile('/nonexistent/path.md');
    expect(result).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && npm test -- tokens`
Expected: FAIL with "Cannot find module './tokens.js'"

**Step 3: Write minimal implementation**

Create `packages/shared/src/tokens.ts`:

```typescript
import * as fs from 'fs/promises';

const TOKEN_MULTIPLIER = 1.3;

/**
 * Count approximate tokens in text.
 * Uses word count * 1.3 as a rough approximation.
 */
export function countTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return Math.round(words.length * TOKEN_MULTIPLIER);
}

/**
 * Count tokens in a file.
 * Returns 0 if file doesn't exist or can't be read.
 */
export async function countTokensInFile(filePath: string): Promise<number> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return countTokens(content);
  } catch {
    return 0;
  }
}

/**
 * Count total tokens across multiple files.
 */
export async function countTokensInFiles(filePaths: string[]): Promise<number> {
  const counts = await Promise.all(filePaths.map(countTokensInFile));
  return counts.reduce((sum, count) => sum + count, 0);
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shared && npm test -- tokens`
Expected: PASS

**Step 5: Add export to index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from './tokens.js';
```

**Step 6: Commit**

```bash
git add packages/shared/src/tokens.ts packages/shared/src/tokens.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add token counting utility"
```

---

### Task 1.2: Create Batch Generation Logic

**Files:**
- Create: `packages/shared/src/batch.ts`
- Create: `packages/shared/src/batch.test.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/batch.test.ts`:

```typescript
import { generateBatches, type BatchConfig, type BatchResult } from './batch.js';

describe('generateBatches', () => {
  it('creates single batch for small file set', async () => {
    const config: BatchConfig = {
      files: [
        { path: 'docs/a.md', tokens: 1000 },
        { path: 'docs/b.md', tokens: 2000 },
      ],
      tokenLimit: 15000,
      groupByDirectory: true,
    };

    const result = await generateBatches(config);

    expect(result.batches).toHaveLength(1);
    expect(result.batches[0].files).toHaveLength(2);
    expect(result.batches[0].tokenCount).toBe(3000);
  });

  it('splits into multiple batches when exceeding limit', async () => {
    const config: BatchConfig = {
      files: [
        { path: 'docs/a.md', tokens: 10000 },
        { path: 'docs/b.md', tokens: 10000 },
        { path: 'docs/c.md', tokens: 10000 },
      ],
      tokenLimit: 15000,
      groupByDirectory: true,
    };

    const result = await generateBatches(config);

    expect(result.batches.length).toBeGreaterThan(1);
    result.batches.forEach(batch => {
      expect(batch.tokenCount).toBeLessThanOrEqual(15000);
    });
  });

  it('groups files by directory', async () => {
    const config: BatchConfig = {
      files: [
        { path: 'docs/api/users.md', tokens: 5000 },
        { path: 'docs/api/auth.md', tokens: 5000 },
        { path: 'docs/guide/intro.md', tokens: 5000 },
      ],
      tokenLimit: 15000,
      groupByDirectory: true,
    };

    const result = await generateBatches(config);

    // With 15k limit, api/* (10k) should be together
    const apiBatch = result.batches.find(b =>
      b.files.some(f => f.includes('api/'))
    );
    expect(apiBatch?.files.filter(f => f.includes('api/'))).toHaveLength(2);
  });

  it('generates content hash', async () => {
    const config: BatchConfig = {
      files: [{ path: 'docs/a.md', tokens: 1000 }],
      tokenLimit: 15000,
      groupByDirectory: true,
    };

    const result = await generateBatches(config);

    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && npm test -- batch`
Expected: FAIL with "Cannot find module './batch.js'"

**Step 3: Write implementation**

Create `packages/shared/src/batch.ts`:

```typescript
import * as crypto from 'crypto';
import * as path from 'path';

export interface FileWithTokens {
  path: string;
  tokens: number;
}

export interface BatchConfig {
  files: FileWithTokens[];
  tokenLimit: number;
  groupByDirectory: boolean;
}

export interface Batch {
  id: number;
  name: string;
  files: string[];
  tokenCount: number;
}

export interface BatchResult {
  generatedAt: string;
  tokenLimit: number;
  contentHash: string;
  batches: Batch[];
  totalFiles: number;
  totalTokens: number;
}

/**
 * Group files by their parent directory.
 */
function groupByDirectory(files: FileWithTokens[]): Map<string, FileWithTokens[]> {
  const groups = new Map<string, FileWithTokens[]>();

  for (const file of files) {
    const dir = path.dirname(file.path);
    const existing = groups.get(dir) || [];
    existing.push(file);
    groups.set(dir, existing);
  }

  return groups;
}

/**
 * Generate content hash from file paths.
 */
function generateContentHash(files: FileWithTokens[]): string {
  const paths = files.map(f => f.path).sort().join('\n');
  return crypto.createHash('sha256').update(paths).digest('hex');
}

/**
 * Generate batches from files, respecting token limit.
 * Uses greedy bin-packing, grouping by directory when possible.
 */
export async function generateBatches(config: BatchConfig): Promise<BatchResult> {
  const { files, tokenLimit, groupByDirectory: shouldGroup } = config;

  const batches: Batch[] = [];
  let currentBatch: { files: FileWithTokens[]; tokens: number } = { files: [], tokens: 0 };
  let batchId = 1;

  // Group files by directory if requested
  const groups = shouldGroup ? groupByDirectory(files) : new Map([['all', files]]);

  // Sort groups by directory name for consistent ordering
  const sortedDirs = [...groups.keys()].sort();

  for (const dir of sortedDirs) {
    const dirFiles = groups.get(dir) || [];

    for (const file of dirFiles) {
      // If adding this file would exceed limit, start new batch
      if (currentBatch.tokens + file.tokens > tokenLimit && currentBatch.files.length > 0) {
        batches.push({
          id: batchId++,
          name: path.dirname(currentBatch.files[0].path),
          files: currentBatch.files.map(f => f.path),
          tokenCount: currentBatch.tokens,
        });
        currentBatch = { files: [], tokens: 0 };
      }

      currentBatch.files.push(file);
      currentBatch.tokens += file.tokens;
    }
  }

  // Don't forget the last batch
  if (currentBatch.files.length > 0) {
    batches.push({
      id: batchId,
      name: path.dirname(currentBatch.files[0].path),
      files: currentBatch.files.map(f => f.path),
      tokenCount: currentBatch.tokens,
    });
  }

  const totalTokens = files.reduce((sum, f) => sum + f.tokens, 0);

  return {
    generatedAt: new Date().toISOString(),
    tokenLimit,
    contentHash: generateContentHash(files),
    batches,
    totalFiles: files.length,
    totalTokens,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shared && npm test -- batch`
Expected: PASS

**Step 5: Add export to index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from './batch.js';
```

**Step 6: Commit**

```bash
git add packages/shared/src/batch.ts packages/shared/src/batch.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add batch generation logic"
```

---

### Task 1.3: Create Batch CLI Command

**Files:**
- Create: `packages/cli/src/commands/batch.ts`
- Modify: `packages/cli/src/cli.ts`

**Step 1: Read current CLI structure**

Run: `cat packages/cli/src/cli.ts | head -100`

Understand how commands are routed.

**Step 2: Create the batch command handler**

Create `packages/cli/src/commands/batch.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { countTokensInFile, generateBatches, type FileWithTokens, type BatchResult } from '@turboshovel/shared';

const BATCHES_DIR = '.claude/turboshovel/batches';
const DEFAULT_TOKEN_LIMIT = 15000;

interface BatchCommandOptions {
  generate?: boolean;
  status?: boolean;
  tokens?: string;
  pattern?: string;
}

/**
 * Get batch state file path for a pattern.
 */
function getBatchFilePath(cwd: string, pattern: string): string {
  // Create a safe filename from the pattern
  const safeName = pattern.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
  return path.join(cwd, BATCHES_DIR, `${safeName}.json`);
}

/**
 * Generate batches from a glob pattern.
 */
async function generateBatchesFromGlob(
  cwd: string,
  pattern: string
): Promise<BatchResult> {
  // Expand glob pattern
  const files = await glob(pattern, { cwd, nodir: true });

  if (files.length === 0) {
    throw new Error(`No files found matching pattern: ${pattern}`);
  }

  // Count tokens in each file
  const filesWithTokens: FileWithTokens[] = await Promise.all(
    files.map(async (file) => ({
      path: file,
      tokens: await countTokensInFile(path.join(cwd, file)),
    }))
  );

  // Generate batches
  const result = await generateBatches({
    files: filesWithTokens,
    tokenLimit: DEFAULT_TOKEN_LIMIT,
    groupByDirectory: true,
  });

  return result;
}

/**
 * Save batch result to file.
 */
async function saveBatchResult(
  cwd: string,
  pattern: string,
  result: BatchResult
): Promise<string> {
  const filePath = getBatchFilePath(cwd, pattern);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify({ pattern, ...result }, null, 2));
  return filePath;
}

/**
 * Load batch result from file.
 */
async function loadBatchResult(
  cwd: string,
  pattern: string
): Promise<(BatchResult & { pattern: string }) | null> {
  try {
    const filePath = getBatchFilePath(cwd, pattern);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Display batch status.
 */
function displayStatus(result: BatchResult & { pattern: string }): void {
  console.log(`\nBatch Status: ${result.pattern}`);
  console.log(`Generated: ${result.generatedAt}`);
  console.log(`Files: ${result.totalFiles} | Tokens: ~${result.totalTokens.toLocaleString()}`);
  console.log(`Batches: ${result.batches.length}\n`);

  for (const batch of result.batches) {
    console.log(`  Batch ${batch.id}: ${batch.name}`);
    console.log(`    Files: ${batch.files.length} | Tokens: ~${batch.tokenCount.toLocaleString()}`);
  }
}

/**
 * Main batch command handler.
 */
export async function batchCommand(
  args: string[],
  options: BatchCommandOptions,
  cwd: string
): Promise<void> {
  // Handle --tokens <file>
  if (options.tokens) {
    const tokens = await countTokensInFile(path.join(cwd, options.tokens));
    console.log(`${options.tokens}: ~${tokens.toLocaleString()} tokens`);
    return;
  }

  const pattern = args[0] || options.pattern;

  // Handle --status
  if (options.status) {
    if (!pattern) {
      // List all batch files
      const batchDir = path.join(cwd, BATCHES_DIR);
      try {
        const files = await fs.readdir(batchDir);
        console.log('\nAvailable batch definitions:');
        for (const file of files.filter(f => f.endsWith('.json'))) {
          console.log(`  ${file.replace('.json', '')}`);
        }
      } catch {
        console.log('No batch definitions found.');
      }
      return;
    }

    const result = await loadBatchResult(cwd, pattern);
    if (!result) {
      console.error(`No batches found for pattern: ${pattern}`);
      console.error(`Run: tsv batch '${pattern}' --generate`);
      process.exit(1);
    }
    displayStatus(result);
    return;
  }

  // Handle --generate
  if (options.generate) {
    if (!pattern) {
      console.error('Error: Pattern required for --generate');
      console.error('Usage: tsv batch \'docs/**/*.md\' --generate');
      process.exit(1);
    }

    console.log(`Generating batches for: ${pattern}`);
    const result = await generateBatchesFromGlob(cwd, pattern);
    const filePath = await saveBatchResult(cwd, pattern, result);

    console.log(`\nGenerated ${result.batches.length} batches from ${result.totalFiles} files`);
    console.log(`Total tokens: ~${result.totalTokens.toLocaleString()}`);
    console.log(`Saved to: ${filePath}`);
    return;
  }

  // Default: show help
  console.log(`
Usage: tsv batch [pattern] [options]

Options:
  --generate     Generate batches from glob pattern
  --status       Show batch status
  --tokens FILE  Count tokens in a file

Examples:
  tsv batch 'docs/**/*.md' --generate
  tsv batch 'src/**/*.ts' --generate
  tsv batch --status
  tsv batch 'docs/**/*.md' --status
  tsv batch --tokens README.md
`);
}
```

**Step 3: Install glob dependency**

Run: `cd packages/cli && npm install glob`

**Step 4: Wire into CLI using Commander**

The CLI uses Commander subcommands. Add to `packages/cli/src/cli.ts`:

```typescript
// At top with other imports:
import { batchCommand } from './commands/batch.js';

// After other program.command() calls (around line 210):
program
  .command('batch [pattern]')
  .description('Generate and manage verification batches')
  .option('--generate', 'Generate batches from glob pattern')
  .option('--status', 'Show batch status')
  .option('--tokens <file>', 'Count tokens in a file')
  .action(async (pattern: string | undefined, options: { generate?: boolean; status?: boolean; tokens?: string }) => {
    try {
      await batchCommand(
        pattern ? [pattern] : [],
        { ...options, pattern },
        process.cwd()
      );
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
```

**Step 5: Build and test**

Run: `cd packages/cli && npm run build`

Run: `tsv batch --help`
Expected: Shows usage help

Run: `tsv batch 'docs/**/*.md' --generate` (if docs exist)
Expected: Creates batch file in `.claude/turboshovel/batches/`

**Step 5: Commit**

```bash
git add packages/cli/src/commands/batch.ts packages/cli/src/cli.ts
git commit -m "feat(cli): add batch subcommand for verification batches"
```

---

## Phase 2: Named Workflows & Resume

Enable long-running verification workflows with named workflows and resume capability.

**Note:** The existing schema already has `parentWorkflowId` and `parentTaskId` fields. We extend the session state for named workflows and add a `children` field.

---

### Task 2.1: Add Named Workflows to Session State

**Files:**
- Modify: `packages/shared/src/workflow/state.ts`
- Modify: `packages/shared/src/schemas.ts`

**Step 1: Read existing SessionData interface**

The `SessionData` interface in `packages/shared/src/workflow/state.ts` (lines 34-37) currently has:
- `active_workflow: string | null`
- `stashedWorkflowId?: string`

We need to add:
- `named_workflows: Record<string, string>`

**Step 2: Update SessionData interface**

In `packages/shared/src/workflow/state.ts`, update the interface:

```typescript
interface SessionData {
  active_workflow: string | null;
  stashedWorkflowId?: string;
  named_workflows?: Record<string, string>; // name -> workflow ID
}
```

**Step 3: Update WorkflowStateSchema for children tracking**

In `packages/shared/src/schemas.ts`, add to `WorkflowStateSchema`:

```typescript
// Add after parentTaskId field (around line 129):
childWorkflowIds: z.array(z.string()).optional(),
status: z.enum(['running', 'suspended', 'completed', 'stopped']).optional(),
```

**Step 4: Add methods to WorkflowStateManager**

Add to `packages/shared/src/workflow/state.ts`:

```typescript
/**
 * Register a named workflow.
 */
async registerNamedWorkflow(name: string, id: string): Promise<void> {
  const session = await this.loadSession();
  session.named_workflows = session.named_workflows || {};
  session.named_workflows[name] = id;
  await this.saveSession(session);
}

/**
 * Get workflow ID by name.
 */
async getNamedWorkflow(name: string): Promise<string | null> {
  const session = await this.loadSession();
  return session.named_workflows?.[name] || null;
}

/**
 * Resume a named workflow (make it active).
 * Returns error if current active has running children.
 */
async resume(name: string): Promise<WorkflowState> {
  const session = await this.loadSession();
  const workflowId = session.named_workflows?.[name];

  if (!workflowId) {
    throw new Error(`No workflow named '${name}'`);
  }

  // Check if current active has running children (using existing parentWorkflowId)
  if (session.active_workflow) {
    const children = await this.getChildWorkflows(session.active_workflow);
    const runningChildren = children.filter(c => c.status === 'running');
    if (runningChildren.length > 0) {
      throw new Error(
        `Cannot switch: active workflow has ${runningChildren.length} running child workflow(s). ` +
        `Wait for children to complete before switching.`
      );
    }
  }

  // Suspend current active
  if (session.active_workflow && session.active_workflow !== workflowId) {
    session.stashedWorkflowId = session.active_workflow;
  }

  // Make named workflow active
  session.active_workflow = workflowId;
  await this.saveSession(session);

  const state = await this.load(workflowId);
  if (!state) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  return state;
}

/**
 * Get child workflows (workflows with parentWorkflowId matching id)
 */
async getChildWorkflows(id: string): Promise<WorkflowState[]> {
  const all = await this.list();
  return all.filter(w => w.parentWorkflowId === id);
}
```

**Step 5: Commit**

```bash
git add packages/shared/src/workflow/state.ts packages/shared/src/schemas.ts
git commit -m "feat(workflow): add named workflows and resume support"
```

---

### Task 2.2: Add Resume Command to CLI

**Files:**
- Modify: `packages/cli/src/cli.ts`

**Step 1: Add resume command using Commander**

Add after other `program.command()` calls:

```typescript
program
  .command('resume [name]')
  .description('Resume a named or stashed workflow')
  .action(async (name: string | undefined) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);

      if (!name) {
        // Resume last stashed (same as pop)
        const state = await manager.pop();
        if (!state) {
          console.error('No stashed workflow to resume');
          process.exit(1);
        }
        console.log(`Resumed: ${state.taskName}`);
      } else {
        // Resume named workflow
        const state = await manager.resume(name);
        console.log(`Resumed workflow '${name}': ${state.taskName}`);
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
```

**Step 2: Update start command to support --name**

Find the existing `program.command('start [file]')` section and add the `--name` option:

```typescript
program
  .command('start [file]')
  .description('Start a new workflow or queue a task')
  .option('--task <taskId>', 'Mark task as started (adds to pending queue)')
  .option('--agent <agentId>', 'Bind agent to pending task')
  .option('--name <name>', 'Give workflow a name for later resume')  // ADD THIS
  .action(async (file: string | undefined, options: { task?: string; agent?: string; name?: string }) => {
    // ... existing logic ...

    // After creating workflow state (around line 115), add:
    if (options.name) {
      await manager.registerNamedWorkflow(options.name, state.id);
      console.log(`Workflow '${options.name}' started: ${state.id}`);
    }
  });
```

**Step 3: Build and test**

Run: `cd packages/cli && npm run build`

Run: `tsv start test.workflow.md --name my-test`
Expected: Creates named workflow

Run: `tsv resume my-test`
Expected: Resumes the named workflow

**Step 4: Commit**

```bash
git add packages/cli/src/cli.ts
git commit -m "feat(cli): add resume command and --name flag for workflows"
```

---

## Continued in Part 2...

This plan covers Phase 0-2 (report format, CLI foundation, named workflows). The remaining phases are:

- **Phase 3:** Workflow integration (`verify-batch.workflow.md`)
- **Phase 4:** Batch verification skill
- **Phase 5:** Cycle summary aggregation
- **Phase 6:** Polish (change detection, cycle management)

---

## Notes

- Each task is designed to be completed in 10-30 minutes
- Tests are written first (TDD)
- Commits happen after each task
- Dependencies: `glob` may need to be installed: `npm install glob`
- Tests use Jest globals (describe, it, expect) - no imports needed
