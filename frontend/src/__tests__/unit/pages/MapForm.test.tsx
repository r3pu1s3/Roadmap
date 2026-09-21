import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MapForm from "../../../pages/MapForm";
import { createMap } from "../../../apis/MapApi";

vi.mock("../../../apis/MapApi");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockedCreateMap = vi.mocked(createMap);

describe("MapForm", () => {
  beforeEach(() => {
    mockedCreateMap.mockReset();
    mockNavigate.mockReset();
  });

  // Vitest is configured without `test.globals: true` (see vite.config.ts), so
  // @testing-library/react's auto-cleanup (which relies on detecting a global
  // `afterEach`) never registers. Without this, DOM from earlier tests in this
  // file leaks into later ones and queries like getByText start matching more
  // than one element. Explicit cleanup here keeps each test isolated.
  afterEach(() => {
    cleanup();
  });

  // --- basic rendering ---

  it("renders the title, name input, both type options, and the submit button", () => {
    render(<MapForm />);

    expect(screen.getByText("New map")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/fitness goals/i)).toBeInTheDocument();
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Habit")).toBeInTheDocument();
    expect(screen.getByText("Create map")).toBeInTheDocument();
  });

  // --- submit enablement ---

  it("disables submit when name is empty and no type is selected", () => {
    render(<MapForm />);
    expect(screen.getByText("Create map")).toBeDisabled();
  });

  it("keeps submit disabled when a type is selected but name is still empty", async () => {
    const user = userEvent.setup();
    render(<MapForm />);

    await user.click(screen.getByText("Project"));

    expect(screen.getByText("Create map")).toBeDisabled();
  });

  it("keeps submit disabled when name is filled but no type is selected", async () => {
    const user = userEvent.setup();
    render(<MapForm />);

    await user.type(screen.getByPlaceholderText(/fitness goals/i), "My map");

    expect(screen.getByText("Create map")).toBeDisabled();
  });

  // --- type selection visual state ---

  it("marks the Project button as selected when clicked, and enables submit once name is filled", async () => {
    const user = userEvent.setup();
    render(<MapForm />);

    await user.click(screen.getByText("Project"));
    // className includes "selected" per the plan's visual-state contract
    expect(screen.getByText("Project").closest("button")).toHaveClass(
      "selected",
    );
    expect(screen.getByText("Habit").closest("button")).not.toHaveClass(
      "selected",
    );

    await user.type(screen.getByPlaceholderText(/fitness goals/i), "My map");

    expect(screen.getByText("Create map")).not.toBeDisabled();
  });

  it("marks the Habit button as selected when clicked, and enables submit once name is filled", async () => {
    const user = userEvent.setup();
    render(<MapForm />);

    await user.click(screen.getByText("Habit"));
    expect(screen.getByText("Habit").closest("button")).toHaveClass("selected");

    await user.type(screen.getByPlaceholderText(/fitness goals/i), "My map");

    expect(screen.getByText("Create map")).not.toBeDisabled();
  });

  // --- name input ---

  it("updates the name input value as the user types", async () => {
    const user = userEvent.setup();
    render(<MapForm />);

    const input = screen.getByPlaceholderText(/fitness goals/i);
    await user.type(input, "Fitness Goals");

    expect(input).toHaveValue("Fitness Goals");
  });

  // --- successful submit ---

  it("calls createMap with the trimmed name and selected type, then navigates to the new map on success", async () => {
    const user = userEvent.setup();
    mockedCreateMap.mockResolvedValue({
      id: 42,
      name: "My map",
      type: "Project",
    });
    render(<MapForm />);

    await user.click(screen.getByText("Project"));
    await user.type(screen.getByPlaceholderText(/fitness goals/i), "My map");
    await user.click(screen.getByText("Create map"));

    expect(mockedCreateMap).toHaveBeenCalledWith({
      name: "My map",
      type: "Project",
    });
    expect(mockNavigate).toHaveBeenCalledWith("/maps/42");
  });

  it("trims leading/trailing whitespace from the name before calling createMap", async () => {
    const user = userEvent.setup();
    mockedCreateMap.mockResolvedValue({
      id: 7,
      name: "Trimmed",
      type: "Habit",
    });
    render(<MapForm />);

    await user.click(screen.getByText("Habit"));
    await user.type(
      screen.getByPlaceholderText(/fitness goals/i),
      "  Trimmed  ",
    );
    await user.click(screen.getByText("Create map"));

    expect(mockedCreateMap).toHaveBeenCalledWith({
      name: "Trimmed",
      type: "Habit",
    });
  });

  // --- saving state ---

  it("shows 'Creating…' and disables the submit button while the save is pending", async () => {
    const user = userEvent.setup();
    // Never-resolving promise to freeze the component in the isSaving state.
    mockedCreateMap.mockReturnValue(new Promise(() => {}));
    render(<MapForm />);

    await user.click(screen.getByText("Project"));
    await user.type(screen.getByPlaceholderText(/fitness goals/i), "My map");
    await user.click(screen.getByText("Create map"));

    expect(await screen.findByText("Creating…")).toBeInTheDocument();
    expect(screen.getByText("Creating…")).toBeDisabled();
  });

  // --- error handling ---

  it("shows the thrown Error's message in the bottom error block when createMap rejects", async () => {
    const user = userEvent.setup();
    mockedCreateMap.mockRejectedValue(new Error("Name already taken"));
    render(<MapForm />);

    await user.click(screen.getByText("Project"));
    await user.type(screen.getByPlaceholderText(/fitness goals/i), "My map");
    await user.click(screen.getByText("Create map"));

    expect(await screen.findByText("Name already taken")).toBeInTheDocument();
  });

  it("shows a fallback error message when createMap rejects with a non-Error value", async () => {
    const user = userEvent.setup();
    mockedCreateMap.mockRejectedValue("boom");
    render(<MapForm />);

    await user.click(screen.getByText("Habit"));
    await user.type(screen.getByPlaceholderText(/fitness goals/i), "My map");
    await user.click(screen.getByText("Create map"));

    expect(await screen.findByText("Failed to create map")).toBeInTheDocument();
  });

  // --- word limit (NEW — not yet implemented) ---

  it("allows exactly 10 words with no over-limit hint, and enables submit", async () => {
    const user = userEvent.setup();
    render(<MapForm />);

    await user.click(screen.getByText("Project"));
    await user.type(
      screen.getByPlaceholderText(/fitness goals/i),
      "one two three four five six seven eight nine ten",
    );

    expect(
      screen.queryByText(/must be 10 words or fewer/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Create map")).not.toBeDisabled();
  });

  it("shows an inline hint with the exact word count and disables submit when the name exceeds 10 words", async () => {
    const user = userEvent.setup();
    render(<MapForm />);

    await user.click(screen.getByText("Project"));
    await user.type(
      screen.getByPlaceholderText(/fitness goals/i),
      "one two three four five six seven eight nine ten eleven",
    );

    // Exact wording per the contract: "Name must be 10 words or fewer (got 11)"
    expect(
      screen.getByText("Name must be 10 words or fewer (got 11)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Create map")).toBeDisabled();
  });

  it("removes the over-limit hint and re-enables submit once the name is trimmed back under the limit", async () => {
    const user = userEvent.setup();
    render(<MapForm />);

    await user.click(screen.getByText("Project"));
    const input = screen.getByPlaceholderText(/fitness goals/i);
    await user.type(
      input,
      "one two three four five six seven eight nine ten eleven",
    );
    expect(
      screen.getByText("Name must be 10 words or fewer (got 11)"),
    ).toBeInTheDocument();

    // Delete the trailing " eleven" to bring the count back down to 10 words.
    await user.clear(input);
    await user.type(input, "one two three four five six seven eight nine ten");

    expect(
      screen.queryByText(/must be 10 words or fewer/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Create map")).not.toBeDisabled();
  });

  it("renders the over-limit hint as a distinct, unambiguous element from the bottom submit-error block", async () => {
    const user = userEvent.setup();
    render(<MapForm />);

    await user.click(screen.getByText("Project"));
    await user.type(
      screen.getByPlaceholderText(/fitness goals/i),
      "one two three four five six seven eight nine ten eleven twelve",
    );

    // Query by the hint's exact text (not just the shared .map-form-error class)
    // so this assertion stays valid even if a bottom submit-error is also present.
    const hint = screen.getByText("Name must be 10 words or fewer (got 12)");
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveClass("map-form-error");
    // No submit-failure error should be present yet since submit was never attempted.
    expect(screen.queryByText(/failed to create map/i)).not.toBeInTheDocument();
  });
});
