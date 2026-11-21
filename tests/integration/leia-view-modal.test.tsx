import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { LeiaViewModal } from "../../src/components/LeiaViewModal";
import type { Leia } from "../../src/models/Leia";

vi.mock("../../src/context/useAuth", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@example.com", role: "admin" },
  }),
}));

vi.mock("../../src/hooks/useApiKeys", () => ({
  useApiKeys: () => ({
    apiKeys: [],
    isLoading: false,
    error: null,
    getDefaultKey: () => null,
  }),
}));

vi.mock("../../src/context/ImageRegenerationContext", () => ({
  useImageRegeneration: () => ({
    leias: {},
    jobs: {},
    starting: new Set(),
    refresh: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
  }),
}));

function buildLeia(conversationDynamics?: Leia["spec"]["behaviour"]["spec"]["conversationDynamics"]): Leia {
  return {
    id: "leia-1",
    apiVersion: "v1",
    metadata: { name: "Test LEIA", version: "1.0.0" },
    isPublished: true,
    createdAt: "",
    updatedAt: "",
    user: { id: "admin-1", email: "admin@example.com", role: "admin" } as Leia["user"],
    spec: {
      problem: {
        id: "prob-1",
        apiVersion: "v1",
        metadata: { name: "Problem", version: "1.0.0" },
        spec: { description: "Problem desc", solution: "", solutionFormat: "text" },
        isPublished: true,
        createdAt: "",
        updatedAt: "",
        user: { id: "admin-1" } as Leia["user"],
      },
      persona: {
        id: "pers-1",
        apiVersion: "v1",
        metadata: { name: "Persona", version: "1.0.0" },
        spec: {
          fullName: "Ada Lovelace",
          firstName: "Ada",
          description: "Mathematician",
          personality: "Curious",
          subjectPronoum: "she",
          objectPronoum: "her",
          possesivePronoum: "hers",
          possesiveAdjective: "her",
        },
        isPublished: true,
        createdAt: "",
        updatedAt: "",
        user: { id: "admin-1" } as Leia["user"],
      },
      behaviour: {
        id: "beh-1",
        apiVersion: "v1",
        metadata: { name: "Behaviour", version: "1.0.0" },
        spec: {
          description: "Behaviour description",
          role: "Tutor",
          process: ["Listen", "Guide"],
          conversationDynamics,
        },
        isPublished: true,
        createdAt: "",
        updatedAt: "",
        user: { id: "admin-1" } as Leia["user"],
      },
    },
  };
}

describe("LeiaViewModal behaviour conversation dynamics", () => {
  test("shows enabled conversation dynamics in the Behaviour tab", () => {
    const leia = buildLeia({
      leiaSpeaksFirst: { enabled: true, config: { firstMessage: "Welcome! Let's begin." } },
      stoppingCondition: { enabled: false, config: { condition: "Should not appear" } },
    });

    render(<LeiaViewModal leia={leia} isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /behaviour/i }));

    expect(screen.getByText("Conversation Dynamics")).toBeTruthy();
    expect(screen.getByText("LEIA Speaks First")).toBeTruthy();
    expect(screen.getByText("Welcome! Let's begin.")).toBeTruthy();
    expect(screen.queryByText("Stopping Condition")).toBeNull();
    expect(screen.queryByText("Should not appear")).toBeNull();
  });

  test("omits Conversation Dynamics section when none are enabled", () => {
    const leia = buildLeia({
      leiaSpeaksFirst: { enabled: false, config: { firstMessage: "Hidden" } },
    });

    render(<LeiaViewModal leia={leia} isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /behaviour/i }));

    expect(screen.queryByText("Conversation Dynamics")).toBeNull();
  });
});
