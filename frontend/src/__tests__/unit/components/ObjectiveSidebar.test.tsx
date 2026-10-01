import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ObjectiveSidebar from "../../../components/ObjectiveSidebar";

// Deadline contract (required fields on their own step, reached via "Next"
// after the description step — creation is a three-step flow:
// type -> description -> deadline):
//   - Two <input type="datetime-local"> fields, each associated to a
//     <label> via htmlFor/id, with label text matching /deadline start/i
//     and /deadline end/i respectively (queryable via getByLabelText).
//   - datetime-local inputs don't play well with userEvent.type's per-key
//     typing model, so we drive them with fireEvent.change directly, same
//     as the raw string the browser would hand the change handler (e.g.
//     "2026-08-21T14:30").
function fillDeadlines(startValue: string, endValue: string) {
  fireEvent.change(screen.getByLabelText(/deadline start/i), {
    target: { value: startValue },
  });
  fireEvent.change(screen.getByLabelText(/deadline end/i), {
    target: { value: endValue },
  });
}

// Drives the sidebar from the just-selected type step through the
// description step to the deadline step, typing `description` along the
// way and clicking "Next". Assumes a type has already been selected.
async function goToDeadlineStep(
  user: ReturnType<typeof userEvent.setup>,
  description: string,
) {
  await user.type(screen.getByRole("textbox"), description);
  await user.click(screen.getByText("Next"));
}

