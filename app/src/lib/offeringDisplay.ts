import type { LiveOffering } from './offerings';

const CATEGORY_LABEL: Record<LiveOffering['category'], string> = {
  treasury: 'Treasury',
  'real-estate': 'Real Estate',
  'private-credit': 'Private Credit',
};

export function offeringCategoryLabel(offering: LiveOffering): string {
  if (offering.settlementRoute === 'dex') return 'DEX';
  if (offering.settlementRoute === 'payroll') return 'Payroll';
  return CATEGORY_LABEL[offering.category] ?? offering.category;
}

export const MARKETPLACE_CATEGORIES = [
  'All',
  'Treasury',
  'Real Estate',
  'Private Credit',
  'Payroll',
  'DEX',
] as const;

export type MarketplaceCategory = (typeof MARKETPLACE_CATEGORIES)[number];

export function offeringMatchesCategory(offering: LiveOffering, cat: MarketplaceCategory): boolean {
  if (cat === 'All') return true;
  if (cat === 'DEX') return offering.settlementRoute === 'dex';
  if (cat === 'Payroll') return offering.settlementRoute === 'payroll';
  if (cat === 'Treasury') return offering.category === 'treasury';
  if (cat === 'Real Estate') return offering.category === 'real-estate';
  if (cat === 'Private Credit') return offering.category === 'private-credit';
  return false;
}

export const OFFERING_DESIGN_IMAGES: Record<LiveOffering['category'], string> = {
  treasury: '/design/product-treasury.jpg',
  'real-estate': '/design/product-realestate.jpg',
  'private-credit': '/design/product-credit.jpg',
};

export function offeringDesignImage(offering: LiveOffering): string {
  if (offering.settlementRoute === 'dex') return '/design/product-dex.jpg';
  if (offering.settlementRoute === 'payroll') return '/design/product-payroll.jpg';
  return OFFERING_DESIGN_IMAGES[offering.category];
}
