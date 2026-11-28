import type { ReactNode } from "react";

/** Building blocks for the terms and privacy pages: readable, plain-English documents. */
export function LegalDoc({ title, updated, intro, children }: { title: string; updated: string; intro: ReactNode; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
        <p className="text-sm text-muted">Last updated {updated}</p>
        <div className="text-lg text-ink/80">{intro}</div>
      </header>
      {children}
    </article>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-display text-xl font-semibold text-ink sm:text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed text-ink">{children}</p>;
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-6 leading-relaxed text-ink">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith("http");
  return (
    <a href={href} className="font-semibold text-primary-text underline underline-offset-2" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

/** How to reach us. PLATFORM_CONTACT_EMAIL must be set before launch (privacy requests and complaints need a route). */
export function Contact({ email }: { email: string | null }) {
  return email ? <A href={`mailto:${email}`}>{email}</A> : <>us</>;
}
