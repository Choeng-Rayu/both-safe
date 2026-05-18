import { BadRequestException } from '@nestjs/common';
import { CURRENCIES } from '../../common/constants';
import {
  assertCurrency,
  formatMajor,
  fromMinorUnits,
  isSupportedCurrency,
  minorPerMajor,
  serializeMinor,
  toMinorUnits,
} from './money';

describe('money helpers', () => {
  describe('toMinorUnits', () => {
    it('converts USD to cents', () => {
      expect(toMinorUnits(12.5, CURRENCIES.USD)).toBe(1250n);
      expect(toMinorUnits(0.99, CURRENCIES.USD)).toBe(99n);
      expect(toMinorUnits(0, CURRENCIES.USD)).toBe(0n);
    });

    it('treats KHR as a single unit (no subdivision)', () => {
      expect(toMinorUnits(5000, CURRENCIES.KHR)).toBe(5000n);
      expect(toMinorUnits(1, CURRENCIES.KHR)).toBe(1n);
    });

    it('rounds USD to avoid floating-point error', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in floating point.
      expect(toMinorUnits(0.1 + 0.2, CURRENCIES.USD)).toBe(30n);
    });

    it('rejects negative or non-finite amounts', () => {
      expect(() => toMinorUnits(-1, CURRENCIES.USD)).toThrow(BadRequestException);
      expect(() => toMinorUnits(Number.NaN, CURRENCIES.USD)).toThrow(BadRequestException);
      expect(() => toMinorUnits(Number.POSITIVE_INFINITY, CURRENCIES.USD)).toThrow(BadRequestException);
    });

    it('parses numeric strings', () => {
      expect(toMinorUnits('12.50', CURRENCIES.USD)).toBe(1250n);
    });
  });

  describe('fromMinorUnits', () => {
    it('converts cents back to a major-unit number', () => {
      expect(fromMinorUnits(1250n, CURRENCIES.USD)).toBeCloseTo(12.5);
      expect(fromMinorUnits(99n, CURRENCIES.USD)).toBeCloseTo(0.99);
    });

    it('preserves KHR riels as-is', () => {
      expect(fromMinorUnits(5000n, CURRENCIES.KHR)).toBe(5000);
    });
  });

  describe('formatMajor', () => {
    it('formats USD with two decimals', () => {
      expect(formatMajor(1250n, CURRENCIES.USD)).toBe('12.50');
      expect(formatMajor(0n, CURRENCIES.USD)).toBe('0.00');
    });

    it('formats KHR with no decimals', () => {
      expect(formatMajor(5000n, CURRENCIES.KHR)).toBe('5000');
    });
  });

  describe('isSupportedCurrency / assertCurrency', () => {
    it('accepts USD and KHR', () => {
      expect(isSupportedCurrency('USD')).toBe(true);
      expect(isSupportedCurrency('KHR')).toBe(true);
      expect(assertCurrency('USD')).toBe('USD');
    });

    it('rejects unknown currencies', () => {
      expect(isSupportedCurrency('EUR')).toBe(false);
      expect(() => assertCurrency('EUR')).toThrow(BadRequestException);
    });
  });

  describe('minorPerMajor', () => {
    it('returns 100 for USD and 1 for KHR', () => {
      expect(minorPerMajor(CURRENCIES.USD)).toBe(100n);
      expect(minorPerMajor(CURRENCIES.KHR)).toBe(1n);
    });
  });

  describe('serializeMinor', () => {
    it('serializes BigInt to plain string for JSON-safe payloads', () => {
      expect(serializeMinor(1234567890123n)).toBe('1234567890123');
    });
  });
});
