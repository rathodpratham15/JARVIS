import type { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function IconTip({ label, side = "right", children, enabled = true }: {
  label: string;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
  enabled?: boolean;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

export function Avatar({ name, src, size = 32, className = "" }: {
  name?: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  const letters = (name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  if (src) {
    return <img src={src} alt={name} referrerPolicy="no-referrer" className={`rounded-full object-cover shrink-0 ${className}`} style={{ width: size, height: size }} />;
  }
  return (
    <div
      className={`rounded-full shrink-0 grid place-items-center bg-j-accent/15 text-j-accent font-medium ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {letters || "?"}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action, testId }: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="flex flex-col items-center text-center py-20 px-6">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-j-accent/20 blur-2xl" />
        <div className="relative h-20 w-20 rounded-3xl bg-j-surface border border-j-border grid place-items-center">
          <Icon className="h-9 w-9 text-j-muted" strokeWidth={1.5} />
        </div>
      </div>
      <p className="font-medium">{title}</p>
      {text && <p className="text-sm text-j-muted mt-1.5 max-w-xs">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ text = "Something went wrong.", onRetry, testId }: {
  text?: string;
  onRetry?: () => void;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="flex flex-col items-center text-center py-16 px-6">
      <p className="text-sm text-j-muted">{text}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 h-9 px-4 rounded-full border border-j-border hover:bg-j-hover text-sm" data-testid={`${testId}-retry`}>
          Try again
        </button>
      )}
    </div>
  );
}

export function PillButton({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "accent" | "ghost" | "danger" }) {
  const styles: Record<string, string> = {
    primary: "bg-j-text text-j-main hover:opacity-90",
    accent: "bg-j-accent text-black hover:opacity-90",
    ghost: "border border-j-border hover:bg-j-hover",
    danger: "bg-red-600 text-white hover:bg-red-500",
  };
  return (
    <button
      className={`h-9 px-4 rounded-full text-sm font-medium inline-flex items-center justify-center gap-2 transition-[background-color,opacity] disabled:opacity-40 disabled:pointer-events-none ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
