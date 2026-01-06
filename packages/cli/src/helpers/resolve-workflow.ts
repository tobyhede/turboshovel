import * as fs from 'fs/promises';
import * as path from 'path';
import { findRunbookByName } from '../services/discovery.js';

/**
 * Resolve workflow file by path (existing logic).
 * Search order:
 * 1. .claude/workflows/ (project-local)
 * 2. $CLAUDE_PLUGIN_ROOT/workflows/ (plugin directory)
 * 3. Relative to cwd
 *
 * @param cwd - Current working directory
 * @param filename - Workflow filename to find
 * @returns Absolute path to workflow file, or null if not found
 */
async function resolveByPath(cwd: string, filename: string): Promise<string | null> {
  // 1. Check project-local .claude/runbooks/
  const localPath = path.join(cwd, '.claude/runbooks', filename);
  try {
    await fs.access(localPath);
    return localPath;
  } catch { /* not found */ }

  // 2. Check plugin workflows directory
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    const pluginPath = path.join(pluginRoot, 'runbooks', filename);
    try {
      await fs.access(pluginPath);
      return pluginPath;
    } catch { /* not found */ }
  }

  // 3. Check relative to cwd
  const relativePath = path.join(cwd, filename);
  try {
    await fs.access(relativePath);
    return relativePath;
  } catch { /* not found */ }

  return null;
}

/**
 * Detect if identifier is path-based or name-based.
 * Path mode: contains '/' or ends with '.md'
 * Name mode: plain identifier (e.g., "verify")
 *
 * @param identifier - Workflow identifier
 * @returns true if path-based, false if name-based
 */
function isPathIdentifier(identifier: string): boolean {
  return identifier.includes('/') || identifier.endsWith('.md');
}

/**
 * Resolve workflow file from multiple sources.
 * Supports both path-based and name-based resolution:
 * - Path mode: .claude/workflows/file.md, ./path/to/file.md, etc.
 * - Name mode: "verify", "my-workflow", etc.
 *
 * Search order for path mode:
 * 1. .claude/workflows/ (project-local)
 * 2. $CLAUDE_PLUGIN_ROOT/workflows/ (plugin directory)
 * 3. Relative to cwd
 *
 * Search order for name mode:
 * 1. Project workflows directory
 * 2. Plugin workflows directory
 *
 * @param cwd - Current working directory
 * @param identifier - Workflow filename or name to find
 * @returns Absolute path to workflow file, or null if not found
 */
export async function resolveWorkflowFile(cwd: string, identifier: string): Promise<string | null> {
  // Detect if identifier is path-based or name-based
  if (isPathIdentifier(identifier)) {
    // Path-based resolution: use existing logic
    return resolveByPath(cwd, identifier);
  } else {
    // Name-based resolution: use discovery service
    const discovered = await findRunbookByName(cwd, identifier);
    return discovered ? discovered.path : null;
  }
}
