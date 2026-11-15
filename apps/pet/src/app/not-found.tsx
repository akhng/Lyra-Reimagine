import Link from "next/link";
import { buttonVariants } from "@lyra/ui";

/** Also shown for another business's pages: a missing page and one you can't access look the same. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-3xl font-bold text-ink">Page not found</h1>
      <p className="text-muted">This page doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/home" className={buttonVariants()}>
        Go to your businesses
      </Link>
    </main>
  );
}
