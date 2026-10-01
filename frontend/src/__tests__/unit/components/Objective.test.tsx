import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import Objective from "../../../components/Objective";

// Matches a short "Mon D" / "Mon DD" date label (e.g. "Aug 21") without
// pinning down exactly which formatting call (toLocaleDateString, a manual
// Intl.DateTimeFormat, etc.) the builder chooses to produce it.
const SHORT_DATE_LABEL =
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/;

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
    const sameData = { id: 42, isTask: true };

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

  // --- color-coding by objective type (task/objective/empty variant) ---
  //
  // vite.config.ts does not enable test.css, so jsdom never applies real
  // stylesheet rules here — the component sets colors via an inline `style`
  // object specifically so these tests can assert on `node.style.*` /
  // `data-variant` directly instead of computed CSS.

  it("renders with the task color when data.isTask is true", () => {
    const { container } = renderObjective({ isTask: true });

    const node = container.firstElementChild as HTMLElement;
    expect(node.getAttribute("data-variant")).toBe("task");
    expect(node.style.backgroundColor).toBe("var(--node-task-bg)");
    expect(node.style.border).toContain("var(--node-task-border)");
  });

  it("renders with the objective color when data.isTask is false", () => {
    const { container } = renderObjective({ isTask: false });

    const node = container.firstElementChild as HTMLElement;
    expect(node.getAttribute("data-variant")).toBe("objective");
    expect(node.style.backgroundColor).toBe("var(--node-objective-bg)");
    expect(node.style.border).toContain("var(--node-objective-border)");
  });

  it("renders with the empty color when data has no isTask key (fresh placeholder node)", () => {
    const { container } = renderObjective({});

    const node = container.firstElementChild as HTMLElement;
    expect(node.getAttribute("data-variant")).toBe("empty");
    expect(node.style.backgroundColor).toBe("var(--node-empty-bg)");
    expect(node.style.border).toContain("var(--node-empty-border)");
  });

  it("renders with the empty color when data.isTask is explicitly null", () => {
    // Defensive case: API responses or local state could carry `isTask: null`
    // rather than omitting the key entirely — this must still fall back to "empty".
    const { container } = renderObjective({ isTask: null });

    const node = container.firstElementChild as HTMLElement;
    expect(node.getAttribute("data-variant")).toBe("empty");
    expect(node.style.backgroundColor).toBe("var(--node-empty-bg)");
  });

  it("uses visibly different colors for the task, objective, and empty variants", () => {
    // Programmatic check that the three variants are actually distinguishable,
    // not just structurally different attribute values that happen to render
    // the same color.
    const taskNode = renderObjective({ isTask: true }).container
      .firstElementChild as HTMLElement;
    cleanup();
    const objectiveNode = renderObjective({ isTask: false }).container
      .firstElementChild as HTMLElement;
    cleanup();
    const emptyNode = renderObjective({}).container
      .firstElementChild as HTMLElement;

    const colors = [
      taskNode.style.backgroundColor,
      objectiveNode.style.backgroundColor,
      emptyNode.style.backgroundColor,
    ];
    expect(new Set(colors).size).toBe(3);

    const borders = [
      taskNode.style.border,
      objectiveNode.style.border,
      emptyNode.style.border,
    ];
    expect(new Set(borders).size).toBe(3);
  });

  // --- deadline badge (data.deadlineEnd) ---
  //
  // Fixture: "2026-08-21T12:00:00.000Z" — noon UTC, not midnight. Formatting
  // a date at local-midnight can roll to the previous/next calendar day
  // depending on the runner's timezone offset; noon UTC leaves a wide margin
  // (roughly UTC-11 through UTC+13) where the formatted local calendar day
  // still reads "Aug 21" regardless of the CI machine's timezone. Only the
  // month + day are asserted, per the plan (no year, no time, no
  // deadlineStart, no tooltip, no overdue color-coding).

  it("renders a badge with the formatted deadlineEnd date when present", () => {
    renderObjective({ deadlineEnd: "2026-08-21T12:00:00.000Z" });

    // Structure-agnostic: this queries by visible text rather than assuming
    // the badge is nested inside or a sibling of the circular node div, since
    // that DOM placement is left to the builder (see report re: coordination
    // with container.firstElementChild in the pre-existing tests above).
    const badge = screen.getByText("Aug 21");
    expect(badge).toBeInTheDocument();
  });

  it("renders no badge when data.deadlineEnd is absent", () => {
    renderObjective({ isTask: true });

    expect(screen.queryByText(SHORT_DATE_LABEL)).not.toBeInTheDocument();
  });

  it("renders no badge when data itself is undefined (defensive, e.g. stale in-memory node data)", () => {
    // Bypasses the renderObjective helper (which defaults data to `{}`) to
    // exercise the `data` prop being entirely omitted, mirroring the
    // component's existing `data?.id` / `data?.isTask` optional-chaining.
    render(
      <ReactFlowProvider>
        <Objective />
      </ReactFlowProvider>,
    );

    expect(screen.queryByText(SHORT_DATE_LABEL)).not.toBeInTheDocument();
  });
});
