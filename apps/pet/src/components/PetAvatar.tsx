import Image from "next/image";
import { cn } from "@lyra/ui";
import { Mascot, type MascotName } from "./mascots/Mascot";

/** A friendly stand-in for a pet without a photo: a cat or dog mascot, picked steadily from the name. */
export function mascotFor(species: string, name = ""): MascotName {
  const n = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  if (species === "cat") return n % 2 ? "luna" : "mochi";
  return n % 2 ? "biscuit" : "coco";
}

/** Pet photo (signed URL) or an illustrated stand-in. Decorative unless `alt` is given. */
export function PetAvatar({ url, species, name = "", alt = "", size = "md" }: { url: string | null; species: string; name?: string; alt?: string; size?: "sm" | "md" | "lg" }) {
  const box = size === "lg" ? "size-24" : size === "sm" ? "size-10" : "size-14";
  if (url) return <Image src={url} alt={alt} width={96} height={96} unoptimized className={cn(box, "shrink-0 rounded-full object-cover")} />;
  return (
    <span className={cn(box, "grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-tint")} aria-hidden={alt ? undefined : true} role={alt ? "img" : undefined} aria-label={alt || undefined}>
      <Mascot name={mascotFor(species, name || alt)} pose="peek" mood="happy" className="mt-[18%] w-[92%]" />
    </span>
  );
}
