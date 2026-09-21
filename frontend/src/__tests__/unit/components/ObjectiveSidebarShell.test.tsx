import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ObjectiveSidebarShell from "../../../components/ObjectiveSidebarShell";

describe("ObjectiveSidebarShell", () => {
  afterEach(() => {
    cleanup();
  });

  // --- open/closed state ---

  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <ObjectiveSidebarShell
        isOpen={false}
        title="New node"
        onClose={vi.fn()}
        primaryLabel="Submit"
        onPrimaryClick={vi.fn()}
      >
        children content
      </ObjectiveSidebarShell>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the title and children when isOpen is true", () => {
    render(
      <ObjectiveSidebarShell
        isOpen={true}
        title="New node"
        onClose={vi.fn()}
        primaryLabel="Submit"
        onPrimaryClick={vi.fn()}
      >
        <div>children content</div>
      </ObjectiveSidebarShell>,
    );

    expect(screen.getByText("New node")).toBeInTheDocument();
    expect(screen.getByText("children content")).toBeInTheDocument();
  });

  // --- close button ---

  it("calls onClose when the × close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ObjectiveSidebarShell
        isOpen={true}
        title="New node"
        onClose={onClose}
        primaryLabel="Submit"
        onPrimaryClick={vi.fn()}
      >
        children
      </ObjectiveSidebarShell>,
    );

    await user.click(screen.getByLabelText("Close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // --- secondary button: defaults vs overrides ---

  it("defaults the secondary label to 'Cancel' and falls back to onClose when no onSecondaryClick is given", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ObjectiveSidebarShell
        isOpen={true}
        title="New node"
        onClose={onClose}
        primaryLabel="Submit"
        onPrimaryClick={vi.fn()}
      >
        children
      </ObjectiveSidebarShell>,
    );

    const secondaryButton = screen.getByText("Cancel");
    await user.click(secondaryButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses a custom secondaryLabel and onSecondaryClick instead of onClose when provided", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSecondaryClick = vi.fn();
    render(
      <ObjectiveSidebarShell
        isOpen={true}
        title="New node"
        onClose={onClose}
        primaryLabel="Submit"
        onPrimaryClick={vi.fn()}
        secondaryLabel="Back"
        onSecondaryClick={onSecondaryClick}
      >
        children
      </ObjectiveSidebarShell>,
    );

    await user.click(screen.getByText("Back"));

    expect(onSecondaryClick).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  // --- primary button ---

  it("renders the primaryLabel and calls onPrimaryClick when clicked", async () => {
    const user = userEvent.setup();
    const onPrimaryClick = vi.fn();
    render(
      <ObjectiveSidebarShell
        isOpen={true}
        title="New node"
        onClose={vi.fn()}
        primaryLabel="Submit"
        onPrimaryClick={onPrimaryClick}
      >
        children
      </ObjectiveSidebarShell>,
    );

    await user.click(screen.getByText("Submit"));

    expect(onPrimaryClick).toHaveBeenCalledTimes(1);
  });

  it("disables the primary button when primaryDisabled is true", () => {
    render(
      <ObjectiveSidebarShell
        isOpen={true}
        title="New node"
        onClose={vi.fn()}
        primaryLabel="Submit"
        onPrimaryClick={vi.fn()}
        primaryDisabled={true}
      >
        children
      </ObjectiveSidebarShell>,
    );

    expect(screen.getByText("Submit")).toBeDisabled();
  });

  it("hides the primary button (visibility: hidden) when showPrimary is false", () => {
    render(
      <ObjectiveSidebarShell
        isOpen={true}
        title="New node"
        onClose={vi.fn()}
        primaryLabel="Submit"
        onPrimaryClick={vi.fn()}
        showPrimary={false}
      >
        children
      </ObjectiveSidebarShell>,
    );

    expect(screen.getByText("Submit")).toHaveStyle({ visibility: "hidden" });
  });

  // --- saving state ---

  it("shows 'Saving…' instead of primaryLabel and disables both buttons while isSaving is true", () => {
    render(
      <ObjectiveSidebarShell
        isOpen={true}
        title="New node"
        onClose={vi.fn()}
        primaryLabel="Submit"
        onPrimaryClick={vi.fn()}
        isSaving={true}
      >
        children
      </ObjectiveSidebarShell>,
    );

    expect(screen.queryByText("Submit")).not.toBeInTheDocument();
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(screen.getByText("Saving…")).toBeDisabled();
    expect(screen.getByText("Cancel")).toBeDisabled();
  });

  it("keeps the primary button enabled while saving if primaryDisabled is not set, but still disables it when both are true", () => {
    render(
      <ObjectiveSidebarShell
        isOpen={true}
        title="New node"
        onClose={vi.fn()}
        primaryLabel="Submit"
        onPrimaryClick={vi.fn()}
        isSaving={true}
        primaryDisabled={true}
      >
        children
      </ObjectiveSidebarShell>,
    );

    expect(screen.getByText("Saving…")).toBeDisabled();
  });

  // --- error message ---

  it("does not render an error block when errorMessage is null", () => {
    const { container } = render(
      <ObjectiveSidebarShell
        isOpen={true}
        title="New node"
        onClose={vi.fn()}
        primaryLabel="Submit"
        onPrimaryClick={vi.fn()}
        errorMessage={null}
      >
        children
      </ObjectiveSidebarShell>,
    );

    expect(container.querySelector(".obj-form-error")).toBeNull();
  });

  it("renders the errorMessage text when provided", () => {
    render(
      <ObjectiveSidebarShell
        isOpen={true}
        title="New node"
        onClose={vi.fn()}
        primaryLabel="Submit"
        onPrimaryClick={vi.fn()}
        errorMessage="description is required"
      >
        children
      </ObjectiveSidebarShell>,
    );

    expect(screen.getByText("description is required")).toBeInTheDocument();
  });
});
