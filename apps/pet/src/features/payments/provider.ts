import "server-only";
import type Stripe from "stripe";

/**
 * The payments provider seen by the rest of the app (ADR 0004). Only
 * stripe.ts talks to Stripe; tests and local e2e use fake.ts.
 */
export type ConnectedAccount = { id: string; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean };
export type CheckoutInput = { account: string; amountCents: number; feeCents: number; description: string; customerEmail: string | null; requestId: string; successUrl: string; cancelUrl: string };
export type CheckoutSession = { id: string; url: string; paid: boolean; paymentIntent: string | null };
export type WebhookEvent = { type: string; account: string | null; object: Stripe.Event.Data.Object };

export interface PaymentsProvider {
  createAccount(input: { businessName: string; email: string | null }): Promise<string>;
  onboardingLink(account: string, returnUrl: string, refreshUrl: string): Promise<string>;
  dashboardLink(account: string): Promise<string | null>;
  getAccount(account: string): Promise<ConnectedAccount>;
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  getCheckout(account: string, sessionId: string): Promise<CheckoutSession>;
  refund(account: string, paymentIntent: string): Promise<string>;
  parseWebhook(body: string, signature: string): WebhookEvent;
}
