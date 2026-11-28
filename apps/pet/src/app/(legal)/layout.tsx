import type { ReactNode } from "react";
import { Brand } from "@/components/Brand";
import { LegalLinks } from "@/components/legal/LegalLinks";

/** Public terms and privacy pages: no sign-in needed, no app chrome. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-3xl px-4 py-5">
        <Brand href="/" />
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
        {children}
      </main>
      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-3xl px-4">
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}
