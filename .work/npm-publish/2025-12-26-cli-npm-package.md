# CLI npm Package Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use cipherpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create standalone `@turboshovel/cli` npm package with `turboshovel` and `tsv` commands.

**Architecture:** Create `packages/cli/` with flat command structure. Refactor existing `workflow-cli.ts` to use `turboshovel` as program name with direct subcommands (no `workflow` nesting). Both commands point to same entrypoint.

**Tech Stack:** TypeScript, Commander.js, npm workspaces

---

## Task 1: Create packages/cli directory structure

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/.gitignore`

**Step 1: Create package.json**

Create `packages/cli/package.json`:

```json
{
  "name": "@turboshovel/cli",
  "version": "1.0.0",
  "description": "Workflow orchestration CLI for Claude Code",
  "main": "dist/cli.js",
  "bin": {
    "turboshovel": "dist/cli.js",
    "tsv": "dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts",
    "clean": "rm -rf dist"
  },
  "keywords": ["claude", "workflow", "cli", "turboshovel"],
  "author": "Toby Hede",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/tobyhede/turboshovel"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "commander": "^14.0.2",
    "js-yaml": "^4.1.1",
    "mdast-util-from-markdown": "^2.0.2",
    "minimatch": "^10.1.1",
    "unist-util-visit": "^5.0.0",
    "zod": "^4.2.1"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

Create `packages/cli/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create .gitignore**

Create `packages/cli/.gitignore`:

```
node_modules/
dist/
*.log
```

**Step 4: Verify directory structure**

Run: `ls -la packages/cli/`
Expected: package.json, tsconfig.json, .gitignore

**Step 5: Commit**

```bash
git add packages/cli/package.json packages/cli/tsconfig.json packages/cli/.gitignore
git commit -m "chore: scaffold packages/cli directory"
```

---

## Task 2: Copy and refactor CLI source files

**Files:**
- Create: `packages/cli/src/cli.ts`
- Copy: workflow state, parser, types from plugin/core

**Step 1: Create src directory**

Run: `mkdir -p packages/cli/src`

**Step 2: Copy required source files**

Copy the following from `plugin/core/src/` to `packages/cli/src/`:

```bash
cp -r plugin/core/src/workflow packages/cli/src/
cp plugin/core/src/errors.ts packages/cli/src/
cp plugin/core/src/config.ts packages/cli/src/
cp plugin/core/src/schemas.ts packages/cli/src/
```

**Step 3: Create main CLI entrypoint**

Create `packages/cli/src/cli.ts`:

```typescript
#!/usr/bin/env node
// packages/cli/src/cli.ts

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkflowStateManager } from './workflow/state';
import { parseWorkflow, WorkflowSyntaxError } from './workflow/parser';
import { taskIdToString, parseTaskIdFromString } from './workflow/task-id';
import {
  createTaskNumber,
  incrementTaskNumber,
  type TaskNumber,
  type Action,
  type Task
} from './workflow/types';
import { isNodeError, getErrorMessage } from './errors';
import { evaluateFailCondition } from './workflow/condition-handler';

const program = new Command();

program
  .name('turboshovel')
  .description('Workflow orchestration CLI')
  .version('1.0.0');

function getCwd(): string {
  return process.cwd();
}

// start command
program
  .command('start [file]')
  .description('Start a new workflow or queue a task')
  .option('--task <taskId>', 'Queue a task for agent binding')
  .option('--agent <agentId>', 'Bind agent to pending task')
  .action(async (file: string | undefined, options: { task?: string; agent?: string }) => {
    try {
      const cwd = getCwd();
      const manager = new WorkflowStateManager(cwd);

      if (options.task && !options.agent) {
        const state = await manager.getActive();
        if (!state) {
          console.error('Error: No active workflow');
          process.exit(1);
        }

        const taskId = parseTaskIdFromString(options.task);
        if (!taskId) {
          console.error(`Error: Invalid task ID format: ${options.task}`);
          console.error('Expected format: "3" or "3.1"');
          process.exit(1);
        }

        await manager.pushPendingTask(state.id, taskId);
        console.log(`Task ${taskIdToString(taskId)} queued for agent binding`);
        return;
      }

      if (options.agent) {
        const state = await manager.getActive();
        if (!state) {
          console.error('Error: No active workflow');
          process.exit(1);
        }

        const taskId = await manager.popPendingTask(state.id);
        if (!taskId) {
          console.error('Error: No pending task to bind');
          process.exit(1);
        }

        await manager.bindAgent(state.id, options.agent, taskId);
        console.log(`Agent ${options.agent} bound to task ${taskIdToString(taskId)}`);
        return;
      }

      if (file && !options.task && !options.agent) {
        const filePath = path.isAbsolute(file) ? file : path.join(cwd, file);
        const content = await fs.readFile(filePath, 'utf8');
        const tasks = parseWorkflow(content);

        if (tasks.length === 0) {
          console.error('Error: Workflow has no tasks');
          process.exit(1);
        }

        const workflowPath = path.isAbsolute(file) ? path.relative(cwd, file) : file;
        const state = await manager.create(workflowPath, tasks[0].description);
        await manager.setActive(state.id);

        console.log(`Started workflow: ${workflowPath}`);
        console.log(`ID: ${state.id}`);
        console.log(`Task 1: ${tasks[0].description}`);
        printTaskGuidance(tasks[0]);
        return;
      }

      if (!file && !options.task && !options.agent) {
        console.error('Error: Workflow file, --task, or --agent option required');
        process.exit(1);
      }
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        console.error(`Error: Workflow file not found: ${file}`);
      } else if (error instanceof WorkflowSyntaxError) {
        console.error(`Syntax error: ${error.message}`);
      } else {
        console.error(`Error: ${getErrorMessage(error)}`);
      }
      process.exit(1);
    }
  });

