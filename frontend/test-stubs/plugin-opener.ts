// Test-only stub for @tauri-apps/plugin-opener.
//
// The kit imports `openUrl` (in pages/about.ts) but does not list plugin-opener
// as a dev dependency — at runtime the consuming Tauri app provides it. In the
// kit's own vitest env there is no Tauri runtime, so the import is unresolvable
// and several suites fail to load. This no-op stub is aliased in only for tests
// (see vitest.config.ts); it never ships to consumers.
export async function openUrl(_url: string): Promise<void> {
  // no-op in tests
}
