import { Brand } from "@/components/Brand";
import { Mascot } from "@/components/mascots/Mascot";

/** Sign-in and sign-up: a welcoming illustrated panel with Coco waving hello (ADR 0003). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-glow lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Brand />
        <div className="relative mx-auto flex items-end gap-2">
          <Mascot name="mochi" mood="curious" className="w-40" />
          <Mascot name="coco" mood="excited" pose="wave" className="w-60" />
          <Mascot name="luna" mood="happy" className="w-36" />
        </div>
        <p className="max-w-md font-display text-3xl leading-tight font-semibold text-ink">Happy pets, happy groomers. Every booking, profile and paw-print in one place.</p>
      </aside>
      <div className="flex flex-col">
        <header className="px-6 py-5 lg:hidden">
          <Brand />
        </header>
        <main id="main" className="flex flex-1 flex-col items-center justify-start px-4 pb-16 sm:justify-center">
          <Mascot name="coco" mood="excited" pose="wave" className="mb-2 w-28 lg:hidden" />
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
