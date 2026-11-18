import { useCallback, useEffect, useRef, useState } from "react";

export function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} />;
}

export interface ToastState {
  id: number;
  text: string;
  undo?: () => void;
}

/** One quiet message at a time, with an optional Undo. */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number>();
  const show = useCallback((text: string, undo?: () => void) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, undo });
    timer.current = window.setTimeout(() => setToast(null), undo ? 6000 : 3500);
  }, []);
  const hide = useCallback(() => setToast(null), []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { toast, show, hide };
}

export function Toast({ toast, onHide }: { toast: ToastState | null; onHide: () => void }) {
  return (
    <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">
      {toast && (
        <>
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              onClick={() => {
                toast.undo?.();
                onHide();
              }}
            >
              Undo
            </button>
          )}
        </>
      )}
    </div>
  );
}

export const errorText = (e: unknown) =>
  e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Something went wrong";
