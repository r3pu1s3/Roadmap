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

  it("is a link to that habit's update page", () => {
    renderItem();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/habits/7");
  });
});
