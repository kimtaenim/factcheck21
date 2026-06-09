import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
}

export function Card({ className, padding = "md", ...rest }: CardProps) {
  const pad =
    padding === "sm" ? "p-4" : padding === "lg" ? "p-6 sm:p-8" : "p-5 sm:p-6";
  return (
    <div
      className={cn(
        "rounded-3xl bg-white ring-1 ring-zinc-200/70 shadow-soft",
        pad,
        className,
      )}
      {...rest}
    />
  );
}
