import { cn } from "@/lib/utils";

export default function CornerAccents({
  className,
}: Readonly<{ className?: string }>) {
  return (
    <>
      <div
        className={cn(
          "absolute -top-2 -left-1 text-neutral-400/50 text-xs",
          className
        )}
      >
        +
      </div>
      <div
        className={cn(
          "absolute -top-2 -right-1 text-neutral-400/50 text-xs",
          className
        )}
      >
        +
      </div>
      <div
        className={cn(
          "absolute -bottom-2 -left-1 text-neutral-400/50 text-xs",
          className
        )}
      >
        +
      </div>
      <div
        className={cn(
          "absolute -bottom-2 -right-1 text-neutral-400/50 text-xs",
          className
        )}
      >
        +
      </div>
    </>
  );
}
