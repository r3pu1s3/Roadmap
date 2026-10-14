import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HabitCreate from "../../../pages/HabitCreate";
import { createHabit, type HabitResponse } from "../../../apis/HabitApi";

vi.mock("../../../apis/HabitApi");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockedCreateHabit = vi.mocked(createHabit);

// Deferred promise helper so the in-flight (saving) state can be inspected
// before the request settles.
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const savedHabit: HabitResponse = {
  id: 1,
  name: "Morning run",
  description: "Easy pace",
  durationMinutes: 75,
};

// Fills step 1 and moves to step 2.
async function completeStep1(
  user: ReturnType<typeof userEvent.setup>,
  name = "Morning run",
  description = "Easy pace",
) {
  if (name) await user.type(screen.getByLabelText("Name"), name);
  if (description) {
    await user.type(screen.getByLabelText("Description"), description);
  }
  await user.click(screen.getByRole("button", { name: "Next" }));
}

// Fills step 2 and moves to step 3 (Review).
async function completeStep2(
  user: ReturnType<typeof userEvent.setup>,
  hours = "1",
  minutes = "15",
) {
  if (hours) await user.type(screen.getByLabelText("Hours"), hours);
  if (minutes) await user.type(screen.getByLabelText("Minutes"), minutes);
  await user.click(screen.getByRole("button", { name: "Next" }));
}

describe("HabitCreate", () => {
  beforeEach(() => {
    mockedCreateHabit.mockReset();
    mockNavigate.mockReset();
  });

  // Vitest runs without `test.globals`, so RTL's auto-cleanup never registers
  // (see MapForm.test.tsx) — clean up explicitly to keep tests isolated.
  afterEach(() => {
    cleanup();
  });

  // --- step 1: details ---

  it("starts on step 1 with Name and Description fields", () => {
    render(<HabitCreate />);

    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("stays on step 1 and shows an error when Next is pressed with no name", async () => {
    const user = userEvent.setup();
    render(<HabitCreate />);

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("stays on step 1 when the name is over 100 characters", async () => {
    const user = userEvent.setup();
    render(<HabitCreate />);

    await completeStep1(user, "a".repeat(101), "");

    expect(
      screen.getByText("Name must be 100 characters or fewer"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("stays on step 1 when the description is over 280 characters", async () => {
    const user = userEvent.setup();
    render(<HabitCreate />);

    await completeStep1(user, "Run", "a".repeat(281));

    expect(
      screen.getByText("Description must be 280 characters or fewer"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  // --- step 2: length of time ---

  it("moves to step 2 with the hours/minutes inputs once step 1 is valid", async () => {
    const user = userEvent.setup();
    render(<HabitCreate />);

    await completeStep1(user);

    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Hours")).toBeInTheDocument();
    expect(screen.getByLabelText("Minutes")).toBeInTheDocument();
  });

  it("stays on step 2 and shows an error for a zero length of time", async () => {
    const user = userEvent.setup();
    render(<HabitCreate />);

    await completeStep1(user);
    await completeStep2(user, "0", "0");

    expect(
      screen.getByText("Length of time must be at least 1 minute"),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
  });

  // --- step 3: review ---

  it("shows the entered name, description and formatted length on the review step", async () => {
    const user = userEvent.setup();
    render(<HabitCreate />);

    await completeStep1(user);
    await completeStep2(user);

    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
    expect(screen.getByText("Morning run")).toBeInTheDocument();
    expect(screen.getByText("Easy pace")).toBeInTheDocument();
    expect(screen.getByText("1 h 15 min")).toBeInTheDocument();
  });

  it("shows 'No description' on the review step when none was entered", async () => {
    const user = userEvent.setup();
    render(<HabitCreate />);

    await completeStep1(user, "Morning run", "");
    await completeStep2(user);

    expect(screen.getByText("No description")).toBeInTheDocument();
  });

  // --- back ---

  it("keeps every entered value when going Back from step 3 to step 1", async () => {
    const user = userEvent.setup();
    render(<HabitCreate />);

    await completeStep1(user);
    await completeStep2(user);
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Hours")).toHaveValue(1);
    expect(screen.getByLabelText("Minutes")).toHaveValue(15);

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Morning run");
    expect(screen.getByLabelText("Description")).toHaveValue("Easy pace");
  });

  // --- create ---

  it("creates the habit with trimmed values and total minutes, then returns to /habits", async () => {
    mockedCreateHabit.mockResolvedValue(savedHabit);
    const user = userEvent.setup();
    render(<HabitCreate />);

    await completeStep1(user, "  Morning run  ", "  Easy pace  ");
    await completeStep2(user);
    await user.click(screen.getByRole("button", { name: "Create habit" }));

    expect(mockedCreateHabit).toHaveBeenCalledWith({
      name: "Morning run",
      description: "Easy pace",
      durationMinutes: 75,
    });
    expect(mockNavigate).toHaveBeenCalledWith("/habits");
  });

  it("sends a null description when none was entered", async () => {
    mockedCreateHabit.mockResolvedValue(savedHabit);
    const user = userEvent.setup();
    render(<HabitCreate />);

    await completeStep1(user, "Morning run", "");
    await completeStep2(user, "", "45");
    await user.click(screen.getByRole("button", { name: "Create habit" }));

    expect(mockedCreateHabit).toHaveBeenCalledWith({
      name: "Morning run",
      description: null,
      durationMinutes: 45,
    });
  });

  it("disables the button and shows 'Creating…' while saving, so a second click sends nothing", async () => {
    const deferred = createDeferred<HabitResponse>();
    mockedCreateHabit.mockReturnValue(deferred.promise);
    const user = userEvent.setup();
    render(<HabitCreate />);

    await completeStep1(user);
    await completeStep2(user);
    await user.click(screen.getByRole("button", { name: "Create habit" }));

    const savingButton = screen.getByRole("button", { name: "Creating…" });
    expect(savingButton).toBeDisabled();
    await user.click(savingButton);
    expect(mockedCreateHabit).toHaveBeenCalledTimes(1);

    deferred.resolve(savedHabit);
  });

  it("stays on the review step, shows the error, and keeps the values when saving fails", async () => {
    mockedCreateHabit.mockRejectedValue(new Error("Server exploded"));
    const user = userEvent.setup();
    render(<HabitCreate />);

    await completeStep1(user);
    await completeStep2(user);
    await user.click(screen.getByRole("button", { name: "Create habit" }));

    expect(await screen.findByText("Server exploded")).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
    expect(screen.getByText("Morning run")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // --- cancel ---

  it.each([1, 2, 3])(
    "Cancel on step %s returns to /habits without saving or asking",
    async (step) => {
      const user = userEvent.setup();
      render(<HabitCreate />);

      if (step >= 2) await completeStep1(user);
      if (step >= 3) await completeStep2(user);
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(mockNavigate).toHaveBeenCalledWith("/habits");
      expect(mockedCreateHabit).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );
});
