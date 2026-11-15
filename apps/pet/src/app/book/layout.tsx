import type { ReactNode } from "react";
import { Brand } from "@/components/Brand";

/** Public booking pages: no app chrome, the salon's name leads; a quiet "powered by" footer. */
export default function BookLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">{children}</main>
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 text-xs text-muted">
          <span>Bookings powered by</span>
          <Brand href="/" />
        </div>
      </footer>
    </div>
  );
}
