import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Map from "../../../pages/Map";
import { createObjective, updateObjective } from "../../../apis/ObjectiveApi";
import {
  createObjectiveEdge,
  deleteObjectiveEdge,
} from "../../../apis/ObjectiveEdgeApi";
import { getMap } from "../../../apis/MapApi";

// This is an integration-style test in spirit — it exercises Map.tsx together
// with the real ObjectiveSidebar, ObjectiveEditSidebar, Objective (node), and
// (per the hydration/Exit-button plan) the real CanvasErrorBanner and
// CanvasExitButton components, only mocking the API layer, react-router-dom's
// useParams/useNavigate, and window.confirm — but it lives alongside the
// other page tests per this repo's single (unit-only) frontend test tier;
// see frontend-tester's remit in CLAUDE.md.

// useNavigate is stubbed to a hoisted vi.fn() so the react-router-dom mock
// factory below (itself hoisted above all imports by vitest) can close over
// it, and so every test/describe block can assert on it directly.
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("../../../apis/MapApi");
vi.mock("../../../apis/ObjectiveApi");
vi.mock("../../../apis/ObjectiveEdgeApi");
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useParams: () => ({ mapId: "5" }),
    useNavigate: () => mockNavigate,
  };
});

// Partial mock of @xyflow/react: still renders the REAL <ReactFlow> (so every
// existing pane/node-click test below keeps exercising real DOM/geometry
// unchanged), but stashes the exact props Map.tsx passes to it on every
// render onto `globalThis.__rfProps`. The edge tests further down read
// onConnect/onEdgesChange off that stash and invoke them directly, since a
// real drag-to-connect or select-edge-then-Delete gesture can't be driven
// through jsdom (no working pointer/handle geometry) — see getRfProps below.
vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    ReactFlow: (props: Record<string, unknown>) => {
      (globalThis as Record<string, unknown>).__rfProps = props;
      // actual.ReactFlow is a forwardRef/memo component, not a plain
      // function — it must be rendered via createElement, not called
      // directly, or React throws ("actual.ReactFlow is not a function").
      return createElement(actual.ReactFlow, props as never);
    },
  };
});

// @xyflow/react's viewport/pane sizing depends on ResizeObserver, which jsdom
// does not implement. Scoped locally to this file since it's the only place
// in the repo that renders a real <ReactFlow> tree.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", MockResizeObserver);

const mockedCreateObjective = vi.mocked(createObjective);
const mockedUpdateObjective = vi.mocked(updateObjective);
const mockedCreateObjectiveEdge = vi.mocked(createObjectiveEdge);
const mockedDeleteObjectiveEdge = vi.mocked(deleteObjectiveEdge);
const mockedGetMap = vi.mocked(getMap);

// Clicking React Flow's pane/nodes triggers d3-zoom's mousedown handling,
// which crashes in jsdom when driven by userEvent's full pointer-event
// sequence (d3-drag's nodrag.js reads `event.view.document` off a null
// event). A plain fireEvent.click bypasses that and is sufficient here,
// since onPaneClick/onNodeClick only care about a "click" firing at all.
function clickPane(container: HTMLElement) {
  const pane = container.querySelector(".react-flow__pane");
  if (!pane) throw new Error("pane not found");
  fireEvent.click(pane);
}

function getNodeElements(container: HTMLElement) {
  return container.querySelectorAll(".react-flow__node");
}

// Map.tsx now fetches the full graph via getMap on mount (see the
// "hydration" describe block below) and shows "Loading map…" until that
// resolves. The default beforeEach mock below resolves immediately, but it's
// still a real promise microtask — every test that touches the canvas (via
// clickPane, node clicks, etc.) must wait for hydration to finish first, or
// .react-flow__pane won't exist yet.
async function waitForHydrated() {
  await waitFor(() => {
    expect(screen.queryByText("Loading map…")).not.toBeInTheDocument();
  });
}

