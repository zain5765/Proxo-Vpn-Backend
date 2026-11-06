export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    maxDevices: 1,
    sessionMinutes: 30,
    ads: true,
    multiHop: false,
    allLocations: false,
  },
  premium_monthly: {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    /** Must match Play/App Store + RevenueCat product identifiers */
    productIds: ['horse_vpn_premium_monthly'],
    revenueCatEntitlement: 'premium',
    priceLabel: '$4.99 / month',
    maxDevices: 5,
    sessionMinutes: null as number | null,
    ads: false,
    multiHop: true,
    allLocations: true,
  },
  premium_yearly: {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    productIds: ['horse_vpn_premium_yearly'],
    revenueCatEntitlement: 'premium',
    priceLabel: '$39.99 / year',
    maxDevices: 5,
    sessionMinutes: null as number | null,
    ads: false,
    multiHop: true,
    allLocations: true,
  },
} as const;

export function isPremiumProduct(productId: string): boolean {
  const ids = [
    ...PLANS.premium_monthly.productIds,
    ...PLANS.premium_yearly.productIds,
  ] as string[];
  return (
    ids.includes(productId) || productId.toLowerCase().includes('premium')
  );
}
