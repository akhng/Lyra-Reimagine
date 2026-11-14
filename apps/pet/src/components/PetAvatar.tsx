import { Cat, Dog, PawPrint } from "lucide-react";
import Image from "next/image";
import { cn } from "@lyra/ui";

/** Pet photo (signed URL) or a species icon. Decorative unless `alt` is given. */
export function PetAvatar({ url, species, alt = "", size = "md" }: { url: string | null; species: string; alt?: string; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "size-24" : size === "sm" ? "size-10" : "size-14";
  if (url) return <Image src={url} alt={alt} width={96} height={96} unoptimized className={cn(box, "shrink-0 rounded-full object-cover")} />;
  const Icon = species === "cat" ? Cat : species === "dog" ? Dog : PawPrint;
  return (
    <span className={cn(box, "grid shrink-0 place-items-center rounded-full bg-primary-tint text-primary-text")} aria-hidden={alt ? undefined : true} role={alt ? "img" : undefined} aria-label={alt || undefined}>
      <Icon className={size === "lg" ? "size-10" : "size-5"} />
    </span>
  );
}