// next command
program
  .command('next')
  .description('Advance to the next step')
  .option('--step <n>', 'Jump to specific step')
  .option('--pass', 'Mark task as passed')
  .option('--fail', 'Mark task as failed')
  .option('--retry', 'Retry current task')
  .option('--task <taskId>', 'Specify which task')
  .option('--agent <agentId>', 'Specify agent')
  .action(async (options) => {
    // Implementation copied from workflow-cli.ts next command
    // ... (full implementation)
  });

// status command
program
  .command('status')
  .description('Show current workflow state')
  .action(async () => {
    // Implementation copied from workflow-cli.ts status command
  });

// stop command
program
  .command('stop')
  .description('Abort current workflow')
  .action(async () => {
    // Implementation copied from workflow-cli.ts stop command
  });

// complete command
program
  .command('complete')
  .description('Mark workflow as complete')
  .option('--status <status>', 'Completion status (ok|blocked)', 'ok')
  .action(async (options) => {
    // Implementation copied from workflow-cli.ts complete command
  });

// stash command
program
  .command('stash')
  .description('Pause workflow enforcement')
  .action(async () => {
    // Implementation copied from workflow-cli.ts stash command
  });

// pop command
program
  .command('pop')
  .description('Resume workflow enforcement')
  .action(async () => {
    // Implementation copied from workflow-cli.ts pop command
  });

// list command
program
  .command('list')
  .description('List all workflows')
  .action(async () => {
    // Implementation copied from workflow-cli.ts list command
  });

// gate command
program
  .command('gate <name>')
  .description('Run a gate by name')
  .action(async (name) => {
    // Implementation copied from workflow-cli.ts gate command
  });

function printTaskGuidance(task: Task): void {
  // Implementation copied from workflow-cli.ts
}

function formatAction(action: Action): string {
  // Implementation copied from workflow-cli.ts
}

async function findWorkflowFile(cwd: string, filename: string): Promise<string | null> {
  // Implementation copied from workflow-cli.ts
}

program.parse();
```

**Step 4: Verify files exist**

Run: `ls -la packages/cli/src/`
Expected: cli.ts, workflow/, errors.ts, config.ts, schemas.ts

**Step 5: Commit**

```bash
git add packages/cli/src/
git commit -m "feat: add CLI source files to packages/cli"
```

---

## Task 3: Move condition-handler to workflow directory

**Files:**
- Move: `plugin/core/src/cli/condition-handler.ts` → `packages/cli/src/workflow/condition-handler.ts`

**Step 1: Copy condition-handler**

```bash
cp plugin/core/src/cli/condition-handler.ts packages/cli/src/workflow/
```

**Step 2: Update import in cli.ts**

In `packages/cli/src/cli.ts`, change:
```typescript
import { evaluateFailCondition } from './workflow/condition-handler';
```

**Step 3: Verify import works**

Run: `cd packages/cli && npx tsc --noEmit`
Expected: No errors (or only expected errors for incomplete implementation)

**Step 4: Commit**

```bash
git add packages/cli/src/workflow/condition-handler.ts
git commit -m "feat: add condition-handler to packages/cli"
```

---

## Task 4: Complete CLI implementation

**Files:**
- Modify: `packages/cli/src/cli.ts`

**Step 1: Copy full command implementations**

Copy all command action implementations from `plugin/core/src/cli/workflow-cli.ts` to `packages/cli/src/cli.ts`.

Key changes from original:
1. Program name: `turboshovel` instead of `workflow`
2. No nested `workflow` subcommand - commands are direct
3. Update any output messages referencing "workflow" command

**Step 2: Update helper messages**

Change messages like:
- `'Use "workflow pop" to resume.'` → `'Use "tsv pop" to resume.'`
- `'Run: workflow next'` → `'Run: tsv next'`

**Step 3: Verify TypeScript compiles**

Run: `cd packages/cli && npm install && npm run build`
Expected: Compiles successfully to dist/

**Step 4: Commit**

```bash
git add packages/cli/src/cli.ts
git commit -m "feat: complete CLI implementation with flat command structure"
```

---

## Task 5: Test CLI locally

**Files:**
- Test: `packages/cli/` (local linking)

**Step 1: Build the package**

```bash
cd packages/cli
npm run build
```

**Step 2: Link globally**

```bash
npm link
```

**Step 3: Test commands work**

```bash
turboshovel --help
tsv --help
tsv status
```

Expected: Help output shows all commands, status shows "No active workflow"

**Step 4: Test start command**

```bash
cd /tmp
mkdir test-workflow
cd test-workflow
cat > test.workflow.md << 'EOF'
## 1. First step

