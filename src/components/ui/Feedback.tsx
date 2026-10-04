"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

/* ---------- Confirmation (remplace window.confirm) ---------- */

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

/* ---------- Notifications éphémères ---------- */

type ToastTone = "info" | "error";
type ToastFn = (message: string, tone?: ToastTone) => void;

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ConfirmContext = createContext<ConfirmFn | null>(null);
const ToastContext = createContext<ToastFn | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const confirm = useCallback<ConfirmFn>((options) => {
    resolver.current?.(false);
    setPending(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function settle(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = null;
    setPending(null);
  }

  const toast = useCallback<ToastFn>((message, tone = "info") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    // Les erreurs restent un peu plus longtemps : il faut le temps de les lire.
    window.setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      tone === "error" ? 6000 : 3500
    );
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      <ToastContext.Provider value={toast}>
        {children}

        {pending ? (
          <Modal title={pending.title} onClose={() => settle(false)} size="sm">
            {pending.message ? <div className="confirm-message">{pending.message}</div> : null}
            <div className="modal-actions">
              <Button variant="ghost" onClick={() => settle(false)}>
                {pending.cancelLabel ?? "Annuler"}
              </Button>
              <Button
                variant={pending.danger ? "danger" : "primary"}
                onClick={() => settle(true)}
                autoFocus
              >
                {pending.confirmLabel}
              </Button>
            </div>
          </Modal>
        ) : null}

        <div className="toast-region" aria-live="polite" aria-atomic="false">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`toast ${t.tone === "error" ? "toast-error" : ""}`}
              role={t.tone === "error" ? "alert" : "status"}
            >
              {t.message}
            </div>
          ))}
        </div>
      </ToastContext.Provider>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm doit être utilisé dans <FeedbackProvider>");
  return ctx;
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans <FeedbackProvider>");
  return ctx;
}
