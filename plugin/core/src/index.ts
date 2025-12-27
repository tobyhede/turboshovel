// plugin/hooks/hooks-app/src/index.ts

// Existing exports
export { dispatch } from './dispatcher.js';
export { executeGate } from './gate-loader.js';
export { handleAction } from './action-handler.js';
export { loadConfig } from './config.js';
export { injectContext } from './context.js';

export type {
  HookInput,
  GateResult,
  GateExecute,
  GateConfig,
  HookConfig,
  GatesConfig
} from './types.js';

// New session exports
export { Session } from './session.js';
export type { SessionState, SessionStateArrayKey, SessionStateScalarKey } from './types.js';

// Logging exports
export { logger } from './logger.js';
export type { LogLevel } from './logger.js';
