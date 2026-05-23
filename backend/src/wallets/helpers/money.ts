import { BadRequestException } from '@nestjs/common';
import { CURRENCIES, type Currency } from '../../common/constants';

const USD_MINOR_PER_MAJOR = 100n;
const KHR_MINOR_PER_MAJOR = 1n;

export function isSupportedCurrency(value: string): value is Currency {
  return value === CURRENCIES.USD || value === CURRENCIES.KHR;
}

export function assertCurrency(value: string): Currency {
  if (!isSupportedCurrency(value)) {
    throw new BadRequestException({
      messageKey: 'validation.failed',
      details: { field: 'currency', allowed: Object.values(CURRENCIES) },
    });
  }
  return value;
}

export function toMinorUnits(
  amount: number | string,
  currency: Currency,
): bigint {
  const asNumber = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(asNumber) || asNumber < 0) {
    throw new BadRequestException({
      messageKey: 'validation.failed',
      details: {
        field: 'amount',
        reason: 'must be a non-negative finite number',
      },
    });
  }
  if (currency === CURRENCIES.USD) {
    return BigInt(Math.round(asNumber * 100));
  }
  return BigInt(Math.round(asNumber));
}

export function fromMinorUnits(amount: bigint, currency: Currency): number {
  const minor = Number(amount);
  if (currency === CURRENCIES.USD) {
    return minor / 100;
  }
  return minor;
}

export function minorPerMajor(currency: Currency): bigint {
  return currency === CURRENCIES.USD
    ? USD_MINOR_PER_MAJOR
    : KHR_MINOR_PER_MAJOR;
}

export function formatMajor(amount: bigint, currency: Currency): string {
  const major = fromMinorUnits(amount, currency);
  if (currency === CURRENCIES.USD) {
    return major.toFixed(2);
  }
  return Math.round(major).toString();
}

export function serializeMinor(amount: bigint): string {
  return amount.toString();
}
