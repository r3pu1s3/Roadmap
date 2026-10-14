import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import HabitDurationInput from "../../../components/HabitDurationInput";

describe("HabitDurationInput", () => {
  // Vitest runs without `test.globals`, so RTL's auto-cleanup never registers
  // (see MapForm.test.tsx) — clean up explicitly to keep tests isolated.
  afterEach(() => {
    cleanup();
  });

  it("renders labelled Hours and Minutes number inputs showing the props", () => {
    render(<HabitDurationInput hours="1" minutes="15" onChange={vi.fn()} />);

    const hours = screen.getByLabelText("Hours");
    const minutes = screen.getByLabelText("Minutes");
    expect(hours).toHaveAttribute("type", "number");
    expect(minutes).toHaveAttribute("type", "number");
    expect(hours).toHaveValue(1);
    expect(minutes).toHaveValue(15);
  });

  it("reports a new hours value with minutes unchanged", () => {
    const onChange = vi.fn();
    render(<HabitDurationInput hours="1" minutes="15" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Hours"), {
      target: { value: "2" },
    });

    expect(onChange).toHaveBeenCalledWith({ hours: "2", minutes: "15" });
  });

  it("reports a new minutes value with hours unchanged", () => {
    const onChange = vi.fn();
    render(<HabitDurationInput hours="1" minutes="15" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Minutes"), {
      target: { value: "30" },
    });

    expect(onChange).toHaveBeenCalledWith({ hours: "1", minutes: "30" });
  });

  it("keeps no state of its own: new props replace the shown values", () => {
    const { rerender } = render(
      <HabitDurationInput hours="1" minutes="15" onChange={vi.fn()} />,
    );

    rerender(<HabitDurationInput hours="3" minutes="5" onChange={vi.fn()} />);

    expect(screen.getByLabelText("Hours")).toHaveValue(3);
    expect(screen.getByLabelText("Minutes")).toHaveValue(5);
  });

  it("shows empty fields when given empty strings", () => {
    render(<HabitDurationInput hours="" minutes="" onChange={vi.fn()} />);

    expect(screen.getByLabelText("Hours")).toHaveValue(null);
    expect(screen.getByLabelText("Minutes")).toHaveValue(null);
  });
});
