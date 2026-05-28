import { describe, it, expect, vi, beforeEach } from "vitest";

const listen = vi.fn();
(globalThis as any).window = { __TAURI__: { event: { listen } } };

import { onMeetingChanged, type MeetingState } from "./subscribe";

describe("onMeetingChanged", () => {
  beforeEach(() => listen.mockReset());

  it("subscribes to meeting://changed and forwards the payload", async () => {
    let handler: (e: { payload: MeetingState }) => void = () => {};
    listen.mockImplementation((_name: string, cb: any) => {
      handler = cb;
      return Promise.resolve(() => {});
    });
    const seen: MeetingState[] = [];
    await onMeetingChanged((s) => seen.push(s));

    expect(listen).toHaveBeenCalledWith("meeting://changed", expect.any(Function));
    handler({ payload: { active: true, sources: { camera: true, mic: false, audio: false } } });
    expect(seen).toEqual([
      { active: true, sources: { camera: true, mic: false, audio: false } },
    ]);
  });
});
