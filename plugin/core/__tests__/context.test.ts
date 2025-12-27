// plugin/hooks/hooks-app/__tests__/context.test.ts
import { discoverContextFile, injectContext } from '../src/context.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Context Injection', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hooks-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('returns null when no context file exists', async () => {
    const result = await discoverContextFile(testDir, 'test-command', 'start');
    expect(result).toBeNull();
  });

  test('discovers flat context file', async () => {
    const contextDir = path.join(testDir, '.claude', 'context');
    await fs.mkdir(contextDir, { recursive: true });
    await fs.writeFile(path.join(contextDir, 'test-command-start.md'), 'content');

    const result = await discoverContextFile(testDir, 'test-command', 'start');
    expect(result).toBe(path.join(contextDir, 'test-command-start.md'));
  });

  test('discovers slash-command subdirectory', async () => {
    const contextDir = path.join(testDir, '.claude', 'context', 'slash-command');
    await fs.mkdir(contextDir, { recursive: true });
    await fs.writeFile(path.join(contextDir, 'test-command-start.md'), 'content');

    const result = await discoverContextFile(testDir, 'test-command', 'start');
    expect(result).toBe(path.join(contextDir, 'test-command-start.md'));
  });

  test('discovers nested slash-command directory', async () => {
    const contextDir = path.join(testDir, '.claude', 'context', 'slash-command', 'test-command');
    await fs.mkdir(contextDir, { recursive: true });
    await fs.writeFile(path.join(contextDir, 'start.md'), 'content');

    const result = await discoverContextFile(testDir, 'test-command', 'start');
    expect(result).toBe(path.join(contextDir, 'start.md'));
  });

  test('discovers skill context', async () => {
    const contextDir = path.join(testDir, '.claude', 'context', 'skill');
    await fs.mkdir(contextDir, { recursive: true });
    await fs.writeFile(path.join(contextDir, 'test-skill-start.md'), 'content');

    const result = await discoverContextFile(testDir, 'test-skill', 'start');
    expect(result).toBe(path.join(contextDir, 'test-skill-start.md'));
  });

  test('follows priority order - flat wins', async () => {
    const contextBase = path.join(testDir, '.claude', 'context');
    await fs.mkdir(path.join(contextBase, 'slash-command'), { recursive: true });

    await fs.writeFile(path.join(contextBase, 'test-command-start.md'), 'flat');
    await fs.writeFile(path.join(contextBase, 'slash-command', 'test-command-start.md'), 'subdir');

    const result = await discoverContextFile(testDir, 'test-command', 'start');
    expect(result).toBe(path.join(contextBase, 'test-command-start.md'));
  });
});

describe('extractNameAndStage coverage', () => {
  // Note: injectContext internally uses extractNameAndStage
  // We test via injectContext since extractNameAndStage is not exported

  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hooks-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('handles SlashCommandStart', async () => {
    const input = {
      hook_event_name: 'SlashCommandStart',
      cwd: testDir,
      command: '/commit'
    };
    // Creates .claude/context/commit-start.md
    await fs.mkdir(path.join(testDir, '.claude', 'context'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.claude', 'context', 'commit-start.md'),
      'Start content'
    );
    const result = await injectContext('SlashCommandStart', input as any);
    expect(result).toBe('Start content');
  });

  it('handles SlashCommandEnd', async () => {
    const input = {
      hook_event_name: 'SlashCommandEnd',
      cwd: testDir,
      command: '/commit'
    };
    await fs.mkdir(path.join(testDir, '.claude', 'context'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.claude', 'context', 'commit-end.md'),
      'End content'
    );
    const result = await injectContext('SlashCommandEnd', input as any);
    expect(result).toBe('End content');
  });

  it('handles SkillStart', async () => {
    const input = {
      hook_event_name: 'SkillStart',
      cwd: testDir,
      skill: 'cipherpowers:brainstorm'
    };
    await fs.mkdir(path.join(testDir, '.claude', 'context'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.claude', 'context', 'brainstorm-start.md'),
      'Skill start'
    );
    const result = await injectContext('SkillStart', input as any);
    expect(result).toBe('Skill start');
  });

  it('handles UserPromptSubmit', async () => {
    const input = {
      hook_event_name: 'UserPromptSubmit',
      cwd: testDir
    };
    await fs.mkdir(path.join(testDir, '.claude', 'context'), { recursive: true });
    await fs.writeFile(
      path.join(testDir, '.claude', 'context', 'prompt-submit.md'),
      'Prompt context'
    );
    const result = await injectContext('UserPromptSubmit', input as any);
    expect(result).toBe('Prompt context');
  });

  it('returns null for unknown hook event', async () => {
    const input = {
      hook_event_name: 'UnknownEvent',
      cwd: testDir
    };
    const result = await injectContext('UnknownEvent', input as any);
    expect(result).toBeNull();
  });
});
