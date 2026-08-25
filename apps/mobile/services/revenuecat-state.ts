export type PremiumPackage = {
  identifier: string;
  price: string;
  productId: string;
  title: string;
};

type PremiumPackageSource = {
  identifier: string;
  product: {
    identifier: string;
    priceString: string;
    title: string;
  };
};

export function describePremiumPackage(
  purchasePackage: PremiumPackageSource | null,
): PremiumPackage | null {
  if (!purchasePackage) {
    return null;
  }

  return {
    identifier: purchasePackage.identifier,
    price: purchasePackage.product.priceString,
    productId: purchasePackage.product.identifier,
    title: purchasePackage.product.title,
  };
}

export function isPurchaseCancelled(reason: unknown): boolean {
  return (
    typeof reason === 'object' &&
    reason !== null &&
    'code' in reason &&
    reason.code === '1'
  );
}
