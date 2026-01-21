/**
 * Shell utility functions for secure command execution
 */

/**
 * Escape a string for safe use in shell commands
 *
 * Wraps the string in single quotes and escapes any embedded single quotes.
 * This prevents command injection vulnerabilities when passing user-controlled
 * strings to shell commands via exec/execSync.
 *
 * @param str - The string to escape
 * @returns The escaped string safe for shell usage
 *
 * @example
 * ```ts
 * const userInput = "test'; rm -rf /";
 * const safe = escapeForShell(userInput);
 * await execAsync(`echo ${safe}`); // Safe: prints "test'; rm -rf /" literally
 * ```
 */
export function escapeForShell(str: string | number): string {
  // Convert numbers to strings
  const value = String(str);

  // Wrap in single quotes and escape any embedded single quotes
  // 'abc' -> 'abc'
  // 'it's' -> 'it'\''s'
  return "'" + value.replace(/'/g, "'\\''") + "'";
}
