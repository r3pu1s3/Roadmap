import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import CanvasErrorBanner from "../../../components/CanvasErrorBanner";

describe("CanvasErrorBanner", () => {
  afterEach(() => {
    cleanup();
  });

  // --- no message: renders nothing ---

  it("renders nothing when message is null", () => {
    const { container } = render(<CanvasErrorBanner message={null} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when message is an empty string", () => {
    const { container } = render(<CanvasErrorBanner message="" />);

    expect(container.firstChild).toBeNull();
  });

  // --- message present: renders the banner with the exact text ---

  it("renders the banner containing the exact message text when message is a non-empty string", () => {
    render(<CanvasErrorBanner message="Some error text" />);

    expect(screen.getByText("Some error text")).toBeInTheDocument();
  });

  // --- toggle behavior ---
  // The Map page will flip `message` between a string and null as errors
  // come and go, so re-rendering with null must remove the banner rather
  // than leaving stale error text (or an empty container) behind.
  it("removes the banner from the document when rerendered from a message to null", () => {
    const { rerender, container } = render(
      <CanvasErrorBanner message="Some error text" />,
    );
    expect(screen.getByText("Some error text")).toBeInTheDocument();

    rerender(<CanvasErrorBanner message={null} />);

    expect(screen.queryByText("Some error text")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });
});
