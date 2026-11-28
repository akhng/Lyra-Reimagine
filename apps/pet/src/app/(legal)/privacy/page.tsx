import type { Metadata } from "next";
import { A, Contact, LegalDoc, List, P, Section } from "@/components/legal/Legal";
import { LEGAL_UPDATED, legalDetails } from "@/features/legal/details";

export const metadata: Metadata = { title: "Privacy Policy" };

/**
 * How Lyra Pet handles personal information, following the Australian Privacy
 * Principles. Keep in step with what the app actually collects and the service
 * providers it uses (Supabase, Vercel, Stripe, Resend).
 */
export default function PrivacyPolicy() {
  const d = legalDetails();
  return (
    <LegalDoc
      title="Privacy Policy"
      updated={LEGAL_UPDATED}
      intro={
        <P>
          This policy explains how {d.operator} (&ldquo;Lyra Pet&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, shares and protects personal information when you use Lyra Pet, whether you&apos;re a pet owner or work at a salon. We handle personal information in line with the Australian Privacy Principles in the Privacy Act 1988 (Cth).
        </P>
      }
    >
      <Section id="collect" title="1. What we collect">
        <P>
          <strong>Your account:</strong> your name, email address and password. Passwords are stored only in protected (hashed) form by our sign-in provider; we can&apos;t see them.
        </P>
        <P>
          <strong>If you&apos;re a pet owner:</strong>
        </P>
        <List
          items={[
            "your pets' details: name, species, breed, size, photos, and the care, health and behaviour notes you choose to add;",
            "your booking requests and appointments, including the services, times, notes and the salon's decisions;",
            "messages you exchange with salons, reviews you write, and loyalty points you earn;",
            "payment records: amounts, refunds and status. Your card details are collected and held by Stripe, never by us.",
          ]}
        />
        <P>
          <strong>If you work at a salon:</strong> the business&apos;s details (name, ABN, GST status, contact details, locations, hours, services and prices), your name and role, and the customer, pet, appointment and grooming records the salon keeps in Lyra Pet. We hold those records on the salon&apos;s behalf.
        </P>
        <P>
          <strong>Technical information:</strong> our hosting providers record technical details such as IP addresses, browser type and the time of requests, to run the service securely. We use cookies only to keep you signed in. We don&apos;t use advertising or analytics cookies, and we don&apos;t track you across other websites.
        </P>
      </Section>

      <Section id="use" title="2. How we use it">
        <List
          items={[
            "to provide Lyra Pet: your account, bookings, payments, refunds, messages, reviews and loyalty points;",
            "to send you emails and app notifications about your bookings and account (for example, when a salon confirms or declines your request);",
            "to keep Lyra Pet safe: preventing fraud and misuse, and looking into reported messages or reviews;",
            "to answer your questions and fix problems;",
            "to meet our legal obligations, such as keeping payment and tax records.",
          ]}
        />
        <P>We don&apos;t sell your personal information. We don&apos;t send you marketing emails unless you&apos;ve agreed to receive them, and every marketing email will let you unsubscribe.</P>
      </Section>

      <Section id="share" title="3. Who we share it with">
        <List
          items={[
            "Salons you book with or message see the details they need: your name and contact details, your pet's details and notes, your booking and your messages. Groomers see your pet's care information but not your contact details. Contact details in messages stay hidden until you've paid for a booking through Lyra Pet.",
            "At a salon, what each person sees depends on their role, set by the salon.",
            "Our service providers, who process information for us under contract:",
          ]}
        />
        <div className="pl-6">
          <List
            items={[
              <><strong>Supabase</strong>: database, sign-in and file storage (including pet photos);</>,
              <><strong>Vercel</strong>: hosting the Lyra Pet website and app;</>,
              <><strong>Stripe</strong>: processing payments and refunds (<A href="https://stripe.com/au/privacy">Stripe&apos;s privacy policy</A>);</>,
              <><strong>Resend</strong>: sending our emails.</>,
            ]}
          />
        </div>
        <P>We may also disclose information if the law requires it, for example to a court or regulator, or to protect someone&apos;s safety.</P>
      </Section>

      <Section id="overseas" title="4. Information stored overseas">
        <P>Some of our service providers store or process information outside Australia, including in the United States. Where that happens, we take reasonable steps to make sure they protect it in a way consistent with the Australian Privacy Principles.</P>
      </Section>

      <Section id="security" title="5. Keeping it secure">
        <P>Information is encrypted in transit. Access is limited by role, and the database enforces that each salon can see only its own records. We log what&apos;s needed to run the service (such as record numbers and timings), not customers&apos; names, contact details, pet notes or payment details. If a data breach is likely to cause you serious harm, we&apos;ll notify you and the Office of the Australian Information Commissioner, as the law requires.</P>
      </Section>

      <Section id="keep" title="6. How long we keep it">
        <P>We keep your information while your account is open. When you close it, we delete or de-identify your personal information within a reasonable time, except records we must keep by law, such as payment and tax records (generally kept for five years). Salons keep the records of appointments at their salon in line with their own obligations.</P>
      </Section>

      <Section id="rights" title="7. Seeing and correcting your information">
        <P>
          You can see and update most of your information in the app. To ask for a copy of what we hold about you, to correct something, or to close your account, contact <Contact email={d.email} />. We&apos;ll respond within 30 days. For records a salon keeps about you, you can also ask the salon.
        </P>
      </Section>

      <Section id="children" title="8. Children">
        <P>Lyra Pet is for adults. Children under 18 shouldn&apos;t create an account without a parent or guardian&apos;s permission.</P>
      </Section>

      <Section id="complaints" title="9. Questions and complaints">
        <P>
          If you have a question or a complaint about how we handle your personal information, contact <Contact email={d.email} />. We&apos;ll respond within 30 days. If you&apos;re not satisfied with our response, you can complain to the Office of the Australian Information Commissioner at <A href="https://www.oaic.gov.au">oaic.gov.au</A> or on 1300 363 992.
        </P>
      </Section>

      <Section id="changes" title="10. Changes to this policy">
        <P>We may update this policy as Lyra Pet changes. The date at the top shows when it last changed. If a change is significant, we&apos;ll tell you in the app or by email.</P>
      </Section>
    </LegalDoc>
  );
}
