import "./CanvasExitButton.css";

interface CanvasExitButtonProps {
  onExit: () => void;
  disabled?: boolean;
}

// Small overlay button shown above the React Flow canvas (see Map.tsx) that
// lets the user leave the canvas back to the map menu/list. Exit-only by
// design (see feature plan 6.2) — no Save affordance here, saving happens
// implicitly via the sidebars. Always renders (unlike CanvasErrorBanner,
// which conditionally renders null) since there's always a way to exit.
export default function CanvasExitButton({
  onExit,
  disabled = false,
}: CanvasExitButtonProps) {
  return (
    <button
      type="button"
      className="canvas-exit-button"
      onClick={onExit}
      disabled={disabled}
    >
      Exit
    </button>
  );
}
