// packages/cli/src/helpers/context.ts

/**
 * Get current working directory.
 *
 * @returns The current working directory path
 */
export function getCwd(): string {
  return process.cwd();
}
