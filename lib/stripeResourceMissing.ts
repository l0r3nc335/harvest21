import Stripe from "stripe";

export function isStripeResourceMissingError(error: unknown): boolean {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.code === "resource_missing"
  );
}

export async function stripePaymentIntentRetrieveOrNull(
  stripeClient: Stripe,
  id: string,
  params?: Stripe.PaymentIntentRetrieveParams
): Promise<Stripe.PaymentIntent | null> {
  try {
    return await stripeClient.paymentIntents.retrieve(id, params);
  } catch (e) {
    if (isStripeResourceMissingError(e)) return null;
    throw e;
  }
}

export async function stripeSubscriptionRetrieveOrNull(
  stripeClient: Stripe,
  id: string,
  params?: Stripe.SubscriptionRetrieveParams
): Promise<Stripe.Subscription | null> {
  try {
    return await stripeClient.subscriptions.retrieve(id, params);
  } catch (e) {
    if (isStripeResourceMissingError(e)) return null;
    throw e;
  }
}
