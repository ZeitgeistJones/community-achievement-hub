"use client";

import type { ReactNode } from "react";

export function PermanentWarningModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Yes, proceed",
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  children?: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border-2 border-red-500 bg-surface p-6 shadow-xl">
        <h3 className="text-xl font-bold text-red-400">{title}</h3>
        <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-red-300">
          THIS IS PERMANENT
        </p>
        <p className="mt-2 text-sm text-text/80">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
