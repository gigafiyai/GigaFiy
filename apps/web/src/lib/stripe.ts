import Stripe from "stripe";

let _client: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_client) {
    _client = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  }
  return _client;
}

export function depositAmountCents(p: {
  depositAmount: number | null;
  bookedShowFee: number | null;
}): number {
  if (p.depositAmount != null) return Math.round(p.depositAmount * 100);
  if (p.bookedShowFee != null) return Math.round(p.bookedShowFee * 50); // 50% in cents
  return 30000; // $300 default
}
