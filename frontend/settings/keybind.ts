import { html, type TemplateResult } from "lit-html";
import type { SettingsValue } from "./schema";

/**
 * Keybind field internals, promoted from PomodoroOverlay so any kit app gets a
 * full keybinds screen by declaring `{ key, kind: "keybind", label }` schema
 * fields plus matching Rust `Settings` defaults.
 *
 * IMPORTANT for consumers: every keybind action is a plain `Option<String>`
 * setting. Per the kit's reset-on-restart rule, any new keybind key MUST also be
 * added to the app's Rust `Settings` struct + `Default` impl, or it resets to
 * `None` on restart. The kit ships no Rust side for keybinds on purpose.
 */

/**
 * Maps a KeyboardEvent.code (the physical key, independent of Shift/layout) to
 * a Tauri accelerator key name. Reading e.code rather than e.key is essential:
 * with Shift held, e.key is the shifted glyph (e.g. "!" for Shift+1), which
 * can't be mapped. e.code stays "Digit1" regardless of modifiers.
 * Returns null for unsupported keys.
 */
function codeToAccelerator(code: string): string | null {
  if (code === "Space") return "Space";
  if (code === "ArrowLeft") return "Left";
  if (code === "ArrowRight") return "Right";
  if (code === "ArrowUp") return "Up";
  if (code === "ArrowDown") return "Down";
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1];
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(code);
  if (digit) return digit[1];
  return null;
}

/** Builds a Tauri accelerator string from a KeyboardEvent. Returns null if no valid combo (no modifier). */
export function buildAccelerator(e: KeyboardEvent): string | null {
  const mainKey = codeToAccelerator(e.code);
  if (!mainKey) return null;
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (mods.length === 0) return null;
  return [...mods, mainKey].join("+");
}

/**
 * Display-only conflict check: true if any OTHER setting in `current` already
 * holds this exact accelerator. Keybind values are distinctive accelerator
 * strings produced by buildAccelerator, so a value-equality scan reliably
 * catches two actions bound to the same chord without needing the schema's
 * field list. Never blocks saving - the Rust side stays authoritative ("first
 * wins"), so the user can deliberately rebind through a transient conflict.
 */
export function findKeybindConflict(
  current: SettingsValue,
  key: string,
  value: unknown,
): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  return Object.entries(current).some(([k, v]) => k !== key && v === value);
}

/**
 * Enters capture mode: next keydown with a modifier sets the binding.
 * Escape cancels. Direct DOM manipulation avoids needing a re-render trigger.
 * The kit re-renders the whole page on every setField, so a button can detach
 * mid-capture; the document.contains(btn) guard keeps cleanup safe.
 */
function startCapture(btn: HTMLButtonElement, onChange: (v: unknown) => void): void {
  if (btn.classList.contains("recording")) return;
  btn.textContent = "Press a key…";
  btn.classList.add("recording");

  function onKey(e: KeyboardEvent): void {
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    stop();
    if (e.key === "Escape") return;
    const acc = buildAccelerator(e);
    if (acc) onChange(acc);
  }

  function stop(): void {
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("blur", stop);
    if (document.contains(btn)) {
      btn.textContent = "Record";
      btn.classList.remove("recording");
    }
  }

  document.addEventListener("keydown", onKey, true);
  window.addEventListener("blur", stop, { once: true });
}

/**
 * Renders the keybind controls (badge + Record + Clear) for one field. The
 * surrounding `kit-row`/label is built by fieldRow so keybinds get tooltip
 * support for free. `current` feeds the display-only conflict badge.
 */
export function keybindControls(
  value: unknown,
  current: SettingsValue,
  key: string,
  onChange: (next: unknown) => void,
): TemplateResult {
  const acc = (value as string | null | undefined) ?? null;
  const conflict = findKeybindConflict(current, key, value);
  const badgeClass = "kit-keybind-badge" + (conflict ? " kit-keybind-badge--conflict" : "");
  return html`
    <span class="kit-keybind-row">
      <span
        class=${badgeClass}
        title=${conflict ? "Same chord as another binding" : ""}
        >${acc ?? "Not set"}</span
      >
      <button
        type="button"
        class="kit-btn-secondary kit-keybind-record-btn"
        @click=${(e: MouseEvent) =>
          startCapture(e.currentTarget as HTMLButtonElement, onChange)}
      >
        Record
      </button>
      ${acc
        ? html`<button
            type="button"
            class="kit-btn-secondary"
            @click=${() => onChange(null)}
          >
            Clear
          </button>`
        : ""}
    </span>
  `;
}
