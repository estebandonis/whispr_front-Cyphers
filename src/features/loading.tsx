import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex items-center justify-center flex-1 h-full">
      <Loader2 className="size-8 animate-spin text-white" />
    </div>
  );
}
