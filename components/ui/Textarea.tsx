import { cn } from "@/lib/utils";

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[15px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20",
        className,
      )}
      {...rest}
    />
  );
}
