import { dispatch } from '../../src/dispatcher.js';
import { Session } from '../../src/session.js';
import type { HookInput } from '@turboshovel/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Synthetic Events Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'synthetic-integration-'));
    await fs.mkdir(path.join(testDir, '.claude', 'session'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Skill lifecycle', () => {
    it('PreToolUse Skill → SkillStart → sets active_skill', async () => {
      const input: HookInput = {
        hook_event_name: 'PreToolUse',
        cwd: testDir,
        tool_name: 'Skill',
        tool_input: { skill: 'turboshovel:verify' }
      };

      await dispatch(input);

      const session = new Session(testDir);
      expect(await session.get('active_skill')).toBe('turboshovel:verify');
    });

    it('PostToolUse Skill → SkillEnd → clears active_skill', async () => {
      const session = new Session(testDir);
      await session.set('active_skill', 'turboshovel:verify');

      const input: HookInput = {
        hook_event_name: 'PostToolUse',
        cwd: testDir,
        tool_name: 'Skill',
        tool_input: { skill: 'turboshovel:verify' }
      };

      await dispatch(input);

      expect(await session.get('active_skill')).toBeNull();
    });
  });

  describe('Command lifecycle', () => {
    it('UserPromptSubmit with /command → SlashCommandStart → sets active_command', async () => {
      const input: HookInput = {
        hook_event_name: 'UserPromptSubmit',
        cwd: testDir,
        user_message: '/cipherpowers:verify check this'
      };

      await dispatch(input);

      const session = new Session(testDir);
      expect(await session.get('active_command')).toBe('cipherpowers:verify');
    });

    it('UserPromptSubmit clears previous active_command first', async () => {
      const session = new Session(testDir);
      await session.set('active_command', 'old-command');

      const input: HookInput = {
        hook_event_name: 'UserPromptSubmit',
        cwd: testDir,
        user_message: 'Regular message without command'
      };

      await dispatch(input);

      expect(await session.get('active_command')).toBeNull();
    });

    it('Stop → SlashCommandEnd → clears active_command', async () => {
      const session = new Session(testDir);
      await session.set('active_command', 'verify');

      const input: HookInput = {
        hook_event_name: 'Stop',
        cwd: testDir
      };

      await dispatch(input);

      expect(await session.get('active_command')).toBeNull();
    });

    it('Stop without active_command skips SlashCommandEnd', async () => {
      const input: HookInput = {
        hook_event_name: 'Stop',
        cwd: testDir
      };

      // Should not error
      await expect(dispatch(input)).resolves.not.toThrow();
    });
  });

  describe('SubagentStart', () => {
    it('PostToolUse Task → SubagentStart → stores correlation mapping', async () => {
      const input = {
        hook_event_name: 'PostToolUse',
        cwd: testDir,
        tool_name: 'Task',
        tool_input: {
          description: '1.1 - Review code',
          subagent_type: 'code-review-agent'
        },
        tool_use_id: 'toolu_abc123'
      } as HookInput;

      await dispatch(input);

      const session = new Session(testDir);
      const metadata = await session.get('metadata');
      expect(metadata).toEqual(
        expect.objectContaining({
          toolUseIdToTaskId: { 'toolu_abc123': '1.1' }
        })
      );
    });

    it('accumulates correlation mappings for multiple subagents', async () => {
      const input1 = {
        hook_event_name: 'PostToolUse',
        cwd: testDir,
        tool_name: 'Task',
        tool_input: { description: '1.1 - First task' },
        tool_use_id: 'toolu_1'
      } as HookInput;

      const input2 = {
        hook_event_name: 'PostToolUse',
        cwd: testDir,
        tool_name: 'Task',
        tool_input: { description: '1.2 - Second task' },
        tool_use_id: 'toolu_2'
      } as HookInput;

      await dispatch(input1);
      await dispatch(input2);

      const session = new Session(testDir);
      const metadata = await session.get('metadata');
      expect(metadata.toolUseIdToTaskId).toEqual({
        'toolu_1': '1.1',
        'toolu_2': '1.2'
      });
    });
  });

  describe('Context injection for synthetic events', () => {
    it('loads skill context on SkillStart', async () => {
      // Create context file
      await fs.mkdir(path.join(testDir, '.claude', 'context'), { recursive: true });
      await fs.writeFile(
        path.join(testDir, '.claude', 'context', 'verify-start.md'),
        'Verification instructions'
      );

      const input: HookInput = {
        hook_event_name: 'PreToolUse',
        cwd: testDir,
        tool_name: 'Skill',
        tool_input: { skill: 'turboshovel:verify' }
      };

      const result = await dispatch(input);

      expect(result.context).toContain('Verification instructions');
    });
  });
});
