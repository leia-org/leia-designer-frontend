import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";

const auth = vi.hoisted(() => ({ role: "advanced" }));

vi.mock("../../src/context/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "user@example.com", role: auth.role },
    logout: vi.fn(),
  }),
}));

import { DesignerSidebar } from "../../src/components/shared/DesignerSidebar";

const renderSidebar = (role: string) => {
  auth.role = role;
  return render(
    <MemoryRouter>
      <DesignerSidebar />
    </MemoryRouter>,
  );
};

// The library Design tour (LeiaSearch) anchors its last steps to these ids.
describe("DesignerSidebar guided tour targets", () => {
  test.each(["admin", "advanced"])("exposes every tour target for %s users", (role) => {
    const { container } = renderSidebar(role);

    expect(container.querySelector("#sidebar-navigation")).not.toBeNull();
    expect(container.querySelector("#myApiKeys-button")?.textContent).toBe("API keys");
    expect(container.querySelector("#myActivities-button")?.textContent).toBe("Activities");
  });

  test("keeps the API keys target and hides Activities for instructors", () => {
    const { container } = renderSidebar("instructor");

    expect(container.querySelector("#sidebar-navigation")).not.toBeNull();
    expect(container.querySelector("#myApiKeys-button")?.textContent).toBe("API keys");
    expect(container.querySelector("#myActivities-button")).toBeNull();
  });
});
