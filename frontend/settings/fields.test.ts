import { describe, it, expect, vi } from "vitest";
import { render } from "lit-html";
import { fieldRow } from "./fields";
import type { FileField } from "./schema";

const field: FileField = { key: "sound", label: "Sound file", kind: "file", pickerCommand: "pick_sound" };

const renderRow = (onChange: (v: unknown) => void, pickFile?: (cmd: string) => Promise<string | null>) => {
  const root = document.createElement("div");
  render(fieldRow(field, null, onChange, {}, pickFile ? { pickFile } : {}), root);
  return root;
};

describe("fieldRow file case", () => {
  it("calls the injected pickFile with the field's pickerCommand, not the default", async () => {
    const pickFile = vi.fn().mockResolvedValue("C:/sounds/ping.wav");
    const onChange = vi.fn();
    const button = renderRow(onChange, pickFile).querySelector("button.kit-btn-secondary") as HTMLButtonElement;

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(pickFile).toHaveBeenCalledWith("pick_sound");
    expect(onChange).toHaveBeenCalledWith("C:/sounds/ping.wav");
  });

  it("does nothing when no pickFile is injected", async () => {
    const onChange = vi.fn();
    const button = renderRow(onChange).querySelector("button.kit-btn-secondary") as HTMLButtonElement;

    expect(() => button.click()).not.toThrow();
    await Promise.resolve();

    expect(onChange).not.toHaveBeenCalled();
  });
});
