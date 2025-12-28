# Batch Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add batch verification capability to systematically verify large content (docs, code) that exceeds agent context limits, with progress persistence, cycle tracking, and multi-workflow support.

**Architecture:** CLI (`tsv batch`) generates token-based batches. Workflow orchestrates verification. N-verification runs per batch. Reports use standardized Markdown+YAML format. Named workflows enable long-running verification across sessions.

**Tech Stack:** TypeScript, Node.js, existing turboshovel workflow system, glob patterns, SHA-256 hashing.

---

## Phase 0: Standard Report Format

Standardize n-verification report format BEFORE adding batch features. This ensures batch verification reuses the same format.

---

### Task 0.1: Create Report Template

**Files:**
- Create: `plugin/templates/verify-report.md`

**Step 1: Create the template file**

Create `plugin/templates/verify-report.md`:

```markdown
# Verification Report Template

Use this template for ALL verification report output.

## Report Structure

Reports use Markdown with YAML frontmatter for machine parsing.

### Frontmatter (Required)

```yaml
---
type: verification-report
subject: <glob pattern or description>
verified_at: <ISO timestamp>
files_reviewed: <count>
agents_used: <count>
stats:
  common: <count>
  validated: <count>
  invalidated: <count>
  uncertain: <count>
---
```

### Findings Block

Place findings in a YAML code block between markers:

```markdown
<!-- FINDINGS_START -->
```yaml
- id: 1
  file: path/to/file.md
  line: 42
  confidence: common|validated|invalidated|uncertain
  issue: One-line summary
  detail: Extended explanation (optional)
  suggestion: Proposed fix (optional)
  found_by: [1, 2] (agent indices, for exclusive findings)
  validation: confirmed|disproven|uncertain (for exclusive findings)
  evidence: path/to/evidence.ts:42 (optional)
  question: Decision needed? (for uncertain findings)
  status: pending|done|skipped
```
<!-- FINDINGS_END -->
```

### Human Summary Section

After findings, add tables organized by confidence tier:

```markdown
## Summary

### COMMON (high confidence) - N findings
| File | Line | Issue |
|------|------|-------|
| path/to/file.md | 42 | Issue summary |

### VALIDATED (medium confidence) - N findings
| File | Line | Issue | Evidence |
|------|------|-------|----------|
| path/to/file.md | 42 | Issue summary | evidence.ts:42 |

### UNCERTAIN (needs decision) - N findings
| File | Line | Issue | Question |
|------|------|-------|----------|
| path/to/file.md | 42 | Issue summary | Question? |
```

### Next Steps Section

```markdown
## Next Steps

Run `tsv revise` to address COMMON and VALIDATED findings.
Review UNCERTAIN findings manually before proceeding.
```
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

### Task 0.2: Update N-Verification Skill to Reference Template

**Files:**
- Modify: `plugin/skills/n-verification/SKILL.md`

**Step 1: Read current skill file**

Run: `cat plugin/skills/n-verification/SKILL.md`

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
- Categorize by consensus:
  - **common:** All agents found this issue
  - **validated/invalidated/uncertain:** Filled in during cross-check
```

**Step 4: Commit**

```bash
git add plugin/skills/n-verification/SKILL.md
git commit -m "feat(verify): reference standard report template in skill"
```

---

### Task 0.3: Create Report Parser Utility

**Files:**
- Create: `packages/shared/src/report-parser.ts`
- Create: `packages/shared/src/report-parser.test.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/report-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseVerificationReport, type Finding } from './report-parser.js';

const SAMPLE_REPORT = `---
type: verification-report
subject: docs/**/*.md
verified_at: 2025-12-28T12:00:00Z
files_reviewed: 5
agents_used: 2
stats:
  common: 2
  validated: 1
  invalidated: 0
  uncertain: 1
---

# Verification Report

<!-- FINDINGS_START -->
\`\`\`yaml
- id: 1
  file: docs/README.md
  line: 42
  confidence: common
  issue: Outdated reference
  status: pending

- id: 2
  file: docs/API.md
  line: 10
  confidence: validated
  issue: Missing parameter
  validation: confirmed
  status: pending
\`\`\`
<!-- FINDINGS_END -->

## Summary
`;

