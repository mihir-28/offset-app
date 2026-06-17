import Image from "next/image";
import { cn } from "../lib/utils";

type BrandMarkProps = {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

export function BrandMark({
  className,
  imageClassName,
  priority = false,
}: BrandMarkProps) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-950 shadow-lg",
        className
      )}
    >
      <Image
        src="/icon.png"
        alt="Offset"
        width={96}
        height={96}
        priority={priority}
        className={cn("h-full w-full object-cover", imageClassName)}
      />
    </div>
  );
}
