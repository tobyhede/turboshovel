/**
 * Type guard for NodeJS.ErrnoException
 */
export function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/**
 * Type guard for Error instances
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
}
