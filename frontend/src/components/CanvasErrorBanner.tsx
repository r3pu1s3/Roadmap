import "./CanvasErrorBanner.css";

interface CanvasErrorBannerProps {
  message: string | null;
}

// Small overlay toast shown above the React Flow canvas (see Map.tsx) to
// surface transient errors (e.g. failed save/load of an objective) without
// interrupting the canvas itself. Renders nothing when there's no message so
// the Map page can simply pass its error state through unconditionally.
export default function CanvasErrorBanner({ message }: CanvasErrorBannerProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="canvas-error-banner" role="alert">
      {message}
    </div>
  );
}
