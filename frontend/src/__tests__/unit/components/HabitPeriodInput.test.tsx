import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import HabitPeriodInput from "../../../components/HabitPeriodInput";

describe("HabitPeriodInput", () => {
  // Vitest runs without `test.globals`, so RTL's auto-cleanup never registers
  // (see MapForm.test.tsx) — clean up explicitly to keep tests isolated.
  afterEach(() => {
    cleanup();
  });

  it("renders a Period select with the choices in order", () => {
    render(<HabitPeriodInput choice="none" hours="" onChange={vi.fn()} />);

    const select = screen.getByLabelText("Period");
    const options = Array.from(select.querySelectorAll("option"), (option) => [
      option.value,
      option.textContent,
    ]);
    expect(options).toEqual([
      ["none", "None"],
      ["daily", "Daily"],
      ["weekly", "Weekly"],
      ["monthly", "Monthly"],
      ["yearly", "Yearly"],
      ["custom", "Custom"],
    ]);
  });

  it("selects the option matching the choice prop", () => {
    render(<HabitPeriodInput choice="weekly" hours="" onChange={vi.fn()} />);

    expect(screen.getByLabelText("Period")).toHaveValue("weekly");
  });

  it.each(["none", "daily", "weekly", "monthly", "yearly"] as const)(
    "does not render an Hours input when the choice is %s",
    (choice) => {
      render(<HabitPeriodInput choice={choice} hours="5" onChange={vi.fn()} />);

      expect(screen.queryByLabelText("Period hours")).not.toBeInTheDocument();
    },
  );

  it("renders an Hours number input for Custom, showing the hours prop", () => {
    render(<HabitPeriodInput choice="custom" hours="1.5" onChange={vi.fn()} />);

    // Visibly labelled "Hours"; announced as "Period hours" so it can't be
    // confused with the duration's Hours field on the update page.
    expect(screen.getByText("Hours")).toBeInTheDocument();
    const hours = screen.getByLabelText("Period hours");
    expect(hours).toHaveAttribute("type", "number");
    expect(hours).toHaveAttribute("min", "1");
    expect(hours).toHaveAttribute("max", "8766");
    expect(hours).toHaveAttribute("step", "any");
    expect(hours).toHaveValue(1.5);
  });

  it("reports a new choice and keeps the current hours", () => {
    const onChange = vi.fn();
    render(<HabitPeriodInput choice="custom" hours="12" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Period"), {
      target: { value: "monthly" },
    });

    expect(onChange).toHaveBeenCalledWith({ choice: "monthly", hours: "12" });
  });

  it("reports typed hours with the Custom choice", () => {
    const onChange = vi.fn();
    render(<HabitPeriodInput choice="custom" hours="" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Period hours"), {
      target: { value: "36" },
    });

    expect(onChange).toHaveBeenCalledWith({ choice: "custom", hours: "36" });
  });
});
