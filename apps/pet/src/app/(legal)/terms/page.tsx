import type { Metadata } from "next";
import Link from "next/link";
import { A, Contact, LegalDoc, List, P, Section } from "@/components/legal/Legal";
import { LEGAL_UPDATED, legalDetails } from "@/features/legal/details";

export const metadata: Metadata = { title: "Customer Terms" };

/** Terms for pet owners: finding salons, requesting and paying for grooms, refunds, messages and reviews. */
export default function CustomerTerms() {
  const d = legalDetails();
  return (
    <LegalDoc
      title="Customer Terms"
      updated={LEGAL_UPDATED}
      intro={
        <P>
          These terms apply when you use Lyra Pet to find a grooming salon, book a groom for your pet, or message a salon. Lyra Pet is operated by {d.operator} (&ldquo;Lyra Pet&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or sending a booking request, you agree to these terms. If you run a salon, the <Link href="/terms/business" className="font-semibold text-primary-text underline underline-offset-2">Business Terms</Link> also apply to you.
        </P>
      }
    >
      <Section id="what" title="1. What Lyra Pet does">
        <P>Lyra Pet helps you find salons, send them booking requests, pay for bookings where the salon takes online payment, and keep your pets&apos; details in one place.</P>
        <P>The salon provides the grooming. Your contract for the grooming is with the salon, not with us. We are not the groomer and we don&apos;t supervise the salon&apos;s work.</P>
      </Section>

      <Section id="account" title="2. Your account">
        <List
          items={[
            "You need to be 18 or over to create an account, or have a parent or guardian's permission.",
            "Keep your sign-in details private. You're responsible for what happens in your account.",
            "Give accurate details and keep them up to date.",
          ]}
        />
      </Section>

      <Section id="requests" title="3. Booking requests">
        <List
          items={[
            "A request is not a booking until the salon confirms a groomer and a time. We'll tell you in the app and by email when it's confirmed or declined.",
            "The salon may decline a request. A request that isn't confirmed before the times you asked for have passed expires.",
            "The salon may confirm a different time or groomer from the one you asked for. If that doesn't suit you, you can cancel (see section 5).",
          ]}
        />
      </Section>

      <Section id="paying" title="4. Prices and paying">
        <List
          items={[
            "Some salons ask you to pay in full when you send a request. The amount shown before you pay is the salon's estimate for the services you chose. Other salons take payment at the appointment.",
            "When you pay through Lyra Pet, you pay the salon. Payments are processed by Stripe. We never see or store your card details.",
            "We don't charge you a booking fee. The salon pays us a service fee out of what you pay.",
            "If the final price at the appointment differs from the estimate (for example, extra time for a matted coat), the salon should explain why. Any difference is settled with the salon directly.",
          ]}
        />
      </Section>

      <Section id="refunds" title="5. Cancellations and refunds">
        <P>If you paid through Lyra Pet, you&apos;re refunded in full, automatically, if:</P>
        <List
          items={[
            "the salon declines your request;",
            "your request expires before it's confirmed;",
            "the salon cancels your appointment; or",
            "you cancel before the salon confirms, or after it confirms but before the salon's cancellation window starts. The window is shown with your booking (for example, 24 hours before the appointment).",
          ]}
        />
        <P>Refunds go back to the card you paid with and usually reach you within 5 to 10 business days, depending on your bank.</P>
        <P>Inside the cancellation window, or for any problem with the grooming itself, contact the salon. You also have rights under the Australian Consumer Law, including guarantees that services are provided with due care and skill. Nothing in these terms limits those rights.</P>
      </Section>

      <Section id="pets" title="6. Your pet's information and welfare">
        <List
          items={[
            "Give accurate information about your pet's health, behaviour, vaccinations and needs, so the groomer can care for them safely. Tell the salon about anything new before the appointment.",
            "The salon sees what it needs for your booking. Groomers see your pet's care information, but not your contact details.",
            "A salon may refuse or stop a groom if it's concerned for your pet's or its staff's welfare.",
            "Lyra Pet doesn't give veterinary advice. If you're worried about your pet's health, see a vet.",
          ]}
        />
      </Section>

      <Section id="messages" title="7. Messages">
        <P>You can message salons through Lyra Pet, with or without a booking. The salon&apos;s owner, managers and front desk can read your conversation, and so can your groomer while they have a booking with you. Until you&apos;ve paid for a booking through Lyra Pet, phone numbers, email addresses and links in messages are hidden. Be respectful: either side can block or report a conversation, and we may review reported conversations.</P>
      </Section>

      <Section id="reviews" title="8. Reviews and loyalty points">
        <List
          items={[
            "After a groom, you can review the salon. Reviews must be honest and about your own experience, with no abuse, personal information or content you don't have the right to share. The salon can reply. We may remove reviews that break these rules.",
            "Salons can run loyalty programs through Lyra Pet. Each salon sets its own rules for earning and redeeming points. Points have no cash value, can't be transferred, and are used only at the salon that gave them.",
          ]}
        />
      </Section>

      <Section id="use" title="9. Using Lyra Pet fairly">
        <P>Don&apos;t misuse Lyra Pet. For example, don&apos;t send fake requests, harass anyone, try to access other people&apos;s information, interfere with the service, or use it for anything unlawful. We may suspend or close an account that does.</P>
      </Section>

      <Section id="liability" title="10. Our responsibility">
        <P>We work to keep Lyra Pet available and accurate, but we can&apos;t promise it will always be uninterrupted or error-free. The salon is responsible for the grooming and for its listing, prices and policies.</P>
        <P>Nothing in these terms excludes, restricts or modifies any right or remedy you have under the Australian Consumer Law that can&apos;t be excluded. Subject to that, we&apos;re not liable for indirect or consequential loss, and we&apos;re not responsible for the salon&apos;s services.</P>
      </Section>

      <Section id="privacy" title="11. Privacy">
        <P>
          We handle your personal information as set out in our <Link href="/privacy" className="font-semibold text-primary-text underline underline-offset-2">Privacy Policy</Link>. We share your details only with salons you book with or message, and with the service providers listed there.
        </P>
      </Section>

      <Section id="changes" title="12. Changes and ending">
        <List
          items={[
            "We may update these terms. If a change is significant, we'll tell you in the app or by email before it takes effect. The date at the top shows when they last changed.",
            <>You can stop using Lyra Pet at any time. To close your account, contact <Contact email={d.email} />. Paid bookings that are still open will be completed or refunded as described above.</>,
          ]}
        />
      </Section>

      <Section id="general" title="13. General">
        <P>
          These terms are governed by the laws of {d.state}, Australia. Questions? Contact <Contact email={d.email} />. Payments are also subject to <A href="https://stripe.com/legal/consumer">Stripe&apos;s terms</A>.
        </P>
      </Section>
    </LegalDoc>
  );
}
