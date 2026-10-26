import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HabitList from "../../../pages/HabitList";
import { getHabits, type HabitResponse } from "../../../apis/HabitApi";

vi.mock("../../../apis/HabitApi");

const mockedGetHabits = vi.mocked(getHabits);

// Deliberately not alphabetical: the page must keep the API's order (the
// backend owns sorting), not re-sort.
const habits: HabitResponse[] = [
  { id: 3, name: "Read", description: null, durationMinutes: 30, period: null },
  {
    id: 1,
    name: "Meditate",
    description: "Breathing",
    durationMinutes: 15,
    period: null,
  },
  { id: 2, name: "Run", description: null, durationMinutes: 75, period: null },
];

function renderList() {
  return render(
    <MemoryRouter>
      <HabitList />
    </MemoryRouter>,
  );
}

describe("HabitList", () => {
  beforeEach(() => {
    mockedGetHabits.mockReset();
  });

  // Vitest runs without `test.globals`, so RTL's auto-cleanup never registers
  // (see MapForm.test.tsx) — clean up explicitly to keep tests isolated.
  afterEach(() => {
    cleanup();
  });

  // --- header ---

  it("shows the Habits title and a create link to /habits/new", () => {
    mockedGetHabits.mockReturnValue(new Promise(() => {}));
    renderList();

    expect(screen.getByText("Habits")).toBeInTheDocument();
    const createLink = screen.getByLabelText("Create habit");
    expect(createLink).toHaveTextContent("+ New Habit");
    expect(createLink).toHaveAttribute("href", "/habits/new");
  });

  // --- loading state ---

  it("shows the loading status while getHabits() is pending", () => {
    mockedGetHabits.mockReturnValue(new Promise(() => {}));
    renderList();

    expect(mockedGetHabits).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Loading habits…")).toBeInTheDocument();
  });

  // --- loaded state ---

  it("renders one block per habit, in the order the API returns them", async () => {
    mockedGetHabits.mockResolvedValue(habits);
    renderList();

    await screen.findByText("Read");
    const links = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.match(/^\/habits\/\d+$/));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/habits/3",
      "/habits/1",
      "/habits/2",
    ]);
    expect(screen.getByText("1 h 15 min")).toBeInTheDocument();
    expect(screen.queryByText("Loading habits…")).not.toBeInTheDocument();
  });

  // --- empty state ---

  it("shows the empty-state message when there are no habits", async () => {
    mockedGetHabits.mockResolvedValue([]);
    renderList();

    expect(
      await screen.findByText(
        "No habits yet — press + New Habit to create one.",
      ),
    ).toBeInTheDocument();
  });

  // --- error state ---

  it("shows the error message and no list when getHabits() rejects", async () => {
    mockedGetHabits.mockRejectedValue(new Error("Server exploded"));
    renderList();

    expect(await screen.findByText("Server exploded")).toBeInTheDocument();
    expect(
      screen.queryByText("No habits yet — press + New Habit to create one."),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1); // only "+ New Habit"
  });

  it("shows a fallback message when getHabits() rejects with a non-Error", async () => {
    mockedGetHabits.mockRejectedValue("boom");
    renderList();

    expect(
      await screen.findByText("Failed to load habits"),
    ).toBeInTheDocument();
  });
});
