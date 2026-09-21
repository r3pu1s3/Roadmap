import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import Objective from "../../../components/Objective";

// Objective is a React Flow custom node component. Handle (from @xyflow/react)
// reads from React Flow's internal store via context, so it throws
// ("Seems like you have not used ReactFlowProvider as an ancestor") unless
// rendered inside a ReactFlowProvider — even standalone, outside an actual
// <ReactFlow> node tree.
//
// `data` mirrors the shape Map.tsx gives saved node data (`{ ...created, dbId: created.id }`,
// where `created` is an ObjectiveResponse with an `id` field) — a numeric `data.id` means
// "this node is saved". This is a loosely-typed unit test for rendering behavior, not a
// realistic React Flow NodeProps object, so we only pass what the component actually reads.
function renderObjective(data: Record<string, unknown> = {}) {
  return render(
    <ReactFlowProvider>
      <Objective data={data} />
    </ReactFlowProvider>,
  );
}

describe("Objective", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a single circular node element", () => {
    const { container } = renderObjective();

    const node = container.firstElementChild as HTMLElement;
    expect(node).not.toBeNull();
    expect(node.style.width).toBe("48px");
    expect(node.style.height).toBe("48px");
    expect(node.style.borderRadius).toBe("50%");
  });

  it("renders exactly one target handle and one source handle", () => {
    const { container } = renderObjective();

    expect(container.querySelectorAll(".react-flow__handle")).toHaveLength(2);
    expect(container.querySelectorAll(".target")).toHaveLength(1);
    expect(container.querySelectorAll(".source")).toHaveLength(1);
  });

  it("positions the source handle on top and the target handle on the bottom", () => {
    const { container } = renderObjective();

    const targetHandle = container.querySelector(".target");
    const sourceHandle = container.querySelector(".source");

    expect(sourceHandle).toHaveClass("react-flow__handle-top");
    expect(targetHandle).toHaveClass("react-flow__handle-bottom");
  });

  it("rendering twice with the same data prop produces identical markup", () => {
    const sameData = { id: 42 };

    const first = renderObjective(sameData);
    const firstHtml = first.container.innerHTML;
    cleanup();

    const second = renderObjective(sameData);
    expect(second.container.innerHTML).toBe(firstHtml);
  });

  // --- connectability driven by save state (data.id) ---

  it("makes both handles non-connectable when data has no id (unsaved node)", () => {
    const { container } = renderObjective({});

    const targetHandle = container.querySelector(".target");
    const sourceHandle = container.querySelector(".source");

    // Per @xyflow/react's Handle implementation, the "connectable" class is only
    // added when isConnectable is truthy — absent (not merely falsy-valued) otherwise.
    expect(targetHandle?.classList.contains("connectable")).toBe(false);
    expect(sourceHandle?.classList.contains("connectable")).toBe(false);
  });

  it("makes both handles connectable when data.id is a number (saved node)", () => {
    const { container } = renderObjective({ id: 42 });

    const targetHandle = container.querySelector(".target");
    const sourceHandle = container.querySelector(".source");

    expect(targetHandle?.classList.contains("connectable")).toBe(true);
    expect(sourceHandle?.classList.contains("connectable")).toBe(true);
  });
});
