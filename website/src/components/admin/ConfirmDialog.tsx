"use client";

import { Sheet } from "./ui";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// DLS destructive confirm: centred title, neutral (ink) primary, an outlined way back. Never a red fill.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Sheet open={open} onClose={onCancel} labelledBy="confirm-title">
      <div className="pt-6 text-center">
        <h2 id="confirm-title" className="t-h3">{title}</h2>
        <p className="t-sub mx-auto mt-2 max-w-[36ch]">{message}</p>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3">
        <button type="button" onClick={onCancel} className="btn btn-secondary">Go back</button>
        <button type="button" onClick={onConfirm} className="btn btn-ink">{confirmLabel}</button>
      </div>
    </Sheet>
  );
}