describe('parseVerificationReport', () => {
  it('parses frontmatter metadata', () => {
    const result = parseVerificationReport(SAMPLE_REPORT);

    expect(result.metadata.type).toBe('verification-report');
    expect(result.metadata.subject).toBe('docs/**/*.md');
    expect(result.metadata.files_reviewed).toBe(5);
    expect(result.metadata.agents_used).toBe(2);
    expect(result.metadata.stats.common).toBe(2);
  });

  it('parses findings from YAML block', () => {
    const result = parseVerificationReport(SAMPLE_REPORT);

    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].id).toBe(1);
    expect(result.findings[0].file).toBe('docs/README.md');
    expect(result.findings[0].confidence).toBe('common');
  });

  it('returns empty findings for report without FINDINGS block', () => {
    const minimal = `---
type: verification-report
subject: test
verified_at: 2025-12-28T12:00:00Z
files_reviewed: 0
agents_used: 0
stats:
  common: 0
  validated: 0
  invalidated: 0
  uncertain: 0
---

# Report
`;
    const result = parseVerificationReport(minimal);
    expect(result.findings).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && npm test -- --run report-parser`
Expected: FAIL with "Cannot find module './report-parser.js'"

**Step 3: Write minimal implementation**

Create `packages/shared/src/report-parser.ts`:

```typescript
import * as yaml from 'yaml';

export interface ReportMetadata {
  type: string;
  subject: string;
  verified_at: string;
  files_reviewed: number;
  agents_used: number;
  stats: {
    common: number;
    validated: number;
    invalidated: number;
    uncertain: number;
  };
}

export interface Finding {
  id: number;
  file: string;
  line: number;
  confidence: 'common' | 'validated' | 'invalidated' | 'uncertain';
  issue: string;
  detail?: string;
  suggestion?: string;
  found_by?: number[];
  validation?: 'confirmed' | 'disproven' | 'uncertain';
  evidence?: string;
  question?: string;
  status: 'pending' | 'done' | 'skipped';
}

export interface VerificationReport {
  metadata: ReportMetadata;
  findings: Finding[];
  raw: string;
}

/**
 * Parse a verification report from Markdown with YAML frontmatter.
 */
export function parseVerificationReport(content: string): VerificationReport {
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error('Report missing YAML frontmatter');
  }

  const metadata = yaml.parse(frontmatterMatch[1]) as ReportMetadata;

  // Extract findings block
  const findingsMatch = content.match(
    /<!-- FINDINGS_START -->\s*```yaml\s*([\s\S]*?)```\s*<!-- FINDINGS_END -->/
  );

  let findings: Finding[] = [];
  if (findingsMatch) {
    findings = yaml.parse(findingsMatch[1]) as Finding[];
  }

  return {
    metadata,
    findings,
    raw: content,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/shared && npm test -- --run report-parser`
Expected: PASS

**Step 5: Add export to index**

Add to `packages/shared/src/index.ts`:

```typescript
export * from './report-parser.js';
```

**Step 6: Commit**

```bash
git add packages/shared/src/report-parser.ts packages/shared/src/report-parser.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add verification report parser"
```

---

## Phase 1: CLI Foundation

Build the `tsv batch` subcommand with token counting and batch generation.

---

### Task 1.1: Create Token Counting Utility

**Files:**
- Create: `packages/shared/src/tokens.ts`
- Create: `packages/shared/src/tokens.test.ts`

**Step 1: Write the failing test**

Create `packages/shared/src/tokens.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
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

Run: `cd packages/shared && npm test -- --run tokens`
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

Run: `cd packages/shared && npm test -- --run tokens`
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
import { describe, it, expect } from 'vitest';
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

Run: `cd packages/shared && npm test -- --run batch`
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

Run: `cd packages/shared && npm test -- --run batch`
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

**Step 3: Wire into CLI router**

In `packages/cli/src/cli.ts`, add the batch command. Find where commands are registered and add:

```typescript
import { batchCommand } from './commands/batch.js';

// In the command routing section:
case 'batch':
  await batchCommand(args.slice(1), {
    generate: args.includes('--generate'),
    status: args.includes('--status'),
    tokens: args.find((a, i) => args[i-1] === '--tokens'),
    pattern: args.find(a => !a.startsWith('--') && a !== 'batch'),
  }, process.cwd());
  break;
```

**Step 4: Build and test**

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

---

### Task 2.1: Add Named Workflows to Session State

**Files:**
- Modify: `packages/shared/src/workflow/state.ts`
- Modify: `packages/shared/src/workflow/types.ts`

**Step 1: Update types**

Add to `packages/shared/src/workflow/types.ts`:

```typescript
/**
 * Session data stored in session.json
 * Tracks active and named workflows
 */
export interface SessionData {
  active_workflow: string | null;
  last_suspended: string | null;
  named_workflows: Record<string, string>; // name -> workflow ID
}
```

**Step 2: Update WorkflowStateManager**

Add methods to `packages/shared/src/workflow/state.ts`:

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

  // Check if current active has running children
  if (session.active_workflow) {
    const active = await this.load(session.active_workflow);
    if (active && active.children && active.children.length > 0) {
      // Check if any children are still running
      for (const childId of active.children) {
        const child = await this.load(childId);
        if (child && child.status === 'running') {
          throw new Error(
            `Cannot switch: ${active.taskName} has running child workflows. ` +
            `Wait for children to complete before switching.`
          );
        }
      }
    }
  }

  // Suspend current active
  if (session.active_workflow && session.active_workflow !== workflowId) {
    session.last_suspended = session.active_workflow;
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
```

**Step 3: Update WorkflowState type to include parent/children**

In types:

```typescript
export interface WorkflowState {
  // ... existing fields ...
  parent: string | null;
  children: string[];
  status: 'running' | 'suspended' | 'completed' | 'stopped';
}
```

**Step 4: Commit**

```bash
git add packages/shared/src/workflow/state.ts packages/shared/src/workflow/types.ts
git commit -m "feat(workflow): add named workflows and resume support"
```

---

### Task 2.2: Add Resume Command to CLI

**Files:**
- Modify: `packages/cli/src/cli.ts`

**Step 1: Add resume command handler**

```typescript
case 'resume': {
  const name = args[1];
  const manager = new WorkflowStateManager(process.cwd());

  if (!name) {
    // Resume last suspended
    const state = await manager.pop();
    if (!state) {
      console.error('No suspended workflow to resume');
      process.exit(1);
    }
    console.log(`Resumed: ${state.taskName}`);
  } else {
    // Resume named workflow
    try {
      const state = await manager.resume(name);
      console.log(`Resumed workflow '${name}': ${state.taskName}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
  break;
}
```

**Step 2: Update start command to support --name**

Add `--name` flag handling:

```typescript
case 'start': {
  const file = args[1];
  const nameIndex = args.indexOf('--name');
  const name = nameIndex !== -1 ? args[nameIndex + 1] : undefined;

  // ... existing start logic ...

  // After creating workflow, register if named
  if (name) {
    await manager.registerNamedWorkflow(name, state.id);
    console.log(`Workflow '${name}' started: ${state.id}`);
  }

  break;
}
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
- Dependencies (glob, yaml) may need to be installed: `npm install glob yaml`