```bash
echo "hello"
```

- PASS: CONTINUE
- FAIL: STOP
EOF

tsv start test.workflow.md
tsv status
tsv next
```

Expected: Workflow starts, status shows task 1, next advances

**Step 5: Clean up**

```bash
cd packages/cli
npm unlink -g
rm -rf /tmp/test-workflow
```

**Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: CLI tested and working locally"
```

---

## Task 6: Update documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Step 1: Update CLAUDE.md**

Add installation section:

```markdown
### CLI Installation

Install the CLI globally:

```bash
npm install -g @turboshovel/cli
```

Commands:

```bash
tsv start <file>       # Start workflow
tsv next               # Advance to next step
tsv status             # Show current state
tsv stop               # Abort workflow
tsv complete           # Mark complete
tsv stash              # Pause enforcement
tsv pop                # Resume enforcement
tsv list               # List all workflows
tsv gate <name>        # Run a gate
```

The `turboshovel` command is an alias for `tsv`.
```

**Step 2: Update README.md**

Add CLI section with installation and usage examples.

**Step 3: Remove old CLI Access section**

Remove the npm link / full path documentation since npm install is now the primary method.

**Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update CLI installation instructions"
```

---

## Task 7: Prepare for npm publish

**Files:**
- Modify: `packages/cli/package.json`
- Create: `packages/cli/README.md`

**Step 1: Add README.md for npm**

Create `packages/cli/README.md`:

```markdown
# @turboshovel/cli

Workflow orchestration CLI for Claude Code.

## Installation

```bash
npm install -g @turboshovel/cli
```

## Usage

```bash
# Start a workflow
tsv start my-workflow.md

# Check status
tsv status

# Advance to next step
tsv next

# Handle failure (evaluates FAIL condition)
tsv next --fail

# Stop workflow
tsv stop
```

## Commands

| Command | Description |
|---------|-------------|
| `tsv start <file>` | Start a new workflow |
| `tsv next` | Advance to next step |
| `tsv status` | Show current state |
| `tsv stop` | Abort workflow |
| `tsv complete` | Mark complete |
| `tsv stash` | Pause enforcement |
| `tsv pop` | Resume enforcement |
| `tsv list` | List all workflows |
| `tsv gate <name>` | Run a gate |

The `turboshovel` command is an alias for `tsv`.

## License

MIT
```

**Step 2: Verify package.json has all required fields**

Ensure `package.json` has:
- `name`: `@turboshovel/cli`
- `version`: `1.0.0`
- `description`: Set
- `repository`: Set
- `license`: MIT
- `keywords`: Set
- `files`: Add `["dist", "README.md"]`

**Step 3: Add files field to package.json**

Add to `packages/cli/package.json`:
```json
{
  "files": ["dist", "README.md"]
}
```

**Step 4: Test npm pack**

```bash
cd packages/cli
npm run build
npm pack --dry-run
```

Expected: Shows files that would be included in package

**Step 5: Commit**

```bash
git add packages/cli/README.md packages/cli/package.json
git commit -m "chore: prepare packages/cli for npm publish"
```

---

## Task 8: Publish to npm (Manual)

**Note:** This task requires npm credentials and is done manually.

**Step 1: Login to npm**

```bash
npm login
```

**Step 2: Publish**

```bash
cd packages/cli
npm publish --access public
```

**Step 3: Verify**

```bash
npm info @turboshovel/cli
```

**Step 4: Test global install**

```bash
npm install -g @turboshovel/cli
tsv --help
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create packages/cli directory | package.json, tsconfig.json |
| 2 | Copy and refactor CLI source | cli.ts, workflow/, errors.ts |
| 3 | Move condition-handler | condition-handler.ts |
| 4 | Complete CLI implementation | cli.ts |
| 5 | Test CLI locally | (testing) |
| 6 | Update documentation | CLAUDE.md, README.md |
| 7 | Prepare for npm publish | README.md, package.json |
| 8 | Publish to npm | (manual) |
