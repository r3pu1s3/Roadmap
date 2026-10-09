import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ObjectiveEditSidebar, {
  type ObjectiveData,
} from "../../../components/ObjectiveEditSidebar";

// Fixtures with concrete deadlines are narrowed to non-null strings so the
// existing pre-fill tests type-check now that ObjectiveData allows null.
type DatedObjective = ObjectiveData & {
  deadlineStart: string;
  deadlineEnd: string;
};

const plainObjective: DatedObjective = {
  id: 1,
  description: "Get stronger this year",
  isTask: false,
  counter: null,
  deadlineStart: "2026-08-20T10:00:00.000Z",
  deadlineEnd: "2026-08-21T10:00:00.000Z",
};

const nullDeadlineObjective: ObjectiveData = {
  id: 3,
  description: "No deadline yet",
  isTask: false,
  counter: null,
  deadlineStart: null,
  deadlineEnd: null,
};

const taskObjective: DatedObjective = {
  id: 2,
  description: "Do {pushups} pushups",
  isTask: true,
  counter: { label: "pushups", targetQuantity: null },
  deadlineStart: "2026-09-01T08:00:00.000Z",
  deadlineEnd: "2026-09-02T08:00:00.000Z",
};

// Mirrors the ISO -> `datetime-local` input-value conversion the component is
// expected to perform on mount (local calendar/clock fields, minute
// precision, no seconds/timezone suffix). Computed from `Date` rather than
// hardcoded so these tests aren't tied to the host machine's timezone.
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

