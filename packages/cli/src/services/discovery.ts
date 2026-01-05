// packages/cli/src/services/discovery.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { extractFrontmatter, nameFromFilename } from '@turboshovel/parser';

/**
 * Discovered workflow metadata
 */
export interface DiscoveredWorkflow {
  name: string;
  path: string;
  source: 'project' | 'plugin';
  description?: string;
  tags?: string[];
}

/**
 * Search path with source information
 */
interface SearchPath {
  path: string;
  source: 'project' | 'plugin';
}

/**
 * Get search paths for workflows
 * Returns project directory first (takes precedence), then plugin directory
 */
export function getSearchPaths(cwd: string): SearchPath[] {
  const paths: SearchPath[] = [];

  // Project workflows directory
  const projectWorkflowsDir = path.join(cwd, '.claude', 'workflows');
  paths.push({
    path: projectWorkflowsDir,
    source: 'project',
  });

  // Plugin workflows directory (from CLAUDE_PLUGIN_ROOT environment variable)
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (pluginRoot) {
    const pluginWorkflowsDir = path.join(pluginRoot, 'workflows');
    paths.push({
      path: pluginWorkflowsDir,
      source: 'plugin',
    });
  }

  return paths;
}

/**
 * Scan a directory for *.workflow.md files and extract metadata
 */
export async function scanDirectory(dirPath: string, source: 'project' | 'plugin'): Promise<DiscoveredWorkflow[]> {
  const workflows: DiscoveredWorkflow[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.workflow.md')) continue;

      try {
        const filePath = path.join(dirPath, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        const { frontmatter } = extractFrontmatter(content);

        // Match by frontmatter name or filename stem
        const workflowName = frontmatter?.name || nameFromFilename(entry.name);

        workflows.push({
          name: workflowName,
          path: filePath,
          source,
          description: frontmatter?.description,
          tags: frontmatter?.tags,
        });
      } catch {
        // Skip files that can't be read or parsed
        continue;
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
    return [];
  }

  return workflows;
}

/**
 * Discover all workflows from project and plugin directories
 * Project workflows take precedence over plugin workflows with same name
 */
export async function discoverWorkflows(cwd: string): Promise<DiscoveredWorkflow[]> {
  const searchPaths = getSearchPaths(cwd);
  const allWorkflows: DiscoveredWorkflow[] = [];
  const seen = new Set<string>();

  for (const { path: dirPath, source } of searchPaths) {
    const workflows = await scanDirectory(dirPath, source);

    for (const workflow of workflows) {
      // Skip if already seen (project takes precedence over plugin)
      if (seen.has(workflow.name)) continue;

      allWorkflows.push(workflow);
      seen.add(workflow.name);
    }
  }

  return allWorkflows;
}

/**
 * Find a workflow by name
 * Project workflows take precedence over plugin workflows
 */
export async function findWorkflowByName(cwd: string, name: string): Promise<DiscoveredWorkflow | null> {
  const searchPaths = getSearchPaths(cwd);

  for (const { path: dirPath, source } of searchPaths) {
    const workflows = await scanDirectory(dirPath, source);

    for (const workflow of workflows) {
      if (workflow.name === name) {
        return workflow;
      }
    }
  }

  return null;
}
