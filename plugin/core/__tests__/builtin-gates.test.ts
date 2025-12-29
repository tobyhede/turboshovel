// plugin/hooks/hooks-app/__tests__/builtin-gates.test.ts
import { executeBuiltinGate } from '../src/gate-loader.js';
import type { HookInput } from '@turboshovel/shared';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set CLAUDE_PLUGIN_ROOT for tests to point to plugin directory
// __dirname = plugin/core/__tests__, plugin root = plugin/ (2 levels up)
process.env.CLAUDE_PLUGIN_ROOT = path.resolve(__dirname, '../..');

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