describe("ObjectiveEditSidebar", () => {
  afterEach(() => {
    cleanup();
  });

  // --- open/closed & missing-objective states ---

  it("renders nothing when isOpen is false", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={false}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByText(/edit objective/i)).not.toBeInTheDocument();
  });

  it("renders nothing when objective is null, even if isOpen is true", () => {
    const { container } = render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={null}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  // --- initial population from the objective prop ---

  it("pre-fills the description textarea and titles itself 'Edit objective' for a plain objective", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Edit objective")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Get stronger this year"),
    ).toBeInTheDocument();
  });

  it("titles itself 'Edit task' and pre-fills the description for a task objective", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={taskObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Edit task")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Do {pushups} pushups"),
    ).toBeInTheDocument();
  });

  // --- deadline pre-fill from the objective prop ---

  it("pre-fills the deadline start and end inputs from the objective's ISO deadline fields", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    // Pre-filled values are derived from the fixture's ISO strings via the
    // ISO -> datetime-local conversion the component is expected to perform
    // on mount, not typed in by the fixtures themselves.
    expect(screen.getByLabelText(/deadline start/i)).toHaveValue(
      toDatetimeLocalValue(plainObjective.deadlineStart),
    );
    expect(screen.getByLabelText(/deadline end/i)).toHaveValue(
      toDatetimeLocalValue(plainObjective.deadlineEnd),
    );
  });

  it("pre-fills the deadline inputs for a task objective with a different deadline range", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={taskObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/deadline start/i)).toHaveValue(
      toDatetimeLocalValue(taskObjective.deadlineStart),
    );
    expect(screen.getByLabelText(/deadline end/i)).toHaveValue(
      toDatetimeLocalValue(taskObjective.deadlineEnd),
    );
  });

  // --- editing the description ---

  it("lets the user change the description", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const textarea = screen.getByDisplayValue("Get stronger this year");
    await user.clear(textarea);
    await user.type(textarea, "Get even stronger");

    expect(textarea).toHaveValue("Get even stronger");
  });

  it("disables Save while the description is empty", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const textarea = screen.getByDisplayValue("Get stronger this year");
    await user.clear(textarea);

    expect(screen.getByText("Save")).toBeDisabled();
  });

  // --- deadline validation gating Save ---

  it("keeps Save disabled if the user clears the deadline start input after it was pre-filled", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    // Both deadlines and the description are valid on mount (Save should be
    // enabled); clearing just the start field must re-disable it.
    fireEvent.change(screen.getByLabelText(/deadline start/i), {
      target: { value: "" },
    });

    expect(screen.getByText("Save")).toBeDisabled();
  });

  it("keeps Save disabled if the user clears the deadline end input after it was pre-filled", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/deadline end/i), {
      target: { value: "" },
    });

    expect(screen.getByText("Save")).toBeDisabled();
  });

  it("keeps Save disabled when deadline start is edited to be after deadline end", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    // plainObjective's end is 2026-08-21T10:00; push start a day past it.
    fireEvent.change(screen.getByLabelText(/deadline start/i), {
      target: { value: "2026-08-22T10:00" },
    });

    expect(screen.getByText("Save")).toBeDisabled();
  });

  it("enables Save when deadline start and end are set to the exact same value (equal bounds allowed client-side)", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    // The server enforces a minimum 60s gap; the sidebar only guards
    // start <= end, so an exactly-equal pair must NOT disable Save.
    fireEvent.change(screen.getByLabelText(/deadline start/i), {
      target: { value: "2026-08-20T10:00" },
    });
    fireEvent.change(screen.getByLabelText(/deadline end/i), {
      target: { value: "2026-08-20T10:00" },
    });

    expect(screen.getByText("Save")).not.toBeDisabled();
  });

  // --- switching type via the Objective/Task buttons ---

  it("switches the title to 'Edit task' when the Task type button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Task"));

    expect(screen.getByText("Edit task")).toBeInTheDocument();
  });

  it("switches the title to 'Edit objective' when the Objective type button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={taskObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Objective"));

    expect(screen.getByText("Edit objective")).toBeInTheDocument();
  });

  it("highlights the Objective type button as selected for a plain objective", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Objective").closest("button")).toHaveStyle({
      borderColor: "#6366f1",
    });
    expect(screen.getByText("Task").closest("button")).not.toHaveStyle({
      borderColor: "#6366f1",
    });
  });

  it("highlights the Task type button as selected for a task objective", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={taskObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Task").closest("button")).toHaveStyle({
      borderColor: "#6366f1",
    });
  });

  // --- type change notification (onTypeChange) ---

  it("calls onTypeChange(true) when the Task button is clicked from a plain objective", async () => {
    const user = userEvent.setup();
    const onTypeChange = vi.fn();
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onTypeChange={onTypeChange}
      />,
    );

    await user.click(screen.getByText("Task"));

    expect(onTypeChange).toHaveBeenCalledWith(true);
  });

  it("calls onTypeChange(false) when the Objective button is clicked from a task objective", async () => {
    const user = userEvent.setup();
    const onTypeChange = vi.fn();
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={taskObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onTypeChange={onTypeChange}
      />,
    );

    await user.click(screen.getByText("Objective"));

    expect(onTypeChange).toHaveBeenCalledWith(false);
  });

  // onTypeChange is optional: every other test in this file omits it, so the
  // buttons must keep working (no throw, highlight/local state still updates)
  // when it's not passed at all.
  it("does not throw and still re-highlights the clicked type button when onTypeChange is omitted", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    await expect(user.click(screen.getByText("Task"))).resolves.not.toThrow();

    expect(screen.getByText("Task").closest("button")).toHaveStyle({
      borderColor: "#6366f1",
    });
    expect(screen.getByText("Objective").closest("button")).not.toHaveStyle({
      borderColor: "#6366f1",
    });
  });

  // --- submit ---

  it("calls onSubmit with the current description, isTask, and the untouched deadlines converted back to ISO", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const textarea = screen.getByDisplayValue("Get stronger this year");
    await user.clear(textarea);
    await user.type(textarea, "Updated description");
    await user.click(screen.getByText("Task"));
    await user.click(screen.getByText("Save"));

    // Deadlines were never touched, so the round-trip (ISO -> datetime-local
    // on mount -> ISO on submit) must reproduce the original fixture values
    // exactly, since both fixtures already sit on whole minutes.
    expect(onSubmit).toHaveBeenCalledWith({
      description: "Updated description",
      isTask: true,
      deadlineStart: plainObjective.deadlineStart,
      deadlineEnd: plainObjective.deadlineEnd,
    });
  });

  it("calls onSubmit with a recomputed ISO deadlineStart when the user edits the deadline start input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const newStartValue = "2026-08-20T09:30";
    fireEvent.change(screen.getByLabelText(/deadline start/i), {
      target: { value: newStartValue },
    });
    await user.click(screen.getByText("Save"));

    // Expected ISO is computed the same way the component is expected to
    // convert it (`new Date(value).toISOString()`), so the assertion holds
    // regardless of the host machine's timezone.
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        deadlineStart: new Date(newStartValue).toISOString(),
        deadlineEnd: plainObjective.deadlineEnd,
      }),
    );
  });

  // --- nullable deadlines ---

  const DEADLINE_MSG = "Set both deadline fields, or leave both empty.";

  function renderNull(onSubmit = vi.fn()) {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={nullDeadlineObjective}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    return onSubmit;
  }

  // Null stored deadlines must map to empty input values, not "Invalid Date" strings or a crash.
  it("renders empty deadline inputs for an objective whose deadlines are null", () => {
    renderNull();

    expect(screen.getByLabelText(/deadline start/i)).toHaveValue("");
    expect(screen.getByLabelText(/deadline end/i)).toHaveValue("");
  });

  // Deadlines are optional now, so the inputs must not carry the HTML `required` attribute.
  it("does not mark the deadline inputs as required", () => {
    renderNull();

    expect(screen.getByLabelText(/deadline start/i)).not.toBeRequired();
    expect(screen.getByLabelText(/deadline end/i)).not.toBeRequired();
  });

  it("enables Save and shows no deadline message when both deadlines are empty", () => {
    renderNull();

    expect(screen.getByText("Save")).not.toBeDisabled();
    expect(screen.queryByText(DEADLINE_MSG)).not.toBeInTheDocument();
  });

  it("disables Save and shows the inline message when only deadline start is filled", () => {
    renderNull();

    fireEvent.change(screen.getByLabelText(/deadline start/i), {
      target: { value: "2026-08-20T10:00" },
    });

    expect(screen.getByText("Save")).toBeDisabled();
    expect(screen.getByText(DEADLINE_MSG)).toBeInTheDocument();
  });

  it("disables Save and shows the inline message when only deadline end is filled", () => {
    renderNull();

    fireEvent.change(screen.getByLabelText(/deadline end/i), {
      target: { value: "2026-08-20T10:00" },
    });

    expect(screen.getByText("Save")).toBeDisabled();
    expect(screen.getByText(DEADLINE_MSG)).toBeInTheDocument();
  });

  // The message is for the "exactly one filled" case only; an inverted pair is invalid but a different problem.
  it("does not show the one-filled message for an inverted (start after end) pair", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/deadline start/i), {
      target: { value: "2026-08-22T10:00" },
    });

    expect(screen.getByText("Save")).toBeDisabled();
    expect(screen.queryByText(DEADLINE_MSG)).not.toBeInTheDocument();
  });

  it("shows the inline message when a previously-filled objective has just one field cleared", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/deadline start/i), {
      target: { value: "" },
    });

    expect(screen.getByText(DEADLINE_MSG)).toBeInTheDocument();
  });

  // Core contract: untouched null deadlines go out as explicit null keys, never undefined/omitted/"".
  it("submits explicit null for both deadlines when a null-deadline objective is saved untouched", async () => {
    const user = userEvent.setup();
    const onSubmit = renderNull();

    await user.click(screen.getByText("Save"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toHaveProperty("deadlineStart");
    expect(payload).toHaveProperty("deadlineEnd");
    expect(payload.deadlineStart).toBeNull();
    expect(payload.deadlineEnd).toBeNull();
    expect(payload).toEqual({
      description: "No deadline yet",
      isTask: false,
      deadlineStart: null,
      deadlineEnd: null,
    });
  });

  it("submits real ISO strings when both previously-empty deadlines are filled", async () => {
    const user = userEvent.setup();
    const onSubmit = renderNull();

    const start = "2026-08-20T09:30";
    const end = "2026-08-21T11:45";
    fireEvent.change(screen.getByLabelText(/deadline start/i), {
      target: { value: start },
    });
    fireEvent.change(screen.getByLabelText(/deadline end/i), {
      target: { value: end },
    });
    expect(screen.getByText("Save")).not.toBeDisabled();
    await user.click(screen.getByText("Save"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        deadlineStart: new Date(start).toISOString(),
        deadlineEnd: new Date(end).toISOString(),
      }),
    );
  });

  // Clearing both fields is how a user removes an existing deadline: Save must stay clickable and send null.
  it("submits explicit null for both deadlines when the user clears both previously-filled fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/deadline start/i), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText(/deadline end/i), {
      target: { value: "" },
    });

    expect(screen.getByText("Save")).not.toBeDisabled();
    expect(screen.queryByText(DEADLINE_MSG)).not.toBeInTheDocument();
    await user.click(screen.getByText("Save"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toHaveProperty("deadlineStart");
    expect(payload).toHaveProperty("deadlineEnd");
    expect(payload.deadlineStart).toBeNull();
    expect(payload.deadlineEnd).toBeNull();
    expect(payload).toEqual(
      expect.objectContaining({ deadlineStart: null, deadlineEnd: null }),
    );
  });

  // --- close ---

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the × close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );

    await user.click(screen.getByLabelText("Close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // --- saving / error states ---

  it("shows 'Saving…' and disables buttons while isSaving is true", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isSaving={true}
      />,
    );

    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(screen.getByText("Saving…")).toBeDisabled();
    expect(screen.getByText("Cancel")).toBeDisabled();
  });

  it("shows the error message when errorMessage is provided", () => {
    render(
      <ObjectiveEditSidebar
        isOpen={true}
        objective={plainObjective}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        errorMessage="description is required"
      />,
    );

    expect(screen.getByText("description is required")).toBeInTheDocument();
  });
});
