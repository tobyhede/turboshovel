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
  type TurboshovelConfig,
  type SessionState,
  type SessionStateArrayKey,
  type SessionStateScalarKey,
  logger,
  type LogLevel
} from '@turboshovel/shared';

// New session exports
export { Session } from './session.js';

// Synthetic events
export { detectSyntheticEvents } from './synthetic-events/detector.js';
export { isSyntheticEvent } from './synthetic-events/types.js';
export type { SyntheticEvent, SyntheticEventName } from './synthetic-events/types.js';
