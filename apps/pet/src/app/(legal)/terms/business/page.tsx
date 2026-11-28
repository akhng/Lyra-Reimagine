import type { Metadata } from "next";
import Link from "next/link";
import { A, Contact, LegalDoc, List, P, Section } from "@/components/legal/Legal";
import { LEGAL_UPDATED, legalDetails } from "@/features/legal/details";

export const metadata: Metadata = { title: "Business Terms" };

/** Terms for salons: the free software, the marketplace, Stripe payments and the 5% service fee (ADR 0004). */
export default function BusinessTerms() {
  const d = legalDetails();
  return (
    <LegalDoc
      title="Business Terms"
      updated={LEGAL_UPDATED}
      intro={
        <P>
          These terms are between {d.operator} (&ldquo;Lyra Pet&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) and the business that creates a Lyra Pet business account (&ldquo;you&rdquo;, the &ldquo;Salon&rdquo;). By creating a business on Lyra Pet, you agree to them on behalf of that business, and you confirm you&apos;re authorised to.
        </P>
      }
    >
      <Section id="service" title="1. The service">
        <List
          items={[
            "Lyra Pet provides software for running a pet grooming business, and a marketplace where pet owners (\"Customers\") can find your salon, send booking requests and message you.",
            "Using Lyra Pet is free. There's no subscription or setup fee. We earn a service fee only on bookings that Customers pay for through the app (section 4).",
            "You provide the grooming services. You alone are responsible for them, for your staff, and for your dealings with Customers. We aren't a party to the contract between you and a Customer.",
          ]}
        />
      </Section>

      <Section id="account" title="2. Your account and team">
        <List
          items={[
            "Give accurate business details, including your ABN and GST status, and keep them up to date.",
            "You're responsible for everyone you add to your account and for what they do in it. Give each person the role they need: owners and managers see everything, the front desk handles bookings, and groomers see pet care information but not Customers' contact details or payments.",
          ]}
        />
      </Section>

      <Section id="payments" title="3. Online payments">
        <List
          items={[
            <>
              <strong>Stripe.</strong> To take payments through Lyra Pet, you open and keep a Stripe account through our Stripe Connect onboarding (in Manage Payments) and accept <A href="https://stripe.com/au/legal/connect-account">Stripe&apos;s Connected Account Agreement</A>. Stripe, not Lyra Pet, processes payments and pays out to your bank account.
            </>,
            <>
              <strong>You&apos;re the seller.</strong> Payments go to your Stripe account in your business name. You&apos;re the merchant of record, responsible for your prices, any receipt or tax invoice to the Customer, and GST on your services.
            </>,
            <>
              <strong>Payment in full at booking.</strong> If you take online payments, Customers pay the full estimated price for the services they choose when they send a request. The request reaches you only after payment succeeds.
            </>,
            <>
              <strong>Price changes.</strong> If the final price at the appointment differs from what was paid (for example, extra time for a matted coat), you settle the difference with the Customer directly. Our fee isn&apos;t charged on amounts settled outside the app.
            </>,
            <>
              <strong>Stripe&apos;s fees.</strong> Stripe charges its card processing fees to your Stripe account. They&apos;re separate from our service fee.
            </>,
          ]}
        />
      </Section>

      <Section id="fee" title="4. Lyra Pet's service fee">
        <List
          items={[
            <>
              For each booking a Customer pays through Lyra Pet, you pay a service fee of <strong>5% of the amount paid, including GST</strong>. For example, $4.75 on a $95.00 groom.
            </>,
            "The fee is deducted automatically from each payment, through Stripe, when the Customer pays. You receive the payment less our fee and Stripe's fees.",
            "If a paid booking is refunded in full, because you decline it, it expires before it's accepted, you cancel it, or the Customer cancels in line with your cancellation policy, our fee is returned to you in full.",
            "There's no fee on appointments you create yourself, or on bookings paid at your salon.",
            "Each month, Manage Payments shows your statement of payments, fees and refunds, and a tax invoice for our fees.",
            "We may change the fee by giving you at least 30 days' notice. If you don't agree, you can stop taking online payments or close your account before the change takes effect.",
          ]}
        />
      </Section>

      <Section id="refunds" title="5. Refunds, cancellations and disputes">
        <List
          items={[
            "We automatically refund the Customer in full if a paid request is declined, expires, or is cancelled by you, or by the Customer where your cancellation policy allows it.",
            "Honour the cancellation policy shown with your bookings, and give Customers the remedies they're entitled to under the Australian Consumer Law, which can't be excluded.",
            "You're responsible for chargebacks and disputes on payments to your Stripe account, as set out in Stripe's terms. Where a refund or chargeback relates to a booking, the matching service fee is returned to you.",
          ]}
        />
      </Section>

      <Section id="obligations" title="6. Your obligations">
        <List
          items={[
            "Keep your listing accurate, including services, prices, hours and policies, and respond to requests promptly.",
            "Comply with the law, including the Australian Consumer Law, animal welfare laws, the Privacy Act 1988 (Cth) where it applies to you, and the Spam Act 2003 (Cth) for any marketing you send.",
            "Don't use Lyra Pet to move Customers who found you through the Lyra Pet marketplace to bookings outside the app to avoid the service fee.",
          ]}
        />
      </Section>

      <Section id="messages" title="7. Messages, reviews and loyalty">
        <List
          items={[
            "Your owners, managers and front desk can read every conversation with your salon. A groomer can read a conversation while they have a booking for that Customer. Let your staff know their messages are visible to owners and managers.",
            "Until a Customer has paid for a booking through Lyra Pet, phone numbers, email addresses and links in messages are hidden.",
            "Customers can review your salon after a groom, and you can reply. Keep replies professional and don't share personal information. We may remove reviews or replies that break our rules, but we don't remove honest reviews because they're negative.",
            "If you run a loyalty program, you set its rules and honour points your Customers have earned.",
          ]}
        />
      </Section>

      <Section id="data" title="8. Customer information and privacy">
        <List
          items={[
            "You own your business data. We process it to provide the service, as described in our Privacy Policy.",
            "Customers' details are shared with you only for bookings and conversations with your salon. Use them only to provide your services, keep them confidential, and don't use them for marketing without the Customer's consent.",
            "We send Customers emails and app notifications about their bookings with your salon on your behalf (for example, when you confirm or decline a request).",
          ]}
        />
        <P>
          See the <Link href="/privacy" className="font-semibold text-primary-text underline underline-offset-2">Privacy Policy</Link> for how we handle personal information.
        </P>
      </Section>

      <Section id="liability" title="9. Liability">
        <List
          items={[
            "Nothing in these terms excludes rights you have under the Australian Consumer Law that can't be excluded.",
            "Subject to that, our total liability to you in any 12 months is limited to the service fees you paid us in that period, and we're not liable for indirect or consequential loss, such as lost profits or lost bookings.",
            "We work to keep Lyra Pet available and secure, but we can't promise it will always be uninterrupted or error-free.",
          ]}
        />
      </Section>

      <Section id="ending" title="10. Ending the agreement">
        <List
          items={[
            <>You can close your business account at any time by contacting <Contact email={d.email} />. Paid bookings that are still open will be completed or refunded.</>,
            "We may suspend or close an account that breaches these terms, with notice where reasonable.",
          ]}
        />
      </Section>

      <Section id="general" title="11. General">
        <P>
          These terms are governed by the laws of {d.state}, Australia. We may update them, giving at least 30 days&apos; notice of material changes. Questions? Contact <Contact email={d.email} />.
        </P>
      </Section>
    </LegalDoc>
  );
}
