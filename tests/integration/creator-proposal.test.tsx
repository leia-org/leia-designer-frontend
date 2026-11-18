import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProblemChatPanel } from "../../src/components/ProblemChatPanel";
import type { CreatorDraft } from "../../src/lib/creatorCommands";
import { sendProblemChatMessage } from "../../src/lib/problemChat";
import type { User } from "../../src/models/User";

vi.mock("../../src/lib/problemChat", () => ({
  openProblemChat: vi.fn(async () => "creator-chat"),
  sendProblemChatMessage: vi.fn(),
  uploadProblemChatFile: vi.fn(),
}));

const owner: User = { id: "owner", email: "owner@example.com", role: "advanced", createdAt: "", updatedAt: "" };
const description = "Interview {{persona.fullName}} about {{problem.description}}.";
const original: CreatorDraft = {
  config: {
    persona: {
      id: "carlos-mendez", apiVersion: "v1", metadata: { name: "carlos-mendez", version: "1.0.0" },
      spec: { fullName: "Carlos Méndez", firstName: "Carlos", description: "Support customer", personality: "Impatient", subjectPronoum: "he", objectPronoum: "him", possesivePronoum: "his", possesiveAdjective: "his" },
      user: owner, createdAt: "", updatedAt: "", isPublished: false,
    },
    problem: {
      id: "router-connectivity", apiVersion: "v1", metadata: { name: "router-connectivity", version: "1.0.0" },
      spec: { description: "Diagnose a router connectivity issue.", personaBackground: "Home internet is down.", details: "The wireless network is visible.", solution: "Reset the router.", initialSolution: "", solutionFormat: "text", process: ["requirements-elicitation"], extends: {}, overrides: {}, constrainedTo: {} },
      user: owner, createdAt: "", updatedAt: "", isPublished: false,
    },
    behaviour: {
      id: "generated-support-customer", apiVersion: "v1", edited: true,
      metadata: { name: "angry-support-customer", version: "1.0.0" },
      spec: { description, role: "Angry support customer", process: ["requirements-elicitation"] },
      user: owner, createdAt: "", updatedAt: "", isPublished: false,
    },
  },
  customizations: { leia: { name: "Router support roleplay" } },
  nameManuallyEdited: true,
};

function Creator() {
  const [draft, setDraft] = useState(original);
  return (
    <>
      <ProblemChatPanel
        draft={draft} user={owner} behaviours={[]} personas={[]} problems={[]}
        canEditBehaviour modelName="fixture-model" apiKeyId="fixture-key"
        onApplyProposal={proposal => setDraft(current => current === proposal.base ? proposal.next : current)}
      />
      <div data-testid="behaviour">{draft.config.behaviour?.spec.description}</div>
      <div data-testid="persona">{draft.config.persona?.spec.fullName}</div>
      <div data-testid="title">{draft.customizations.leia.name}</div>
      <button onClick={() => setDraft(previous => ({
        ...previous,
        customizations: { leia: { name: "New manual title" } },
      }))}>Rename draft</button>
    </>
  );
}

async function propose(instruction: string) {
  vi.mocked(sendProblemChatMessage)
    .mockResolvedValueOnce({ toolCalls: [
      { callId: "edit-1", name: "edit_behaviour", arguments: JSON.stringify({ changes: {}, appendInstructions: instruction }) },
    ] })
    .mockResolvedValueOnce({ message: "Here is the proposed change." });
  fireEvent.change(screen.getByRole("textbox", { name: "Message the assistant" }), { target: { value: instruction } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  return screen.findByRole("region", { name: "Proposed draft changes" });
}

describe("Creator proposal review", () => {
  it("shows the exact guardrail and applies it only on approval, keeping earlier instructions", async () => {
    render(<Creator />);
    const stayInCharacter = "Stay in character as a real customer.";
    const plainText = "Reply in plain text without Markdown.";

    const first = await propose(stayInCharacter);
    expect(within(first).getByText(stayInCharacter)).toBeTruthy();
    expect(screen.getByTestId("behaviour").textContent).toBe(description);
    fireEvent.click(within(first).getByRole("button", { name: "Apply changes" }));

    const second = await propose(plainText);
    expect(within(second).getByText(plainText)).toBeTruthy();
    expect(screen.getByTestId("behaviour").textContent).toBe(`${description}\n\n${stayInCharacter}`);
    fireEvent.click(within(second).getByRole("button", { name: "Apply changes" }));
    expect(screen.getByTestId("behaviour").textContent).toBe(`${description}\n\n${stayInCharacter}\n\n${plainText}`);
    expect(screen.getByTestId("title").textContent).toBe("Router support roleplay");
    expect(screen.getByTestId("persona").textContent).toBe("Carlos Méndez");
  });

  it("lets the user revise or discard and invalidates a proposal on manual edits", async () => {
    render(<Creator />);
    const first = await propose("Be concise.");
    fireEvent.click(within(first).getByRole("button", { name: "Ask for changes" }));
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Message the assistant" }));
    const revised = await propose("Use short sentences.");
    expect(within(revised).queryByText("Be concise.")).toBeNull();
    fireEvent.click(within(revised).getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("region", { name: "Proposed draft changes" })).toBeNull();
    expect(screen.getByTestId("behaviour").textContent).toBe(description);

    await propose("Use short sentences.");
    fireEvent.click(screen.getByRole("button", { name: "Rename draft" }));
    expect(screen.getByRole("alert").textContent).toContain("The draft changed.");
    expect(screen.queryByRole("button", { name: "Apply changes" })).toBeNull();
    expect(screen.getByTestId("behaviour").textContent).toBe(description);
    expect(screen.getByTestId("title").textContent).toBe("New manual title");
  });
});
