/**
 * Opt-in default `FieldRowDeps.pickFile`. Kept out of `fields.ts` so apps that
 * never import this file never pull in `@tauri-apps/api` at build time.
 */
export async function defaultPickFile(cmd: string): Promise<string | null> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string | null>(cmd);
}
