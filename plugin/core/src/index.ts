// plugin/hooks/hooks-app/src/index.ts

// Existing exports
export { dispatch } from './dispatcher.js';
export { executeGate } from './gate-loader.js';
export { handleAction } from './action-handler.js';
export { injectContext } from './context.js';

// Exports from @turboshovel/shared
export {
  loadConfig,
  type HookInput,
  type GateResult,
  type GateExecute,
  type GateConfig,
  type HookConfig,
  type GatesConfig,
  type SessionState,
  type SessionStateArrayKey,
  type SessionStateScalarKey,
  logger,
  type LogLevel
} from '@turboshovel/shared';

// New session exports
export { Session } from './session.js';
