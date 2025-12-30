import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Resolve workflow file from multiple search paths.
 * Search order:
 * 1. .claude/workflows/ (project-local)
 * 2. $CLAUDE_PLUGIN_ROOT/workflows/ (plugin directory)
 * 3. Relative to cwd
 *
 * @param cwd - Current working directory
 * @param filename - Workflow filename to find
 * @returns Absolute path to workflow file, or null if not found
 */
export async function resolveWorkflowFile(cwd: string, filename: string): Promise<string | null> {
  // 1. Check project-local .claude/workflows/
  const localPath = path.join(cwd, '.claude/workflows', filename);
  try {
    await fs.access(localPath);
    return localPath;
  } catch { /* not found */ }

  // 2. Check plugin workflows directory
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    const pluginPath = path.join(pluginRoot, 'workflows', filename);
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
