"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { X, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  /** Auto-dismiss delay in ms. 0 = manual dismiss only. Default: 5000. */
  duration?: number;
}

type AddToast = (
  variant: ToastVariant,
  message: string,
  duration?: number,
) => void;

// ─── Context ──────────────────────────────────────────────────────

const ToastContext = createContext<AddToast | null>(null);

/**
 * useToast — access the `toast` function from any client component.
 *
 * Usage:
 * ```ts
 * const toast = useToast();
 * toast("success", "Profile saved!");
 * toast("error", "Something went wrong.", 8000);
 * ```
 */
function useToast(): AddToast {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast: AddToast = useCallback(
    (variant, message, duration = 5000) => {
      const id = `toast-${++counterRef.current}`;
      setToasts((prev) => [...prev, { id, variant, message, duration }]);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}

      {/* Toast viewport — fixed bottom-right, stacked */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Individual toast ─────────────────────────────────────────────

const variantStyles = {
  success: "border-success-500/30 bg-success-50 text-success-800",
  error: "border-error-500/30 bg-error-50 text-error-800",
  warning: "border-warning-500/30 bg-warning-50 text-warning-800",
  info: "border-brand-500/30 bg-brand-50 text-brand-800",
} as const;

const variantIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const Icon = variantIcons[toast.variant];

  // Auto-dismiss timer
  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;

    const timer = setTimeout(onDismiss, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration, onDismiss]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md",
        "min-w-[280px] max-w-[420px]",
        "animate-in slide-in-from-right-full fade-in-0",
        variantStyles[toast.variant],
      )}
      role="status"
    >
      <Icon className="mt-0.5 shrink-0" size={18} aria-hidden="true" />

      <p className="flex-1 text-sm font-medium">{toast.message}</p>

      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        aria-label="Dismiss notification"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export { ToastProvider, useToast };
export type { ToastVariant, Toast };
