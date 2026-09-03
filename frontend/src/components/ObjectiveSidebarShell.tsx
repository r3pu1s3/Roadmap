import type { ReactNode } from 'react';
import './ObjectiveSidebar.css';

interface ObjectiveSidebarShellProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;

  onClose: () => void;

  primaryLabel: string;
  onPrimaryClick: () => void;
  primaryDisabled?: boolean;
  showPrimary?: boolean;

  secondaryLabel?: string;
  onSecondaryClick?: () => void;

  isSaving?: boolean;
  errorMessage?: string | null;
}

export default function ObjectiveSidebarShell({
  isOpen,
  title,
  children,
  onClose,
  primaryLabel,
  onPrimaryClick,
  primaryDisabled = false,
  showPrimary = true,
  secondaryLabel = 'Cancel',
  onSecondaryClick,
  isSaving = false,
  errorMessage = null,
}: ObjectiveSidebarShellProps) {
  if (!isOpen) return null;

  return (
    <div className="obj-form-sidebar">
      <div className="obj-form-header">
        <span className="obj-form-title">{title}</span>
        <button className="obj-form-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="obj-form-body">{children}</div>

      <div className="obj-form-footer">
        {errorMessage && <div className="obj-form-error">{errorMessage}</div>}
        <div className="obj-form-footer-buttons">
          <button
            className="obj-form-btn obj-form-btn-secondary"
            onClick={onSecondaryClick ?? onClose}
            disabled={isSaving}
          >
            {secondaryLabel}
          </button>
          <button
            className="obj-form-btn obj-form-btn-primary"
            onClick={onPrimaryClick}
            disabled={isSaving || primaryDisabled}
            style={{ visibility: showPrimary ? 'visible' : 'hidden' }}
          >
            {isSaving ? 'Saving…' : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}