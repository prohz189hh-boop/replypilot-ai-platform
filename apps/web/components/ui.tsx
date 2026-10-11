"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, MessageCircle } from "lucide-react";
import Link from "next/link";
export function Logo() {
  return (
    <Link href="/" className="logo">
      <span className="logo-mark">
        <MessageCircle size={21} />
      </span>
      replypilot<span>·</span>
    </Link>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="row between">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="btn ghost" aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="muted small">
            {description ||
              "Enter the details below. Changes are validated before saving."}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <MessageCircle size={26} style={{ margin: "0 auto 12px" }} />
      {children}
    </div>
  );
}
export function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      {label}
      <input {...props} />
    </label>
  );
}
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
export const mutate = (action: string, data: unknown) =>
  api<{ result: unknown }>("/api/workspace", {
    method: "POST",
    body: JSON.stringify({ action, data }),
  });
