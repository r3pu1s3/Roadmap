import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CanvasExitButton from "../../../components/CanvasExitButton";

describe("CanvasExitButton", () => {
  afterEach(() => {
    cleanup();
  });

  // --- always visible ---
  // Unlike CanvasErrorBanner, this component has no conditional-null case:
  // it must always render the Exit button regardless of props.

  it("renders a button with the accessible name 'Exit'", () => {
    render(<CanvasExitButton onExit={() => {}} />);

    expect(screen.getByRole("button", { name: "Exit" })).toBeInTheDocument();
  });

  // --- click behavior ---

  it("calls onExit exactly once when the Exit button is clicked", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(<CanvasExitButton onExit={onExit} />);

    await user.click(screen.getByRole("button", { name: "Exit" }));

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  // --- disabled state ---
  // The plan lets the Map page disable Exit (e.g. mid-save/hydration), so the
  // button must reflect the `disabled` prop rather than always being clickable.

  it("is disabled when disabled={true} is passed", () => {
    render(<CanvasExitButton onExit={() => {}} disabled={true} />);

    expect(screen.getByRole("button", { name: "Exit" })).toBeDisabled();
  });

  it("is not disabled when disabled is omitted", () => {
    render(<CanvasExitButton onExit={() => {}} />);

    expect(screen.getByRole("button", { name: "Exit" })).not.toBeDisabled();
  });

  it("is not disabled when disabled={false} is passed explicitly", () => {
    render(<CanvasExitButton onExit={() => {}} disabled={false} />);

    expect(screen.getByRole("button", { name: "Exit" })).not.toBeDisabled();
  });

  // --- disabled button should not trigger onExit ---
  // A disabled button shouldn't fire click handlers even if something
  // dispatches a click event against it (defense against regressions where
  // `disabled` is styled visually but not wired to the actual attribute).
  it("does not call onExit when clicked while disabled", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(<CanvasExitButton onExit={onExit} disabled={true} />);

    await user.click(screen.getByRole("button", { name: "Exit" }));

    expect(onExit).not.toHaveBeenCalled();
  });
});