describe("ObjectiveSidebar", () => {
  // Vitest is configured without `test.globals: true` (see vite.config.ts), so
  // @testing-library/react's auto-cleanup (which relies on detecting a global
  // `afterEach`) never registers. Without this, DOM from earlier tests in this
  // file leaks into later ones and queries like getByText start matching more
  // than one element.
  afterEach(() => {
    cleanup();
  });

  // --- open/closed state ---

  it("renders nothing when isOpen is false", () => {
    render(
      <ObjectiveSidebar isOpen={false} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.queryByText(/new node/i)).not.toBeInTheDocument();
  });

  it("starts on the type-selection step with title 'New node'", () => {
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText("New node")).toBeInTheDocument();
    expect(screen.getByText("What kind of node is this?")).toBeInTheDocument();
  });

  it("shows both type options on the first step", () => {
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText("Objective")).toBeInTheDocument();
    expect(screen.getByText("Task")).toBeInTheDocument();
  });

  // --- type selection advances to the description step ---

  it("advances to the description step and updates the title when Objective is selected", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Objective"));

    expect(screen.getByText("New objective")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  it("advances to the description step and updates the title when Task is selected", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Task"));

    expect(screen.getByText("New task")).toBeInTheDocument();
  });

  it("shows a task-specific placeholder hinting at a {counter} when Task is selected", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Task"));

    expect(
      screen.getByPlaceholderText(/do \{pushups\} pushups every morning/i),
    ).toBeInTheDocument();
  });

  it("shows a plain placeholder with no {counter} hint when Objective is selected", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Objective"));

    expect(
      screen.getByPlaceholderText(/get stronger this year/i),
    ).toBeInTheDocument();
  });

  // --- onTypeChange notification ---
  // Contract: an optional `onTypeChange?: (isTask: boolean) => void` prop is
  // fired from `selectType` alongside the existing setStep/setIsTask calls,
  // so callers (sidebars) can show a live "type changed" notification.

  it("calls onTypeChange(false) when Objective is selected on the type step", async () => {
    const user = userEvent.setup();
    const onTypeChange = vi.fn();
    render(
      <ObjectiveSidebar
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onTypeChange={onTypeChange}
      />,
    );

    await user.click(screen.getByText("Objective"));

    expect(onTypeChange).toHaveBeenCalledTimes(1);
    expect(onTypeChange).toHaveBeenCalledWith(false);
  });

  it("calls onTypeChange(true) when Task is selected on the type step", async () => {
    const user = userEvent.setup();
    const onTypeChange = vi.fn();
    render(
      <ObjectiveSidebar
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        onTypeChange={onTypeChange}
      />,
    );

    await user.click(screen.getByText("Task"));

    expect(onTypeChange).toHaveBeenCalledTimes(1);
    expect(onTypeChange).toHaveBeenCalledWith(true);
  });

  it("does not throw and still advances to the description step when onTypeChange is omitted", async () => {
    // Guards the optional-prop contract: every existing call site in this
    // file omits onTypeChange, so selectType must tolerate it being undefined.
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Objective"));

    expect(screen.getByText("New objective")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });

  // --- description step interactions ---

  it("lets the user type a description", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Objective"));
    const textarea = screen.getByPlaceholderText(/get stronger this year/i);
    await user.type(textarea, "Get stronger");

    expect(textarea).toHaveValue("Get stronger");
  });

  it("disables Next while the description is empty", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Objective"));

    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("enables Next once a description is entered", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Objective"));
    await user.type(
      screen.getByPlaceholderText(/get stronger this year/i),
      "Get stronger",
    );

    expect(screen.getByText("Next")).not.toBeDisabled();
  });

  // --- deadline step (new, required, reached via Next) ---

  it("advances to the deadline step, with both inputs empty by default, when Next is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Objective"));
    await goToDeadlineStep(user, "Get stronger");

    expect(screen.getByText("Deadline")).toBeInTheDocument();
    expect(screen.getByLabelText(/deadline start/i)).toHaveValue("");
    expect(screen.getByLabelText(/deadline end/i)).toHaveValue("");
  });

  it("keeps Submit disabled on the deadline step until both deadlines are set", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Objective"));
    await goToDeadlineStep(user, "Get stronger");

    expect(screen.getByText("Submit")).toBeDisabled();
  });

  it("keeps Submit disabled when deadline start is after deadline end", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Objective"));
    await goToDeadlineStep(user, "Get stronger");
    // Client-side guard only checks ordering (start <= end); it must reject
    // start-after-end even though it isn't the server's real >=60s rule.
    fillDeadlines("2026-08-21T15:30", "2026-08-21T14:30");

    expect(screen.getByText("Submit")).toBeDisabled();
  });

  it("enables Submit when deadline start exactly equals deadline end", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Objective"));
    await goToDeadlineStep(user, "Get stronger");
    // By design the client-side guard is only start <= end (not the
    // server's real "at least 60s apart" rule), so equal timestamps must
    // be allowed here — the server is responsible for rejecting these via
    // errorMessage.
    fillDeadlines("2026-08-21T14:30", "2026-08-21T14:30");

    expect(screen.getByText("Submit")).not.toBeDisabled();
  });

  // --- back / cancel navigation ---

  it("returns to the type-selection step when Back is clicked from the description step", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Task"));
    expect(screen.getByText("New task")).toBeInTheDocument();

    await user.click(screen.getByText("Back"));

    expect(screen.getByText("New node")).toBeInTheDocument();
    expect(screen.getByText("What kind of node is this?")).toBeInTheDocument();
  });

  it("returns to the description step, with the typed description preserved, when Back is clicked from the deadline step", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Task"));
    await goToDeadlineStep(user, "Do {{pushups} pushups");
    expect(screen.getByText("Deadline")).toBeInTheDocument();

    await user.click(screen.getByText("Back"));

    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/do \{pushups\} pushups every morning/i),
    ).toHaveValue("Do {pushups} pushups");
  });

  it("calls onClose when Cancel is clicked on the type-selection step", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ObjectiveSidebar isOpen={true} onClose={onClose} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the × close button is clicked, regardless of step", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ObjectiveSidebar isOpen={true} onClose={onClose} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Task")); // move to description step
    await user.click(screen.getByLabelText("Close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // --- submit ---

  it("calls onSubmit with the correct isTask, description and ISO deadlines for an objective", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    await user.click(screen.getByText("Objective"));
    await goToDeadlineStep(user, "Get stronger");
    const startValue = "2026-08-21T14:30";
    const endValue = "2026-08-21T15:30";
    fillDeadlines(startValue, endValue);
    await user.click(screen.getByText("Submit"));

    // The raw datetime-local strings must be converted to full ISO 8601
    // strings (e.g. via `new Date(value).toISOString()`) before onSubmit is
    // called — computing the expectation the same way keeps this
    // independent of the test runner's local timezone.
    expect(onSubmit).toHaveBeenCalledWith({
      isTask: false,
      description: "Get stronger",
      deadlineStart: new Date(startValue).toISOString(),
      deadlineEnd: new Date(endValue).toISOString(),
    });
  });

  it("calls onSubmit with the correct isTask, description and ISO deadlines for a task", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    await user.click(screen.getByText("Task"));
    // userEvent.type interprets `{` as the start of special key syntax
    // (e.g. `{shift}`); only `{` needs escaping (by doubling), `}` is
    // already literal outside of a `{...}` block.
    await goToDeadlineStep(user, "Do {{pushups} pushups");
    const startValue = "2026-09-01T09:00";
    const endValue = "2026-09-01T09:00"; // equal is allowed client-side
    fillDeadlines(startValue, endValue);
    await user.click(screen.getByText("Submit"));

    expect(onSubmit).toHaveBeenCalledWith({
      isTask: true,
      description: "Do {pushups} pushups",
      deadlineStart: new Date(startValue).toISOString(),
      deadlineEnd: new Date(endValue).toISOString(),
    });
  });

  // --- saving / error states ---

  it("shows the error message when errorMessage is provided", () => {
    render(
      <ObjectiveSidebar
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        errorMessage="description is required"
      />,
    );

    expect(screen.getByText("description is required")).toBeInTheDocument();
  });

  it("shows 'Saving…' and disables buttons while isSaving is true", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isSaving={true}
      />,
    );

    await user.click(screen.getByText("Objective"));
    // isSaving disables the shell's primary button (labeled "Next" on this
    // step) from the very start, so the deadline step is unreachable here —
    // that's fine, since isSaving's effect (label swap + disabling) is the
    // same regardless of which step it's applied on.

    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(screen.getByText("Saving…")).toBeDisabled();
    expect(screen.getByText("Back")).toBeDisabled();
  });
});
