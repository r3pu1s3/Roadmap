import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HabitItem from "../../../components/HabitItem";
import type { HabitResponse } from "../../../apis/HabitApi";

const habit: HabitResponse = {
  id: 7,
  name: "Morning run",
  description: "Easy pace",
  durationMinutes: 75,
  period: null,
};

function renderItem(h: HabitResponse = habit) {
  return render(
    <MemoryRouter>
      <HabitItem habit={h} />
    </MemoryRouter>,
  );
}

describe("HabitItem", () => {
  // Vitest runs without `test.globals`, so RTL's auto-cleanup never registers
  // (see MapForm.test.tsx) — clean up explicitly to keep tests isolated.
  afterEach(() => {
    cleanup();
  });

  it("shows the habit's name", () => {
    renderItem();
    expect(screen.getByText("Morning run")).toBeInTheDocument();
  });

  it("shows the length of time formatted as hours and minutes", () => {
    renderItem();
    expect(screen.getByText("1 h 15 min")).toBeInTheDocument();
  });

  it("shows minutes only for a habit under an hour", () => {
    renderItem({ ...habit, durationMinutes: 30 });
    expect(screen.getByText("30 min")).toBeInTheDocument();
  });

  it("shows a habit with no period as One-time", () => {
    renderItem({ ...habit, period: null });
    expect(screen.getByText("One-time")).toBeInTheDocument();
  });

  it("shows a preset period by name", () => {
    renderItem({ ...habit, period: "monthly" });
    expect(screen.getByText("Monthly")).toBeInTheDocument();
  });

  it("shows a custom period as exact hours", () => {
    renderItem({ ...habit, period: 1.5 });
    expect(screen.getByText("Every 1.5 h")).toBeInTheDocument();
  });

  it("shows the period after the length of time", () => {
    renderItem({ ...habit, period: "weekly" });
    const duration = screen.getByText("1 h 15 min");
    const period = screen.getByText("Weekly");
    expect(
      duration.compareDocumentPosition(period) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("is a link to that habit's update page", () => {
    renderItem();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/habits/7");
  });
});