// --- edge creation/deletion test helpers ---
//
// IMPORTANT jsdom limitation, confirmed empirically (not an implementation
// bug to chase): @xyflow/react only renders a `.react-flow__edge` element
// once it has real handle-bounds geometry, which it computes from a
// ResizeObserver callback firing on each node. The MockResizeObserver above
// (like every @xyflow/react jsdom test suite needs) never actually fires
// that callback, so even a real two-node/one-edge <ReactFlow> tree renders
// zero `.react-flow__edge` elements in this environment — this was verified
// with a standalone probe render before writing these tests. So "an edge is
// rendered" is asserted here via the `edges` (and, for hydration, `nodes`)
// array actually being passed as a prop to the real <ReactFlow> (captured
// below), not via DOM querying.
function getRfProps() {
  return (globalThis as Record<string, unknown>).__rfProps as {
    onConnect: (connection: {
      source: string;
      target: string;
      sourceHandle: string | null;
      targetHandle: string | null;
    }) => unknown;
    onEdgesChange: (changes: { type: "remove"; id: string }[]) => unknown;
    nodes: {
      id: string;
      position: { x: number; y: number };
      data?: Record<string, unknown>;
    }[];
    edges: {
      id: string;
      source: string;
      target: string;
      data?: Record<string, unknown>;
    }[];
    nodesConnectable: boolean;
  };
}

async function invokeOnConnect(connection: { source: string; target: string }) {
  await act(async () => {
    await getRfProps().onConnect({
      sourceHandle: null,
      targetHandle: null,
      ...connection,
    });
  });
}

async function invokeOnEdgesChange(id: string) {
  await act(async () => {
    await getRfProps().onEdgesChange([{ type: "remove", id }]);
  });
}

function getLocalNodeIds(container: HTMLElement): string[] {
  return Array.from(getNodeElements(container)).map(
    (el) => el.getAttribute("data-id") as string,
  );
}

async function createSavedNode(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
  objective: { id: number; description: string },
) {
  mockedCreateObjective.mockResolvedValueOnce({
    id: objective.id,
    mapId: 5,
    description: objective.description,
    isTask: false,
    counter: null,
  });
  await createObjectiveViaUI(user, container, {
    type: "Objective",
    description: objective.description,
  });
}

async function createObjectiveViaUI(
  user: ReturnType<typeof userEvent.setup>,
  container: HTMLElement,
  { type, description }: { type: "Objective" | "Task"; description: string },
) {
  // Every caller starts from a fresh render, so hydration must settle before
  // the pane exists to click.
  await waitForHydrated();
  clickPane(container);
  await user.click(screen.getByText(type));
  await user.type(
    screen.getByPlaceholderText(
      type === "Task"
        ? /do \{pushups\} pushups every morning/i
        : /get stronger this year/i,
    ),
    description,
  );
  await user.click(screen.getByText("Submit"));
}

