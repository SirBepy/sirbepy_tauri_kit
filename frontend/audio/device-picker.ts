// Reusable audio-output device <select> populator for SirBepy Tauri apps.
//
// Dependency-free on purpose: the consuming app fetches the device list from
// its own Tauri command and passes it in, mirroring the kit's "app supplies
// the data, kit renders" pattern. The device shape is structural so the app's
// generated `AudioOutputDevice` type is assignable without a duplicate.

export interface KitAudioOutputDevice {
  name: string;
  is_default: boolean;
}

/**
 * Fill a <select> with "System default" + every output device. Marks the OS
 * default with "(current)", selects `current`, and if `current` names a device
 * that is no longer present, prepends a selected "(not found)" entry so the
 * user can see their stale preference instead of it silently resetting.
 */
export function populateAudioDevicePicker(
  sel: HTMLSelectElement,
  devices: KitAudioOutputDevice[],
  current: string,
): void {
  const opts = ['<option value="">System default</option>'];
  for (const d of devices) {
    const suffix = d.is_default ? " (current)" : "";
    const selected = d.name === current ? " selected" : "";
    opts.push(`<option value="${d.name}"${selected}>${d.name}${suffix}</option>`);
  }
  sel.innerHTML = opts.join("");

  if (current && !devices.find((d) => d.name === current)) {
    const missing = document.createElement("option");
    missing.value = current;
    missing.textContent = `${current} (not found)`;
    missing.selected = true;
    sel.prepend(missing);
  }
}
