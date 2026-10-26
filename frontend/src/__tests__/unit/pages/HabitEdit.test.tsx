import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import HabitEdit from "../../../pages/HabitEdit";
import {
  getHabit,
  updateHabit,
  deleteHabit,
  type HabitResponse,
} from "../../../apis/HabitApi";

vi.mock("../../../apis/HabitApi");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockedGetHabit = vi.mocked(getHabit);
const mockedUpdateHabit = vi.mocked(updateHabit);
const mockedDeleteHabit = vi.mocked(deleteHabit);

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

const habit: HabitResponse = {
  id: 7,
  name: "Morning run",
  description: "Easy pace",
  durationMinutes: 75,
  period: null,
};

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={["/habits/7"]}>
      <Routes>
        <Route path="/habits/:habitId" element={<HabitEdit />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Renders the page and waits until the habit has loaded into the form.
async function renderLoaded(h: HabitResponse = habit) {
  mockedGetHabit.mockResolvedValue(h);
  renderEdit();
  await screen.findByDisplayValue(h.name);
}

describe("HabitEdit", () => {
  beforeEach(() => {
    mockedGetHabit.mockReset();
    mockedUpdateHabit.mockReset();
    mockedDeleteHabit.mockReset();
    mockNavigate.mockReset();
  });

  // Vitest runs without `test.globals`, so RTL's auto-cleanup never registers
  // (see MapForm.test.tsx) — clean up explicitly to keep tests isolated.
  afterEach(() => {
    cleanup();
  });

  // --- loading ---

  it("loads habit 7 and shows a loading status while pending", () => {
    mockedGetHabit.mockReturnValue(new Promise(() => {}));
    renderEdit();

    expect(mockedGetHabit).toHaveBeenCalledWith(7);
    expect(screen.getByText("Loading habit…")).toBeInTheDocument();
  });

  // --- loaded ---

  it("shows Name, Description and Length of time sections pre-filled", async () => {
    await renderLoaded();

    expect(screen.getByText("Length of time")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Morning run");
    expect(screen.getByLabelText("Description")).toHaveValue("Easy pace");
    expect(screen.getByLabelText("Hours")).toHaveValue(1);
    expect(screen.getByLabelText("Minutes")).toHaveValue(15);
  });

  it("shows an empty Description field when the habit has none", async () => {
    await renderLoaded({ ...habit, description: null });

    expect(screen.getByLabelText("Description")).toHaveValue("");
  });

  // --- load errors ---

  it("shows 'Habit not found' and a link back when the habit doesn't exist", async () => {
    mockedGetHabit.mockRejectedValue(new Error("habit not found"));
    renderEdit();

    expect(await screen.findByText("Habit not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /habits/i })).toHaveAttribute(
      "href",
      "/habits",
    );
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("shows any other load error with a link back", async () => {
    mockedGetHabit.mockRejectedValue(new Error("Server exploded"));
    renderEdit();

    expect(await screen.findByText("Server exploded")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /habits/i })).toHaveAttribute(
      "href",
      "/habits",
    );
  });

  // --- save ---

  it("saves every field, trimmed, then returns to /habits", async () => {
    mockedUpdateHabit.mockResolvedValue(habit);
    const user = userEvent.setup();
    await renderLoaded();

    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "  Evening run  ");
    const minutes = screen.getByLabelText("Minutes");
    await user.clear(minutes);
    await user.type(minutes, "30");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockedUpdateHabit).toHaveBeenCalledWith(7, {
      name: "Evening run",
      description: "Easy pace",
      durationMinutes: 90,
      period: null,
    });
    expect(mockNavigate).toHaveBeenCalledWith("/habits");
  });

  it("sends a cleared description as null", async () => {
    mockedUpdateHabit.mockResolvedValue(habit);
    const user = userEvent.setup();
    await renderLoaded();

    await user.clear(screen.getByLabelText("Description"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockedUpdateHabit).toHaveBeenCalledWith(7, {
      name: "Morning run",
      description: null,
      durationMinutes: 75,
      period: null,
    });
  });

  it("disables the button and shows 'Saving…' while saving", async () => {
    const deferred = createDeferred<HabitResponse>();
    mockedUpdateHabit.mockReturnValue(deferred.promise);
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Save" }));

    const savingButton = screen.getByRole("button", { name: "Saving…" });
    expect(savingButton).toBeDisabled();
    await user.click(savingButton);
    expect(mockedUpdateHabit).toHaveBeenCalledTimes(1);

    deferred.resolve(habit);
  });

  // --- period ---

  it("shows None and no period Hours field for a one-time habit", async () => {
    await renderLoaded({ ...habit, period: null });

    expect(screen.getByLabelText("Period")).toHaveValue("none");
    expect(screen.queryByLabelText("Period hours")).not.toBeInTheDocument();
  });

  it("shows a preset period selected, with no period Hours field", async () => {
    await renderLoaded({ ...habit, period: "weekly" });

    expect(screen.getByLabelText("Period")).toHaveValue("weekly");
    expect(screen.queryByLabelText("Period hours")).not.toBeInTheDocument();
  });

  it("shows Custom with the hours filled in for a custom period", async () => {
    await renderLoaded({ ...habit, period: 36.5 });

    expect(screen.getByLabelText("Period")).toHaveValue("custom");
    expect(screen.getByLabelText("Period hours")).toHaveValue(36.5);
  });

  it("saves a changed period, then returns to /habits", async () => {
    mockedUpdateHabit.mockResolvedValue(habit);
    const user = userEvent.setup();
    await renderLoaded({ ...habit, period: "weekly" });

    await user.selectOptions(screen.getByLabelText("Period"), "monthly");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockedUpdateHabit).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ period: "monthly" }),
    );
    expect(mockNavigate).toHaveBeenCalledWith("/habits");
  });

  it("saves custom hours typed into the period Hours field", async () => {
    mockedUpdateHabit.mockResolvedValue(habit);
    const user = userEvent.setup();
    await renderLoaded({ ...habit, period: "daily" });

    await user.selectOptions(screen.getByLabelText("Period"), "custom");
    await user.type(screen.getByLabelText("Period hours"), "12");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockedUpdateHabit).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ period: 12 }),
    );
  });

  it("sends period: null when changed to None", async () => {
    mockedUpdateHabit.mockResolvedValue(habit);
    const user = userEvent.setup();
    await renderLoaded({ ...habit, period: "weekly" });

    await user.selectOptions(screen.getByLabelText("Period"), "none");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockedUpdateHabit).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ period: null }),
    );
  });

  it("sends period: null when the custom hours are cleared", async () => {
    mockedUpdateHabit.mockResolvedValue(habit);
    const user = userEvent.setup();
    await renderLoaded({ ...habit, period: 36.5 });

    await user.clear(screen.getByLabelText("Period hours"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(mockedUpdateHabit).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ period: null }),
    );
  });

  // --- validation ---

  it("shows 'Name is required' and does not save when the name is cleared", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(mockedUpdateHabit).not.toHaveBeenCalled();
  });

  it("shows the length-of-time error and does not save for an invalid duration", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.clear(screen.getByLabelText("Hours"));
    await user.clear(screen.getByLabelText("Minutes"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Length of time must be at least 1 minute"),
    ).toBeInTheDocument();
    expect(mockedUpdateHabit).not.toHaveBeenCalled();
  });

  it("shows the period error and does not save for custom hours under 1", async () => {
    const user = userEvent.setup();
    await renderLoaded({ ...habit, period: 36.5 });

    const hours = screen.getByLabelText("Period hours");
    await user.clear(hours);
    await user.type(hours, "0.5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Hours must be at least 1")).toBeInTheDocument();
    expect(mockedUpdateHabit).not.toHaveBeenCalled();
  });

  // --- save failure ---

  it("shows the error and keeps the edits when saving fails", async () => {
    mockedUpdateHabit.mockRejectedValue(new Error("Server exploded"));
    const user = userEvent.setup();
    await renderLoaded();

    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Evening run");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Server exploded")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Evening run");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // --- cancel ---

  it("Cancel returns to /habits without saving or asking", async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.type(screen.getByLabelText("Name"), " changed");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockNavigate).toHaveBeenCalledWith("/habits");
    expect(mockedUpdateHabit).not.toHaveBeenCalled();
  });
  // --- delete (US4) ---

  describe("delete", () => {
    it("puts the Delete habit button last, after Save and Cancel", async () => {
      await renderLoaded();

      const buttons = screen.getAllByRole("button");
      expect(buttons[buttons.length - 1]).toHaveTextContent("Delete habit");
    });

    it("asks for confirmation instead of deleting straight away", async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole("button", { name: "Delete habit" }));

      const prompt = screen.getByRole("alertdialog");
      expect(
        within(prompt).getByText("Delete this habit permanently?"),
      ).toBeInTheDocument();
      expect(
        within(prompt).getByRole("button", { name: "Confirm delete" }),
      ).toBeInTheDocument();
      expect(
        within(prompt).getByRole("button", { name: "Cancel" }),
      ).toBeInTheDocument();
      expect(mockedDeleteHabit).not.toHaveBeenCalled();
    });

    it("Cancel in the prompt hides it and deletes nothing", async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole("button", { name: "Delete habit" }));
      await user.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: "Cancel",
        }),
      );

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(mockedDeleteHabit).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("Confirm delete deletes habit 7, then returns to /habits", async () => {
      mockedDeleteHabit.mockResolvedValue(habit);
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole("button", { name: "Delete habit" }));
      await user.click(screen.getByRole("button", { name: "Confirm delete" }));

      expect(mockedDeleteHabit).toHaveBeenCalledWith(7);
      expect(mockNavigate).toHaveBeenCalledWith("/habits");
    });

    it("shows the error and stays on the page when deleting fails", async () => {
      mockedDeleteHabit.mockRejectedValue(new Error("Server exploded"));
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole("button", { name: "Delete habit" }));
      await user.click(screen.getByRole("button", { name: "Confirm delete" }));

      expect(await screen.findByText("Server exploded")).toBeInTheDocument();
      expect(screen.getByLabelText("Name")).toHaveValue("Morning run");
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
