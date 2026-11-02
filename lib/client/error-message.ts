/** The thrown error's message, or `fallback` when it isn't an `Error`. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
