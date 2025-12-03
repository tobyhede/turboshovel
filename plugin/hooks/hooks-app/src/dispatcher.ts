// plugin/hooks/hooks-app/src/dispatcher.ts
import { HookInput, HookConfig, GateConfig } from './types';
import { loadConfig } from './config';
import { injectContext } from './context';
import { executeGate } from './gate-loader';
import { handleAction } from './action-handler';
import { Session } from './session';
import { logger } from './logger';
import { minimatch } from 'minimatch';
import path from 'path';

export function shouldProcessHook(input: HookInput, hookConfig: HookConfig): boolean {
  const hookEvent = input.hook_event_name;

  // PostToolUse filtering
  if (hookEvent === 'PostToolUse') {
    if (hookConfig.enabled_tools && hookConfig.enabled_tools.length > 0) {
      return hookConfig.enabled_tools.includes(input.tool_name || '');
    }
  }

  // SubagentStop filtering
  if (hookEvent === 'SubagentStop') {
    if (hookConfig.enabled_agents && hookConfig.enabled_agents.length > 0) {
      const agentName = input.agent_name || input.subagent_name || '';
      return hookConfig.enabled_agents.includes(agentName);
    }
  }

  // No filtering or other events
  return true;
}

export interface DispatchResult {
  context?: string;
  blockReason?: string;
  stopMessage?: string;
}

/**
 * ERROR HANDLING: Circular gate chain prevention (max 10 gates per dispatch).
 * Prevents infinite loops from misconfigured gate chains.
 */
const MAX_GATES_PER_DISPATCH = 10;

// Built-in gates removed - context injection is the primary behavior
// Context injection happens via injectContext() which discovers .claude/context/ files

/**
 * Check if gate should run based on keyword matching (UserPromptSubmit only).
 * Gates without keywords always run (backwards compatible).
 *
 * Note: Uses substring matching, not word-boundary matching. This means "test"
 * will match "latest" or "contest". This is intentional for flexibility - users
 * can say "let's test this" or "testing the feature" and both will match.
 * If word-boundary matching is needed in the future, consider using regex like:
 * /\b${keyword}\b/i.test(message)
 */
export function gateMatchesKeywords(gateConfig: GateConfig, userMessage: string | undefined): boolean {
  // No keywords = always run (backwards compatible)
  if (!gateConfig.keywords || gateConfig.keywords.length === 0) {
    return true;
  }

  // No user message = skip keyword gates
  if (!userMessage) {
    return false;
  }

  const lowerMessage = userMessage.toLowerCase();
  return gateConfig.keywords.some(keyword =>
    lowerMessage.includes(keyword.toLowerCase())
  );
}

/**
 * Check if gate should run based on file pattern matching (PostToolUse only).
 * Gates without patterns always run (backwards compatible).
 *
 * Uses glob patterns matched against relative paths from project root.
 * Multiple patterns use OR logic - gate runs if file matches ANY pattern.
 *
 * @param gateConfig - Gate configuration
 * @param filePath - Absolute path to file being modified (from HookInput.file_path)
 * @param cwd - Current working directory (project root)
 * @returns true if gate should run, false otherwise
 */
export function gateMatchesFilePattern(
  gateConfig: GateConfig,
  filePath: string | undefined,
  cwd: string
): boolean {
  // No patterns = always run (backwards compatible)
  if (!gateConfig.file_patterns || gateConfig.file_patterns.length === 0) {
    return true;
  }

  // No file path = skip pattern matching
  if (!filePath) {
    return false;
  }

  // FIX: Normalize relative paths to absolute paths before conversion
  // If filePath is already relative, path.relative may produce incorrect results
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);

  // Convert absolute path to relative path from cwd
  const relativePath = path.relative(cwd, absolutePath);

  // Check if file matches ANY pattern (OR logic)
  try {
    return gateConfig.file_patterns.some((pattern) =>
      minimatch(relativePath, pattern, {
        matchBase: false,  // Match full path, not just basename (packages/cts/** shouldn't match unrelated/cts/)
        dot: true,         // Allow patterns to match dotfiles like .config/settings.json
      })
    );
  } catch (error) {
    // FIX: Invalid glob pattern - log warning and skip gate
    logger.warn('Invalid file pattern - gate skipped', {
      pattern: gateConfig.file_patterns,
      error: error instanceof Error ? error.message : String(error),
      relativePath
    }).catch(() => {}); // Ignore async logging errors
    return false;
  }
}

