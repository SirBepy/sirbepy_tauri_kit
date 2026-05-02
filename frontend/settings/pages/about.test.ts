import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "lit-html";
import { aboutPage } from "./about";

describe("aboutPage", () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    root = document.createElement("div");
    document.body.appendChild(root);
    vi.useFakeTimers();
  });

  function defaultDeps(overrides: Partial<Parameters<typeof aboutPage>[0]> = {}) {
    return {
      appName: "Test App",
      version: "1.2.3",
      developer: { name: "Tester", links: { github: "https://github.com/x" } },
      autoUpdate: "onStartup" as const,
      lastChecked: null,
      onAutoUpdateChange: () => {},
      onCheckNow: async () => {},
      onCopyLogs: async () => {},
      onBack: () => {},
      ...overrides,
    };
  }

  it("renders app name + version + developer name", () => {
    const page = aboutPage(defaultDeps());
    render(page.render(), root);
    expect(root.querySelector(".kit-about-app-name")?.textContent).toBe("Test App");
    expect(root.querySelector(".kit-about-version")?.textContent).toContain("1.2.3");
    expect(root.querySelector(".kit-dev-name")?.textContent).toContain("Tester");
  });

  it("renders developer link icons", () => {
    const page = aboutPage(defaultDeps());
    render(page.render(), root);
    const links = root.querySelectorAll(".kit-dev-link");
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("href")).toBe("https://github.com/x");
  });

  it("auto-update select reflects current value", () => {
    const page = aboutPage(defaultDeps({ autoUpdate: "immediate" }));
    render(page.render(), root);
    const sel = root.querySelector<HTMLSelectElement>('[data-key="kit-auto-update"]')!;
    expect(sel.value).toBe("immediate");
  });

  it("changing auto-update calls onAutoUpdateChange", () => {
    const changes: string[] = [];
    const page = aboutPage(defaultDeps({ onAutoUpdateChange: (m) => changes.push(m) }));
    render(page.render(), root);
    const sel = root.querySelector<HTMLSelectElement>('[data-key="kit-auto-update"]')!;
    sel.value = "never";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    expect(changes).toEqual(["never"]);
  });

  it("copy logs button is hidden initially", () => {
    const page = aboutPage(defaultDeps());
    render(page.render(), root);
    const btn = root.querySelector('[data-action="copy-logs"]');
    expect(btn).toBeFalsy();
  });

  it("5 taps on version within 3s reveals copy logs button", () => {
    const page = aboutPage(defaultDeps());
    render(page.render(), root);
    const ver = root.querySelector<HTMLElement>(".kit-about-version")!;
    for (let i = 0; i < 5; i++) {
      ver.click();
      vi.advanceTimersByTime(100);
    }
    render(page.render(), root); // re-render after state change
    const btn = root.querySelector('[data-action="copy-logs"]');
    expect(btn).toBeTruthy();
  });

  it("taps spaced beyond 3s reset the counter", () => {
    const page = aboutPage(defaultDeps());
    render(page.render(), root);
    const ver = root.querySelector<HTMLElement>(".kit-about-version")!;
    for (let i = 0; i < 4; i++) {
      ver.click();
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(3500); // > 3s gap
    ver.click(); // 5th tap, but counter reset
    render(page.render(), root);
    const btn = root.querySelector('[data-action="copy-logs"]');
    expect(btn).toBeFalsy();
  });
});
