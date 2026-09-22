import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ObjectiveEditSidebar, {
  type ObjectiveData,
} from "../../../components/ObjectiveEditSidebar";

const plainObjective: ObjectiveData = {
  id: 1,
  description: "Get stronger this year",
  isTask: false,
  counter: null,
};

const taskObjective: ObjectiveData = {
  id: 2,
  description: "Do {pushups} pushups",
  isTask: true,
  counter: { label: "pushups", targetQuantity: null },
};

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

  it("calls onSubmit with the current description and isTask", async () => {
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

    expect(onSubmit).toHaveBeenCalledWith({
      description: "Updated description",
      isTask: true,
    });
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
