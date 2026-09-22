import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ObjectiveSidebar from "../../../components/ObjectiveSidebar";

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

  it("disables Submit while the description is empty", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Objective"));

    expect(screen.getByText("Submit")).toBeDisabled();
  });

  it("enables Submit once a description is entered", async () => {
    const user = userEvent.setup();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    await user.click(screen.getByText("Objective"));
    await user.type(
      screen.getByPlaceholderText(/get stronger this year/i),
      "Get stronger",
    );

    expect(screen.getByText("Submit")).not.toBeDisabled();
  });

  // --- back / cancel navigation ---

  it("returns to the type-selection step when Back is clicked", async () => {
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

  it("calls onSubmit with the correct isTask and description for an objective", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    await user.click(screen.getByText("Objective"));
    await user.type(
      screen.getByPlaceholderText(/get stronger this year/i),
      "Get stronger",
    );
    await user.click(screen.getByText("Submit"));

    expect(onSubmit).toHaveBeenCalledWith({
      isTask: false,
      description: "Get stronger",
    });
  });

  it("calls onSubmit with the correct isTask and description for a task", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ObjectiveSidebar isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    await user.click(screen.getByText("Task"));
    await user.type(
      screen.getByPlaceholderText(/do \{pushups\} pushups every morning/i),
      // userEvent.type interprets `{` as the start of special key syntax
      // (e.g. `{shift}`); only `{` needs escaping (by doubling), `}` is
      // already literal outside of a `{...}` block.
      "Do {{pushups} pushups",
    );
    await user.click(screen.getByText("Submit"));

    expect(onSubmit).toHaveBeenCalledWith({
      isTask: true,
      description: "Do {pushups} pushups",
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

    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(screen.getByText("Saving…")).toBeDisabled();
    expect(screen.getByText("Back")).toBeDisabled();
  });
});
