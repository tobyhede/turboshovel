// plugin/hooks/hooks-app/__tests__/builtin-gates.test.ts
import { executeBuiltinGate } from '../src/gate-loader';
import { HookInput } from '../src/types';
import * as path from 'path';

// Set CLAUDE_PLUGIN_ROOT for tests to point to plugin directory
process.env.CLAUDE_PLUGIN_ROOT = path.resolve(__dirname, '../../..');

describe('Built-in Gates', () => {
  describe('plugin-path', () => {
    test('logs plugin path when available', async () => {
      const input: HookInput = {
        hook_event_name: 'SessionStart',
        cwd: '/test'
      };

      const result = await executeBuiltinGate('plugin-path', input);
      // plugin-path gate should always continue
      expect(result.decision).toBeUndefined();
    });

    test('handles SubagentStop hook', async () => {
      const input: HookInput = {
        hook_event_name: 'SubagentStop',
        cwd: '/test',
        agent_name: 'test-agent'
      };

      const result = await executeBuiltinGate('plugin-path', input);
      expect(result.decision).toBeUndefined();
    });
  });
});
