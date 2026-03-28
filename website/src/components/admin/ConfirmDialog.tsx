"use client";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white border border-border-subtle shadow-deep w-full max-w-sm mx-4 p-6">
        <h3 className="text-sm font-medium text-text">{title}</h3>
        <p className="mt-2 text-sm text-text/50">{message}</p>
        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs uppercase tracking-widest text-text/50 hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-xs uppercase tracking-widest bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
