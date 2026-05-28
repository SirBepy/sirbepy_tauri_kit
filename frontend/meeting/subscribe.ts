export interface MeetingSources {
  camera: boolean;
  mic: boolean;
  audio: boolean;
}

export interface MeetingState {
  active: boolean;
  sources: MeetingSources;
}

/**
 * Subscribe to raw meeting-detection edges emitted by tauri_kit_meeting.
 * The kit emits only on transitions; it does NOT latch. Returns the unlisten fn.
 */
export async function onMeetingChanged(
  cb: (state: MeetingState) => void,
): Promise<() => void> {
  const { listen } = (window as any).__TAURI__.event;
  return listen("meeting://changed", (e: { payload: MeetingState }) => cb(e.payload));
}
