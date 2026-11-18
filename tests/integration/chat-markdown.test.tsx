import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMarkdown } from "../../src/components/ChatMarkdown";

describe("LEIA chat Markdown", () => {
  it("renders a structured reply with a link, code, and a table", () => {
    render(<ChatMarkdown text={[
      "## Example",
      "",
      "- **Important**",
      "- Read the [guide](https://leia.ovh/docs/).",
      "",
      "```js",
      "if (ready) {",
      "  run();",
      "}",
      "```",
      "",
      "| Field | Value |",
      "| --- | --- |",
      "| Mode | test |",
    ].join("\n")} />);

    expect(screen.getByRole("heading", { name: "Example" })).toBeTruthy();
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Important").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "guide" }).getAttribute("href")).toBe("https://leia.ovh/docs/");
    expect(screen.getByText(/if \(ready\)/).closest("pre")?.textContent).toContain("\n  run();\n");
    expect(within(screen.getByRole("table")).getByRole("cell", { name: "test" })).toBeTruthy();
  });

  it("keeps HTML inert and does not load images or expose unsafe links", () => {
    const { container } = render(<ChatMarkdown text={[
      "<b>raw HTML</b>",
      "",
      "[unsafe](javascript:alert%281%29)",
      "",
      "![Image description](https://example.com/pixel.png)",
    ].join("\n")} />);

    expect(screen.getByText("<b>raw HTML</b>")).toBeTruthy();
    expect(screen.getByText("unsafe")).toBeTruthy();
    expect(screen.getByText("Image description")).toBeTruthy();
    expect(container.querySelector("b, a, img")).toBeNull();
  });

  it("keeps footnote links inside the message that owns them", () => {
    const { container } = render(
      <>
        <ChatMarkdown text={"First[^1]\n\n[^1]: First note."} />
        <ChatMarkdown text={"Second[^1]\n\n[^1]: Second note."} />
      </>,
    );
    const links = screen.getAllByRole("link", { name: "1" });
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).not.toBe(links[1].getAttribute("href"));

    links.forEach((link, index) => {
      const id = link.getAttribute("href")?.slice(1);
      expect(container.ownerDocument.getElementById(id ?? "")?.textContent).toContain(index === 0 ? "First note." : "Second note.");
      const descriptionId = link.getAttribute("aria-describedby");
      expect(container.ownerDocument.getElementById(descriptionId ?? "")?.textContent).toBe("Footnotes");
    });
  });
});
