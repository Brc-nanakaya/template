"use client";

/**
 * トースト通知ラッパー (T17)。
 * Sonner の `toast.custom` を使って `data-testid="toast-error"` /
 * `data-testid="toast-success"` を持つ DOM を描画する。E2E からは
 * testid で個別に捕捉できる。
 */

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface ToastBodyProps {
  variant: "error" | "success";
  title: string;
  message?: string;
}

function ToastBody({ variant, title, message }: ToastBodyProps) {
  const isError = variant === "error";
  const Icon = isError ? AlertTriangle : CheckCircle2;
  return (
    <div
      data-testid={isError ? "toast-error" : "toast-success"}
      role={isError ? "alert" : "status"}
      className={`flex min-w-[280px] items-start gap-2 rounded-md border-l-4 bg-white p-3 text-sm shadow-md ring-1 ${
        isError
          ? "border-red-600 text-red-900 ring-red-200"
          : "border-emerald-600 text-emerald-900 ring-emerald-200"
      }`}
    >
      <Icon
        aria-hidden
        className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
          isError ? "text-red-600" : "text-emerald-600"
        }`}
      />
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        {message && <p className="mt-0.5 text-xs opacity-90">{message}</p>}
      </div>
    </div>
  );
}

export function toastError(title: string, message?: string): void {
  toast.custom(() => <ToastBody variant="error" title={title} message={message} />, {
    duration: 5000,
  });
}

export function toastSuccess(title: string, message?: string): void {
  toast.custom(() => <ToastBody variant="success" title={title} message={message} />, {
    duration: 3000,
  });
}