describe("Map", () => {
  beforeEach(() => {
    mockedCreateObjective.mockReset();
    mockedUpdateObjective.mockReset();
    mockedCreateObjectiveEdge.mockReset();
    mockedDeleteObjectiveEdge.mockReset();
    mockedGetMap.mockReset();
    // Auto-resolving default so every pre-existing create/edit/connect/delete
    // test below reaches loadState "loaded" with an empty graph without
    // having to know about hydration at all. Tests that care about
    // hydration itself override this per-case with mockResolvedValueOnce /
    // mockRejectedValueOnce / a manually-controlled promise.
    mockedGetMap.mockResolvedValue({
      id: 5,
      name: "Test Map",
      type: "Project",
      objectives: [],
      edges: [],
    });
    mockNavigate.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  // --- hydration (loading the map's graph on mount) ---
  //
  // Note: the file-wide useParams mock always returns mapId "5", so
  // re-fetching on a changed :mapId route param is not (and cannot be)
  // exercised here — that's an accepted limitation of this static mock, not
  // something these tests attempt to work around.

  describe("hydration", () => {
    it("shows 'Loading map…' before the getMap promise resolves", () => {
      // A promise that never resolves keeps the page in the loading state
      // for the lifetime of this test, so we can assert the loading text
      // appears synchronously right after the initial render.
      mockedGetMap.mockReturnValue(new Promise(() => {}));

      render(<Map />);

      expect(screen.getByText("Loading map…")).toBeInTheDocument();
    });

    it("renders one canvas node per objective, with data reflecting id/description/isTask/counter", async () => {
      mockedGetMap.mockResolvedValueOnce({
        id: 5,
        name: "Test Map",
        type: "Project",
        objectives: [
          {
            id: 1,
            mapId: 5,
            description: "Get stronger",
            isTask: false,
            counter: null,
          },
          {
            id: 2,
            mapId: 5,
            description: "Do {reps} pushups",
            isTask: true,
            counter: { id: 1, label: "reps", targetQuantity: 20 },
          },
        ],
        edges: [],
      });
      const { container } = render(<Map />);

      await waitForHydrated();

      expect(getNodeElements(container)).toHaveLength(2);
      const nodeById = (id: number) =>
        getRfProps().nodes.find((n) => n.id === String(id));

      expect(nodeById(1)?.data).toMatchObject({
        id: 1,
        description: "Get stronger",
        isTask: false,
        counter: null,
      });
      expect(nodeById(2)?.data).toMatchObject({
        id: 2,
        description: "Do {reps} pushups",
        isTask: true,
        counter: { id: 1, label: "reps", targetQuantity: 20 },
      });
    });

    it("passes an edges array to <ReactFlow> reflecting parentId/childId/dbId, sourced/targeted at the matching node ids", async () => {
      mockedGetMap.mockResolvedValueOnce({
        id: 5,
        name: "Test Map",
        type: "Project",
        objectives: [
          { id: 1, mapId: 5, description: "A", isTask: false, counter: null },
          { id: 2, mapId: 5, description: "B", isTask: false, counter: null },
        ],
        edges: [{ id: 500, parentId: 1, childId: 2 }],
      });
      render(<Map />);

      await waitForHydrated();

      expect(getRfProps().edges).toHaveLength(1);
      const [edge] = getRfProps().edges;
      expect(edge.data).toMatchObject({ dbId: 500, parentId: 1, childId: 2 });
      // Directionality convention matches handleConnect elsewhere in this
      // file: the child objective's node is the edge's source, the parent
      // objective's node is the edge's target.
      expect(edge.source).toBe("2");
      expect(edge.target).toBe("1");
    });

    it("lays out a fixture chain A -> B -> C with the source lower on the canvas than its descendants (source at bottom, terminal at top)", async () => {
      mockedGetMap.mockResolvedValueOnce({
        id: 5,
        name: "Test Map",
        type: "Project",
        objectives: [
          { id: 1, mapId: 5, description: "A", isTask: false, counter: null },
          { id: 2, mapId: 5, description: "B", isTask: false, counter: null },
          { id: 3, mapId: 5, description: "C", isTask: false, counter: null },
        ],
        // Child is upstream/first, parent is downstream/later: A leads to
        // B leads to C, i.e. A -> B -> C.
        edges: [
          { id: 500, parentId: 2, childId: 1 },
          { id: 501, parentId: 3, childId: 2 },
        ],
      });
      render(<Map />);

      await waitForHydrated();

      const yOf = (id: number) =>
        getRfProps().nodes.find((n) => n.id === String(id))?.position.y as
          number | undefined;

      // Loose relative-ordering check only, per the plan — not exact pixels.
      expect(yOf(1)).toBeGreaterThan(yOf(2) as number);
      expect(yOf(2)).toBeGreaterThan(yOf(3) as number);
    });

    it("shows the thrown Error's message in the error banner when getMap rejects", async () => {
      mockedGetMap.mockRejectedValueOnce(new Error("Map not found"));

      render(<Map />);

      expect(await screen.findByText("Map not found")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("shows a fallback error message when getMap rejects with a non-Error value", async () => {
      mockedGetMap.mockRejectedValueOnce("boom");

      render(<Map />);

      // The plan doesn't pin down exact fallback wording (consistent with
      // this file's other non-Error fallback assertions), so this only
      // checks *some* non-empty alert text is shown.
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBeTruthy();
    });
  });

  // --- initial render ---

  it("renders the canvas with no nodes and no sidebar open", () => {
    const { container } = render(<Map />);

    expect(getNodeElements(container)).toHaveLength(0);
    expect(screen.queryByText("New node")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/edit (objective|task)/i),
    ).not.toBeInTheDocument();
  });

  // --- opening the create sidebar ---

  it("opens the create sidebar when the empty canvas is clicked", async () => {
    const { container } = render(<Map />);
    await waitForHydrated();

    clickPane(container);

    expect(screen.getByText("New node")).toBeInTheDocument();
  });

  it("adds a placeholder node to the canvas immediately on pane click, before any save", async () => {
    const { container } = render(<Map />);
    await waitForHydrated();

    clickPane(container);

    expect(getNodeElements(container)).toHaveLength(1);
  });

  // --- cancelling create ---

  it("removes the placeholder node and closes the sidebar when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<Map />);
    await waitForHydrated();

    clickPane(container);
    await user.click(screen.getByText("Cancel"));

    expect(screen.queryByText("New node")).not.toBeInTheDocument();
    expect(getNodeElements(container)).toHaveLength(0);
  });

  it("still works correctly on a second pane click after cancelling the first", async () => {
    const user = userEvent.setup();
    const { container } = render(<Map />);
    await waitForHydrated();

    clickPane(container);
    await user.click(screen.getByText("Cancel"));
    clickPane(container);

    expect(screen.getByText("New node")).toBeInTheDocument();
    expect(getNodeElements(container)).toHaveLength(1);
  });

  // --- create: happy path ---

  it("calls createObjective with description, isTask, and mapId parsed from the route", async () => {
    const user = userEvent.setup();
    mockedCreateObjective.mockResolvedValue({
      id: 42,
      mapId: 5,
      description: "Get stronger",
      isTask: false,
      counter: null,
    });
    const { container } = render(<Map />);

    await createObjectiveViaUI(user, container, {
      type: "Objective",
      description: "Get stronger",
    });

    expect(mockedCreateObjective).toHaveBeenCalledWith({
      description: "Get stronger",
      isTask: false,
      mapId: 5,
    });
  });

  it("closes the create sidebar and shows no error after a successful create", async () => {
    const user = userEvent.setup();
    mockedCreateObjective.mockResolvedValue({
      id: 42,
      mapId: 5,
      description: "Get stronger",
      isTask: false,
      counter: null,
    });
    const { container } = render(<Map />);

    await createObjectiveViaUI(user, container, {
      type: "Objective",
      description: "Get stronger",
    });

    expect(screen.queryByText("New node")).not.toBeInTheDocument();
    expect(screen.queryByText(/failed to save/i)).not.toBeInTheDocument();
  });

  // --- create: saving state ---

  it("shows 'Saving…' and disables Submit while createObjective is pending", async () => {
    const user = userEvent.setup();
    mockedCreateObjective.mockReturnValue(new Promise(() => {}));
    const { container } = render(<Map />);
    await waitForHydrated();

    clickPane(container);
    await user.click(screen.getByText("Objective"));
    await user.type(
      screen.getByPlaceholderText(/get stronger this year/i),
      "Get stronger",
    );
    await user.click(screen.getByText("Submit"));

    expect(await screen.findByText("Saving…")).toBeInTheDocument();
    expect(screen.getByText("Saving…")).toBeDisabled();
  });

  // --- create: error handling ---

  it("keeps the sidebar open and shows the thrown Error's message when createObjective rejects", async () => {
    const user = userEvent.setup();
    mockedCreateObjective.mockRejectedValue(
      new Error("mapId does not reference an existing map"),
    );
    const { container } = render(<Map />);

    await createObjectiveViaUI(user, container, {
      type: "Objective",
      description: "Get stronger",
    });

    expect(
      await screen.findByText("mapId does not reference an existing map"),
    ).toBeInTheDocument();
    expect(screen.getByText("New objective")).toBeInTheDocument();
    // isSaving reset — Submit is enabled again, not stuck on "Saving…"
    expect(screen.getByText("Submit")).not.toBeDisabled();
  });

  it("shows the fallback error message when createObjective rejects with a non-Error value", async () => {
    const user = userEvent.setup();
    mockedCreateObjective.mockRejectedValue("boom");
    const { container } = render(<Map />);

    await createObjectiveViaUI(user, container, {
      type: "Objective",
      description: "Get stronger",
    });

    expect(
      await screen.findByText("Failed to save goal node"),
    ).toBeInTheDocument();
  });

  // --- node click: unsaved placeholder ---

  it("does not open the edit sidebar when clicking a node while the create sidebar is still open", async () => {
    const user = userEvent.setup();
    const { container } = render(<Map />);
    await waitForHydrated();

    clickPane(container);
    await user.click(screen.getByText("Objective"));

    const [nodeEl] = getNodeElements(container);
    fireEvent.click(nodeEl);

    expect(
      screen.queryByText(/edit (objective|task)/i),
    ).not.toBeInTheDocument();
    // the create sidebar is still the one open, undisturbed
    expect(screen.getByText("New objective")).toBeInTheDocument();
  });

  // --- node click: saved objective opens edit sidebar ---

  it("opens the edit sidebar pre-filled with the saved objective's data when its node is clicked", async () => {
    const user = userEvent.setup();
    mockedCreateObjective.mockResolvedValue({
      id: 42,
      mapId: 5,
      description: "Get stronger",
      isTask: false,
      counter: null,
    });
    const { container } = render(<Map />);

    await createObjectiveViaUI(user, container, {
      type: "Objective",
      description: "Get stronger",
    });

    const [nodeEl] = getNodeElements(container);
    fireEvent.click(nodeEl);

    expect(screen.getByText("Edit objective")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Get stronger")).toBeInTheDocument();
  });

  // --- edit: happy path ---

  it("calls updateObjective with the objective's id and the edited description/isTask only", async () => {
    const user = userEvent.setup();
    mockedCreateObjective.mockResolvedValue({
      id: 42,
      mapId: 5,
      description: "Get stronger",
      isTask: false,
      counter: null,
    });
    mockedUpdateObjective.mockResolvedValue({
      id: 42,
      mapId: 5,
      description: "Get even stronger",
      isTask: false,
      counter: null,
    });
    const { container } = render(<Map />);

    await createObjectiveViaUI(user, container, {
      type: "Objective",
      description: "Get stronger",
    });
    fireEvent.click(getNodeElements(container)[0]);

    const textarea = screen.getByDisplayValue("Get stronger");
    await user.clear(textarea);
    await user.type(textarea, "Get even stronger");
    await user.click(screen.getByText("Save"));

    expect(mockedUpdateObjective).toHaveBeenCalledWith(42, {
      description: "Get even stronger",
      isTask: false,
    });
  });

  it("closes the edit sidebar and reflects the new description the next time the node is clicked", async () => {
    const user = userEvent.setup();
    mockedCreateObjective.mockResolvedValue({
      id: 42,
      mapId: 5,
      description: "Get stronger",
      isTask: false,
      counter: null,
    });
    mockedUpdateObjective.mockResolvedValue({
      id: 42,
      mapId: 5,
      description: "Get even stronger",
      isTask: false,
      counter: null,
    });
    const { container } = render(<Map />);

    await createObjectiveViaUI(user, container, {
      type: "Objective",
      description: "Get stronger",
    });
    fireEvent.click(getNodeElements(container)[0]);

    const textarea = screen.getByDisplayValue("Get stronger");
    await user.clear(textarea);
    await user.type(textarea, "Get even stronger");
    await user.click(screen.getByText("Save"));

    expect(screen.queryByText("Edit objective")).not.toBeInTheDocument();

    fireEvent.click(getNodeElements(container)[0]);
    expect(screen.getByDisplayValue("Get even stronger")).toBeInTheDocument();
  });

  // --- edit: saving state ---

  it("shows 'Saving…' and disables Save while updateObjective is pending", async () => {
    const user = userEvent.setup();
    mockedCreateObjective.mockResolvedValue({
      id: 42,
      mapId: 5,
      description: "Get stronger",
      isTask: false,
      counter: null,
    });
    mockedUpdateObjective.mockReturnValue(new Promise(() => {}));
    const { container } = render(<Map />);

    await createObjectiveViaUI(user, container, {
      type: "Objective",
      description: "Get stronger",
    });
    fireEvent.click(getNodeElements(container)[0]);
    await user.click(screen.getByText("Save"));

    expect(await screen.findByText("Saving…")).toBeInTheDocument();
    expect(screen.getByText("Saving…")).toBeDisabled();
  });

  // --- edit: error handling ---

  it("keeps the edit sidebar open and shows the thrown Error's message when updateObjective rejects", async () => {
    const user = userEvent.setup();
    mockedCreateObjective.mockResolvedValue({
      id: 42,
      mapId: 5,
      description: "Get stronger",
      isTask: false,
      counter: null,
    });
    mockedUpdateObjective.mockRejectedValue(
      new Error("description is required"),
    );
    const { container } = render(<Map />);

    await createObjectiveViaUI(user, container, {
      type: "Objective",
      description: "Get stronger",
    });
    fireEvent.click(getNodeElements(container)[0]);
    await user.click(screen.getByText("Save"));

    expect(
      await screen.findByText("description is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Edit objective")).toBeInTheDocument();
  });

  it("shows the fallback error message when updateObjective rejects with a non-Error value", async () => {
    const user = userEvent.setup();
    mockedCreateObjective.mockResolvedValue({
      id: 42,
      mapId: 5,
      description: "Get stronger",
      isTask: false,
      counter: null,
    });
    mockedUpdateObjective.mockRejectedValue("boom");
    const { container } = render(<Map />);

    await createObjectiveViaUI(user, container, {
      type: "Objective",
      description: "Get stronger",
    });
    fireEvent.click(getNodeElements(container)[0]);
    await user.click(screen.getByText("Save"));

    expect(
      await screen.findByText("Failed to update objective"),
    ).toBeInTheDocument();
  });

  // --- concurrent-open guard ---

  it("ignores a second pane click while the create sidebar is already open", async () => {
    const user = userEvent.setup();
    const { container } = render(<Map />);
    await waitForHydrated();

    clickPane(container);
    await user.click(screen.getByText("Objective"));
    clickPane(container);

    // still on the description step of the *first* node — a second
    // placeholder was not added
    expect(getNodeElements(container)).toHaveLength(1);
    expect(screen.getByText("New objective")).toBeInTheDocument();
  });

  // --- connecting objectives (onConnect) ---

  describe("connecting objectives", () => {
    it("creates an edge between two saved nodes with correct parentId/childId directionality and shows no error", async () => {
      const user = userEvent.setup();
      const { container } = render(<Map />);

      await createSavedNode(user, container, { id: 42, description: "A" });
      await createSavedNode(user, container, { id: 43, description: "B" });
      const [sourceId, targetId] = getLocalNodeIds(container);

      mockedCreateObjectiveEdge.mockResolvedValueOnce({
        id: 100,
        parentId: 43,
        childId: 42,
      });

      await invokeOnConnect({ source: sourceId, target: targetId });

      // Directionality per the plan: the node the drag STARTED from
      // (`connection.source`) is the child; the node it was DROPPED on
      // (`connection.target`) is the parent.
      expect(mockedCreateObjectiveEdge).toHaveBeenCalledWith({
        parentId: 43,
        childId: 42,
      });
      await waitFor(() => expect(getRfProps().edges).toHaveLength(1));
      expect(getRfProps().edges[0].data).toMatchObject({
        dbId: 100,
        parentId: 43,
        childId: 42,
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not call createObjectiveEdge and shows a 'must be saved' error when one endpoint is an unsaved placeholder node", async () => {
      const user = userEvent.setup();
      const { container } = render(<Map />);

      await createSavedNode(user, container, { id: 42, description: "A" });
      // A second node started via a pane click but never submitted — it has
      // no database id yet, so it's still just a local placeholder.
      clickPane(container);
      const [savedId, unsavedId] = getLocalNodeIds(container);

      await invokeOnConnect({ source: unsavedId, target: savedId });

      expect(mockedCreateObjectiveEdge).not.toHaveBeenCalled();
      expect(await screen.findByText(/must be saved/i)).toBeInTheDocument();
    });

    it("rejects a connection that would create a session-local cycle, without a third API call", async () => {
      const user = userEvent.setup();
      const { container } = render(<Map />);

      await createSavedNode(user, container, { id: 1, description: "A" });
      await createSavedNode(user, container, { id: 2, description: "B" });
      await createSavedNode(user, container, { id: 3, description: "C" });
      const [idA, idB, idC] = getLocalNodeIds(container);

      // Build A -> B -> C first (A leads to B, B leads to C), both
      // succeeding against the (mocked) API. Directionality: the dragged-FROM
      // node (source) is the child (upstream/first), the dropped-ON node
      // (target) is the parent (downstream/later) — so "A -> B" is built by
      // dragging FROM A TO B.
      mockedCreateObjectiveEdge.mockResolvedValueOnce({
        id: 201,
        parentId: 2,
        childId: 1,
      });
      await invokeOnConnect({ source: idA, target: idB });
      mockedCreateObjectiveEdge.mockResolvedValueOnce({
        id: 202,
        parentId: 3,
        childId: 2,
      });
      await invokeOnConnect({ source: idB, target: idC });
      await waitFor(() => expect(getRfProps().edges).toHaveLength(2));

      // Dragging FROM C TO A proposes childId=C, parentId=A — i.e. "C leads
      // to A", which would close the loop A -> B -> C -> A. Walking forward
      // from the proposed parent (A) reaches B, then C — the proposed
      // child — so this must be rejected as a cycle before any API call.
      await invokeOnConnect({ source: idC, target: idA });

      expect(mockedCreateObjectiveEdge).toHaveBeenCalledTimes(2);
      expect(getRfProps().edges).toHaveLength(2);
      expect(await screen.findByText(/cycle/i)).toBeInTheDocument();
    });
  });

  // --- disabling connections while a sidebar is open ---
  // Drawing an edge while the create/edit sidebar is open would let a user
  // connect to a not-yet-saved placeholder node (or otherwise fight with the
  // sidebar's own form state), so React Flow's built-in `nodesConnectable`
  // prop is toggled off for the whole canvas whenever either sidebar is open,
  // rather than special-casing it inside handleConnect.

  describe("disabling connections while a sidebar is open", () => {
    it("keeps nodes connectable when neither sidebar is open", async () => {
      render(<Map />);
      await waitForHydrated();

      expect(getRfProps().nodesConnectable).toBe(true);
    });

    it("disables node connections while the create sidebar is open", async () => {
      const { container } = render(<Map />);
      await waitForHydrated();

      clickPane(container);

      expect(getRfProps().nodesConnectable).toBe(false);
    });

    it("re-enables node connections once the create sidebar is cancelled", async () => {
      const user = userEvent.setup();
      const { container } = render(<Map />);
      await waitForHydrated();

      clickPane(container);
      expect(getRfProps().nodesConnectable).toBe(false);

      await user.click(screen.getByText("Cancel"));

      expect(getRfProps().nodesConnectable).toBe(true);
    });

    it("disables node connections while the edit sidebar is open", async () => {
      const user = userEvent.setup();
      const { container } = render(<Map />);

      await createSavedNode(user, container, {
        id: 42,
        description: "Get stronger",
      });
      const [nodeEl] = getNodeElements(container);
      fireEvent.click(nodeEl);

      expect(getRfProps().nodesConnectable).toBe(false);
    });
  });

  // --- connecting objectives: server error handling ---

  describe("connecting objectives — API error handling", () => {
    it("surfaces the exact thrown Error message and does not add an edge when createObjectiveEdge rejects", async () => {
      const user = userEvent.setup();
      const { container } = render(<Map />);

      await createSavedNode(user, container, { id: 42, description: "A" });
      await createSavedNode(user, container, { id: 43, description: "B" });
      const [sourceId, targetId] = getLocalNodeIds(container);

      mockedCreateObjectiveEdge.mockRejectedValueOnce(
        new Error("Objective 43 does not exist on this map"),
      );

      await invokeOnConnect({ source: sourceId, target: targetId });

      expect(
        await screen.findByText("Objective 43 does not exist on this map"),
      ).toBeInTheDocument();
      expect(getRfProps().edges).toHaveLength(0);
    });

    it("shows a fallback error message when createObjectiveEdge rejects with a non-Error value", async () => {
      const user = userEvent.setup();
      const { container } = render(<Map />);

      await createSavedNode(user, container, { id: 42, description: "A" });
      await createSavedNode(user, container, { id: 43, description: "B" });
      const [sourceId, targetId] = getLocalNodeIds(container);

      mockedCreateObjectiveEdge.mockRejectedValueOnce("boom");

      await invokeOnConnect({ source: sourceId, target: targetId });

      // The plan doesn't pin down exact fallback wording, so this only
      // asserts *some* non-empty error text is shown (rather than a guessed
      // exact string) — a choice consistent with this file's existing
      // fallback strings ("Failed to save goal node" / "Failed to update
      // objective") would be something like "Failed to create connection".
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toBeTruthy();
      expect(getRfProps().edges).toHaveLength(0);
    });
  });

  // --- deleting objectives (onEdgesChange) ---

  describe("deleting a connection", () => {
    async function connectTwoSavedNodes(
      user: ReturnType<typeof userEvent.setup>,
      container: HTMLElement,
      edgeDbId: number,
    ) {
      await createSavedNode(user, container, { id: 42, description: "A" });
      await createSavedNode(user, container, { id: 43, description: "B" });
      const [sourceId, targetId] = getLocalNodeIds(container);

      mockedCreateObjectiveEdge.mockResolvedValueOnce({
        id: edgeDbId,
        parentId: 43,
        childId: 42,
      });
      await invokeOnConnect({ source: sourceId, target: targetId });
      await waitFor(() => expect(getRfProps().edges).toHaveLength(1));

      return getRfProps().edges[0].id;
    }

    it("calls deleteObjectiveEdge with the edge's database id (not its React Flow local id) and removes it on success", async () => {
      const user = userEvent.setup();
      const { container } = render(<Map />);

      const rfEdgeId = await connectTwoSavedNodes(user, container, 300);

      mockedDeleteObjectiveEdge.mockResolvedValueOnce({
        id: 300,
        parentId: 43,
        childId: 42,
      });

      await invokeOnEdgesChange(rfEdgeId);

      // 300 is the id createObjectiveEdge's mock resolved with (data.dbId),
      // deliberately distinct from React Flow's own local edge id.
      await waitFor(() =>
        expect(mockedDeleteObjectiveEdge).toHaveBeenCalledWith(300),
      );
      await waitFor(() => expect(getRfProps().edges).toHaveLength(0));
    });

    it("leaves the edge in place and shows an error when deleteObjectiveEdge rejects", async () => {
      const user = userEvent.setup();
      const { container } = render(<Map />);

      const rfEdgeId = await connectTwoSavedNodes(user, container, 300);

      mockedDeleteObjectiveEdge.mockRejectedValueOnce(
        new Error("Objective edge not found"),
      );

      await invokeOnEdgesChange(rfEdgeId);

      expect(
        await screen.findByText("Objective edge not found"),
      ).toBeInTheDocument();
      expect(getRfProps().edges).toHaveLength(1);
    });
  });

  // --- Exit button (CanvasExitButton) ---
  // Real CanvasExitButton, not mocked — it's already built/tested standalone
  // (see CanvasExitButton.test.tsx). window.confirm is spied per-case since
  // Map.tsx is expected to guard a destructive-feeling exit while a sidebar
  // (with in-progress, unsaved form state) is open.

  describe("Exit button", () => {
    afterEach(() => {
      // Restores the window.confirm spy (and any other spies) created in the
      // sub-cases below; the outer beforeEach re-establishes the API mocks'
      // defaults for the next test regardless.
      vi.restoreAllMocks();
    });

    it("navigates to '/' when Exit is clicked and neither sidebar is open", async () => {
      const user = userEvent.setup();
      render(<Map />);
      await waitForHydrated();

      await user.click(screen.getByRole("button", { name: "Exit" }));

      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    describe("while the create sidebar is open", () => {
      it("confirms via window.confirm and navigates when the user confirms", async () => {
        const user = userEvent.setup();
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
        const { container } = render(<Map />);
        await waitForHydrated();
        clickPane(container);

        await user.click(screen.getByRole("button", { name: "Exit" }));

        expect(confirmSpy).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith("/");
      });

      it("does not navigate and leaves the sidebar open when the user declines the confirm", async () => {
        const user = userEvent.setup();
        vi.spyOn(window, "confirm").mockReturnValue(false);
        const { container } = render(<Map />);
        await waitForHydrated();
        clickPane(container);

        await user.click(screen.getByRole("button", { name: "Exit" }));

        expect(mockNavigate).not.toHaveBeenCalled();
        expect(screen.getByText("New node")).toBeInTheDocument();
      });
    });

    describe("while the edit sidebar is open", () => {
      it("confirms via window.confirm and navigates when the user confirms", async () => {
        const user = userEvent.setup();
        const { container } = render(<Map />);
        await createSavedNode(user, container, {
          id: 42,
          description: "Get stronger",
        });
        fireEvent.click(getNodeElements(container)[0]);
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

        await user.click(screen.getByRole("button", { name: "Exit" }));

        expect(confirmSpy).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith("/");
      });

      it("does not navigate and leaves the sidebar open when the user declines the confirm", async () => {
        const user = userEvent.setup();
        const { container } = render(<Map />);
        await createSavedNode(user, container, {
          id: 42,
          description: "Get stronger",
        });
        fireEvent.click(getNodeElements(container)[0]);
        vi.spyOn(window, "confirm").mockReturnValue(false);

        await user.click(screen.getByRole("button", { name: "Exit" }));

        expect(mockNavigate).not.toHaveBeenCalled();
        expect(screen.getByText("Edit objective")).toBeInTheDocument();
      });
    });
  });
});