async function updateSessionState(input: HookInput): Promise<void> {
  const session = new Session(input.cwd);
  const event = input.hook_event_name;

  try {
    switch (event) {
      case 'SlashCommandStart':
        if (input.command) {
          await session.set('active_command', input.command);
        }
        break;

      case 'SlashCommandEnd':
        await session.set('active_command', null);
        break;

      case 'SkillStart':
        if (input.skill) {
          await session.set('active_skill', input.skill);
        }
        break;

      case 'SkillEnd':
        await session.set('active_skill', null);
        break;

      // Note: SubagentStart/SubagentStop NOT tracked - Claude Code does not
      // provide unique agent identifiers, making reliable agent tracking impossible
      // when multiple agents of the same type run in parallel.

      case 'PostToolUse':
        if (input.file_path) {
          await session.append('edited_files', input.file_path);

          // Extract and track file extension
          // Edge case: ext !== input.file_path prevents tracking entire filename
          // as extension when file has no dot (e.g., "README")
          const ext = input.file_path.split('.').pop();
          if (ext && ext !== input.file_path) {
            await session.append('file_extensions', ext);
          }
        }
        break;
    }
  } catch (error) {
    // Session state is best-effort, don't fail the hook if it errors
    // Structured error logging for debugging
    const errorData = {
      error_type: error instanceof Error ? error.constructor.name : 'UnknownError',
      error_message: error instanceof Error ? error.message : String(error),
      hook_event: event,
      cwd: input.cwd,
      timestamp: new Date().toISOString()
    };
    console.error(`[Session Error] ${JSON.stringify(errorData)}`);
  }
}

export async function dispatch(input: HookInput): Promise<DispatchResult> {
  const hookEvent = input.hook_event_name;
  const cwd = input.cwd;
  const startTime = Date.now();

  await logger.event('debug', hookEvent, {
    tool: input.tool_name,
    agent: input.agent_name || input.subagent_name,
    file: input.file_path,
    cwd,
  });

  // Update session state (best-effort)
  await updateSessionState(input);

  // 1. ALWAYS run context injection FIRST (primary behavior)
  // This discovers .claude/context/{name}-{stage}.md files
  const contextContent = await injectContext(hookEvent, input);
  let accumulatedContext = contextContent || '';

  // 2. Load config for additional gates (optional)
  const config = await loadConfig(cwd);
  if (!config) {
    await logger.debug('No gates.json config found', { cwd });
    // Return context injection result even without gates.json
    return accumulatedContext ? { context: accumulatedContext } : {};
  }

  // 3. Check if hook event has additional gates configured
  const hookConfig = config.hooks[hookEvent];
  if (!hookConfig) {
    await logger.debug('Hook event not configured in gates.json', { event: hookEvent });
    // Return context injection result even if hook not in gates.json
    return accumulatedContext ? { context: accumulatedContext } : {};
  }

  // 4. Filter by enabled lists
  if (!shouldProcessHook(input, hookConfig)) {
    await logger.debug('Hook filtered out by enabled list', {
      event: hookEvent,
      tool: input.tool_name,
      agent: input.agent_name,
    });
    // Still return context injection result
    return accumulatedContext ? { context: accumulatedContext } : {};
  }

  // 5. Run additional gates in sequence (from gates.json)
  const gates = hookConfig.gates || [];
  let gatesExecuted = 0;

  for (let i = 0; i < gates.length; i++) {
    const gateName = gates[i];

    // Circuit breaker: prevent infinite chains
    if (gatesExecuted >= MAX_GATES_PER_DISPATCH) {
      return {
        blockReason: `Exceeded max gate chain depth (${MAX_GATES_PER_DISPATCH}). Check for circular references.`
      };
    }

    const gateConfig = config.gates[gateName];
    if (!gateConfig) {
      // Graceful degradation: skip undefined gates with warning
      accumulatedContext += `\nWarning: Gate '${gateName}' not defined, skipping`;
      continue;
    }

    // Keyword filtering for UserPromptSubmit
    if (hookEvent === 'UserPromptSubmit' && !gateMatchesKeywords(gateConfig, input.user_message)) {
      await logger.debug('Gate skipped - no keyword match', { gate: gateName });
      continue;
    }

    gatesExecuted++;

    // Execute gate
    const gateStartTime = Date.now();
    const { passed, result } = await executeGate(gateName, gateConfig, input, []);
    const gateDuration = Date.now() - gateStartTime;

    await logger.event('info', hookEvent, {
      gate: gateName,
      passed,
      duration_ms: gateDuration,
      tool: input.tool_name,
    });

    // Determine action
    const action = passed ? gateConfig.on_pass || 'CONTINUE' : gateConfig.on_fail || 'BLOCK';

    // Handle action
    const actionResult = await handleAction(action, result, config, input);

    if (actionResult.context) {
      accumulatedContext += '\n' + actionResult.context;
    }

    if (!actionResult.continue) {
      await logger.event('warn', hookEvent, {
        gate: gateName,
        action,
        blocked: !!actionResult.blockReason,
        stopped: !!actionResult.stopMessage,
        duration_ms: Date.now() - startTime,
      });
      return {
        context: accumulatedContext,
        blockReason: actionResult.blockReason,
        stopMessage: actionResult.stopMessage
      };
    }

    // Gate chaining
    if (actionResult.chainedGate) {
      gates.push(actionResult.chainedGate);
    }
  }

  await logger.event('debug', hookEvent, {
    status: 'completed',
    gates_executed: gatesExecuted,
    duration_ms: Date.now() - startTime,
  });

  return {
    context: accumulatedContext
  };
}
