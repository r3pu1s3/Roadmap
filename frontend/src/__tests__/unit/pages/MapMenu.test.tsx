import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import MapMenu from "../../../pages/MapMenu";
import { getMaps, updateMap, type MapResponse } from "../../../apis/MapApi";

vi.mock("../../../apis/MapApi");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockedGetMaps = vi.mocked(getMaps);
const mockedUpdateMap = vi.mocked(updateMap);

// Deferred promise helper so mid-flight (pending) states can be inspected
// before manually resolving/rejecting.
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const maps: MapResponse[] = [
  { id: 1, name: "Fitness Goals", type: "Project" },
  { id: 2, name: "Daily Habits", type: "Habit" },
  { id: 3, name: "Reading List", type: "Project" },
];

function renderMenu() {
  return render(
    <MemoryRouter>
      <MapMenu />
    </MemoryRouter>,
  );
}

describe("MapMenu", () => {
  beforeEach(() => {
    mockedGetMaps.mockReset();
    mockedUpdateMap.mockReset();
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

  // --- loading state ---

  it("shows the loading status while getMaps() is pending", () => {
    // Never-resolving promise freezes the component mid-fetch.
    mockedGetMaps.mockReturnValue(new Promise(() => {}));
    renderMenu();

    expect(mockedGetMaps).toHaveBeenCalledTimes(1);
    const status = screen.getByText("Loading maps…");
    expect(status).toBeInTheDocument();
    expect(status).toHaveClass("map-menu-status");
  });

  // --- error state ---

  it("shows the rejected Error's message when getMaps() rejects", async () => {
    mockedGetMaps.mockRejectedValue(new Error("Server exploded"));
    renderMenu();

    const error = await screen.findByText("Server exploded");
    expect(error).toHaveClass("map-menu-error");
  });

  it("shows a fallback error message when getMaps() rejects with a non-Error value", async () => {
    mockedGetMaps.mockRejectedValue("boom");
    renderMenu();

    const error = await screen.findByText("Failed to load maps");
    expect(error).toHaveClass("map-menu-error");
  });

  // --- empty state ---

  it("shows the empty-state message when getMaps() resolves to an empty array", async () => {
    mockedGetMaps.mockResolvedValue([]);
    renderMenu();

    const status = await screen.findByText(
      "No maps yet — create one to get started.",
    );
    expect(status).toHaveClass("map-menu-status");
  });

  // --- persistent "new map" link ---

  it("always renders the '+ New Map' link pointing at /maps/new, across loading/error/empty/loaded states", async () => {
    // Loading
    mockedGetMaps.mockReturnValue(new Promise(() => {}));
    const { unmount: unmountLoading } = renderMenu();
    expect(
      screen.getByRole("link", { name: /create map/i }).getAttribute("href"),
    ).toBe("/maps/new");
    unmountLoading();
    cleanup();

    // Error
    mockedGetMaps.mockRejectedValue(new Error("nope"));
    const { unmount: unmountError } = renderMenu();
    await screen.findByText("nope");
    expect(
      screen.getByRole("link", { name: /create map/i }).getAttribute("href"),
    ).toBe("/maps/new");
    unmountError();
    cleanup();

    // Empty
    mockedGetMaps.mockResolvedValue([]);
    const { unmount: unmountEmpty } = renderMenu();
    await screen.findByText("No maps yet — create one to get started.");
    expect(
      screen.getByRole("link", { name: /create map/i }).getAttribute("href"),
    ).toBe("/maps/new");
    unmountEmpty();
    cleanup();

    // Loaded with maps
    mockedGetMaps.mockResolvedValue(maps);
    renderMenu();
    await screen.findByText("Fitness Goals");
    expect(
      screen.getByRole("link", { name: /create map/i }).getAttribute("href"),
    ).toBe("/maps/new");
  });

  // --- rendering the list ---

  it("renders one .map-menu-row per map, in the order returned by getMaps(), with name and type", async () => {
    mockedGetMaps.mockResolvedValue(maps);
    const { container } = renderMenu();

    await screen.findByText("Fitness Goals");

    const rows = container.querySelectorAll(".map-menu-row");
    expect(rows).toHaveLength(3);

    const names = Array.from(
      container.querySelectorAll(".map-menu-row-name"),
    ).map((el) => el.textContent);
    expect(names).toEqual(["Fitness Goals", "Daily Habits", "Reading List"]);

    const types = Array.from(
      container.querySelectorAll(".map-menu-row-type"),
    ).map((el) => el.textContent);
    expect(types).toEqual(["Project", "Habit", "Project"]);
  });

  // --- row navigation ---

  it("navigates to /maps/{id} when a row is clicked (not the rename icon)", async () => {
    const user = userEvent.setup();
    mockedGetMaps.mockResolvedValue(maps);
    renderMenu();

    await screen.findByText("Daily Habits");
    await user.click(screen.getByText("Daily Habits"));

    expect(mockNavigate).toHaveBeenCalledWith("/maps/2");
  });

  // --- rename icon: enters edit mode without navigating ---

  it("clicking the rename icon does not navigate and switches that row into edit mode", async () => {
    const user = userEvent.setup();
    mockedGetMaps.mockResolvedValue(maps);
    renderMenu();

    await screen.findByText("Fitness Goals");
    await user.click(screen.getByLabelText("Rename Fitness Goals"));

    expect(mockNavigate).not.toHaveBeenCalled();

    const input = screen.getByLabelText("New map name");
    expect(input).toHaveValue("Fitness Goals");
    expect(input).toHaveFocus(); // autoFocus per contract
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("clicking the row background while that row is in edit mode does not navigate", async () => {
    const user = userEvent.setup();
    mockedGetMaps.mockResolvedValue(maps);
    renderMenu();

    await screen.findByText("Fitness Goals");
    await user.click(screen.getByLabelText("Rename Fitness Goals"));
    mockNavigate.mockReset(); // clear out any calls from opening edit mode

    // The input is part of the row background (not the rename icon); clicking
    // it must not trigger the row's navigate-on-click behavior.
    await user.click(screen.getByLabelText("New map name"));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // --- word-limit validation (mirrors MapForm) ---

  it("allows exactly 10 words in the edit input with no error, Save enabled", async () => {
    const user = userEvent.setup();
    mockedGetMaps.mockResolvedValue(maps);
    renderMenu();

    await screen.findByText("Fitness Goals");
    await user.click(screen.getByLabelText("Rename Fitness Goals"));
    const input = screen.getByLabelText("New map name");
    await user.clear(input);
    await user.type(input, "one two three four five six seven eight nine ten");

    expect(
      screen.queryByText(/must be 10 words or fewer/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Save")).not.toBeDisabled();
  });

  it("shows the exact over-limit error and disables Save when the edit input exceeds 10 words", async () => {
    const user = userEvent.setup();
    mockedGetMaps.mockResolvedValue(maps);
    renderMenu();

    await screen.findByText("Fitness Goals");
    await user.click(screen.getByLabelText("Rename Fitness Goals"));
    const input = screen.getByLabelText("New map name");
    await user.clear(input);
    await user.type(
      input,
      "one two three four five six seven eight nine ten eleven",
    );

    const error = screen.getByText("Name must be 10 words or fewer (got 11)");
    expect(error).toHaveClass("map-menu-edit-error");
    expect(screen.getByText("Save")).toBeDisabled();
  });

  // --- saving an edit ---

  it("calls updateMap with the trimmed name on Save, and updates the row from the response on success", async () => {
    const user = userEvent.setup();
    mockedGetMaps.mockResolvedValue(maps);
    mockedUpdateMap.mockResolvedValue({
      id: 1,
      name: "Fitness Goals 2.0",
      type: "Habit",
    });
    renderMenu();

    await screen.findByText("Fitness Goals");
    await user.click(screen.getByLabelText("Rename Fitness Goals"));
    const input = screen.getByLabelText("New map name");
    await user.clear(input);
    await user.type(input, "  Fitness Goals 2.0  ");
    await user.click(screen.getByText("Save"));

    expect(mockedUpdateMap).toHaveBeenCalledWith(1, {
      name: "Fitness Goals 2.0",
    });

    // Row reflects the server response and exits edit mode.
    expect(await screen.findByText("Fitness Goals 2.0")).toHaveClass(
      "map-menu-row-name",
    );
    expect(screen.queryByLabelText("New map name")).not.toBeInTheDocument();
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  it("shows the rejected error and keeps edit mode (with the unsaved text) when updateMap rejects", async () => {
    const user = userEvent.setup();
    mockedGetMaps.mockResolvedValue(maps);
    mockedUpdateMap.mockRejectedValue(new Error("Server error"));
    renderMenu();

    await screen.findByText("Fitness Goals");
    await user.click(screen.getByLabelText("Rename Fitness Goals"));
    const input = screen.getByLabelText("New map name");
    await user.clear(input);
    await user.type(input, "Attempted Rename");
    await user.click(screen.getByText("Save"));

    const error = await screen.findByText("Server error");
    expect(error).toHaveClass("map-menu-edit-error");
    // Still in edit mode, with the user's unsaved text intact.
    expect(screen.getByLabelText("New map name")).toHaveValue(
      "Attempted Rename",
    );
  });

  it("shows a fallback error message when updateMap rejects with a non-Error value", async () => {
    const user = userEvent.setup();
    mockedGetMaps.mockResolvedValue(maps);
    mockedUpdateMap.mockRejectedValue("boom");
    renderMenu();

    await screen.findByText("Fitness Goals");
    await user.click(screen.getByLabelText("Rename Fitness Goals"));
    const input = screen.getByLabelText("New map name");
    await user.clear(input);
    await user.type(input, "Attempted Rename");
    await user.click(screen.getByText("Save"));

    const error = await screen.findByText("Failed to update map");
    expect(error).toHaveClass("map-menu-edit-error");
  });

  it("disables Save while a save is in-flight", async () => {
    const user = userEvent.setup();
    mockedGetMaps.mockResolvedValue(maps);
    const deferred = createDeferred<MapResponse>();
    mockedUpdateMap.mockReturnValue(deferred.promise);
    renderMenu();

    await screen.findByText("Fitness Goals");
    await user.click(screen.getByLabelText("Rename Fitness Goals"));
    const input = screen.getByLabelText("New map name");
    await user.clear(input);
    await user.type(input, "Renamed While Saving");
    await user.click(screen.getByText("Save"));

    expect(screen.getByText("Save")).toBeDisabled();

    deferred.resolve({ id: 1, name: "Renamed While Saving", type: "Project" });
    await screen.findByText("Renamed While Saving");
  });

  // --- cancel ---

  it("clicking Cancel exits edit mode without calling updateMap, and discards the draft on reopen", async () => {
    const user = userEvent.setup();
    mockedGetMaps.mockResolvedValue(maps);
    renderMenu();

    await screen.findByText("Fitness Goals");
    await user.click(screen.getByLabelText("Rename Fitness Goals"));
    const input = screen.getByLabelText("New map name");
    await user.clear(input);
    await user.type(input, "Garbage Draft");
    await user.click(screen.getByText("Cancel"));

    expect(mockedUpdateMap).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("New map name")).not.toBeInTheDocument();
    // Original name is still displayed, unaffected by the discarded draft.
    expect(screen.getByText("Fitness Goals")).toHaveClass("map-menu-row-name");

    // Reopening edit mode must show the original name, not "Garbage Draft".
    await user.click(screen.getByLabelText("Rename Fitness Goals"));
    expect(screen.getByLabelText("New map name")).toHaveValue("Fitness Goals");
  });

  // --- row isolation ---

  it("editing one row does not affect another row's displayed data or edit state", async () => {
    const user = userEvent.setup();
    mockedGetMaps.mockResolvedValue(maps);
    renderMenu();

    await screen.findByText("Fitness Goals");
    await user.click(screen.getByLabelText("Rename Fitness Goals"));
    const input = screen.getByLabelText("New map name");
    await user.clear(input);
    await user.type(input, "Garbled Text For Row A Only");

    // Row B (Daily Habits) is untouched: still shows its normal name/type,
    // and has no edit controls of its own.
    const rowBName = screen.getByText("Daily Habits");
    expect(rowBName).toHaveClass("map-menu-row-name");
    // The rename icon for row B should still be present and clickable (i.e.
    // row B is not itself stuck in some edit-adjacent state).
    expect(screen.getByLabelText("Rename Daily Habits")).toBeInTheDocument();
    // Only one edit input exists in the whole document (row A's).
    expect(screen.getAllByLabelText("New map name")).toHaveLength(1);
  });
});
