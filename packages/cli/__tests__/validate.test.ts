import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('tsv validate', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsv-validate-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const runValidate = (file: string): { stdout: string; stderr: string; exitCode: number } => {
    try {
      const stdout = execSync(`npx tsv validate ${file}`, {
        encoding: 'utf-8',
        cwd: tempDir,
      });
      return { stdout, stderr: '', exitCode: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.status || 1,
      };
    }
  };

  it('outputs PASS with step count for valid workflow', () => {
    const workflowPath = path.join(tempDir, 'valid.workflow.md');
    fs.writeFileSync(workflowPath, `## 1. First step

Do something.

- PASS: CONTINUE

## 2. Second step

Do another thing.

- PASS: DONE
`);

    const result = runValidate(workflowPath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('PASS:');
    expect(result.stdout).toContain('2 steps');
  });
});
