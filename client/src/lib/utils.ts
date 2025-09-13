import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format cryptocurrency prices by removing trailing zeros while preserving meaningful digits
 * Examples: 0.847397000 → 0.8473970, 1.4857000 → 1.48570, 2845672 → 2845672
 */
export function formatCryptoPrice(price: string | number, currency: string = 'INR'): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(numPrice)) {
    return '₹0';
  }
  
  // Convert to string and remove trailing zeros
  let priceStr = numPrice.toString();
  
  // If it has decimal places, remove trailing zeros
  if (priceStr.includes('.')) {
    priceStr = priceStr.replace(/0+$/, '').replace(/\.$/, '');
  }
  
  // Format with currency symbol
  if (currency === 'INR') {
    return `₹${priceStr}`;
  } else if (currency === 'USD') {
    return `$${priceStr}`;
  } else {
    return priceStr;
  }
}
