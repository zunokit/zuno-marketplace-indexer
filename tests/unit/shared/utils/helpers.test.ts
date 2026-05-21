import type { Address, Hash } from '@/shared/types/blockchain';
import {
  bigintToString,
  calculateFee,
  calculatePercentage,
  chunkArray,
  createError,
  formatTimestamp,
  generateCollectionId,
  generateEventLogId,
  generateId,
  generateTokenId,
  generateTradeId,
  generateTransactionId,
  getCurrentDate,
  getUnixTimestamp,
  getZeroAddress,
  isValidAddress,
  isValidChainId,
  isValidHash,
  isZeroAddress,
  normalizeAddress,
  safeJsonParse,
  safeJsonStringify,
  sanitizeConfigKey,
  serializeBigInts,
  stringToBigint,
  truncateAddress,
  truncateString,
  uniqueArray,
} from '@/shared/utils/helpers';

const A = (s: string): Address => s as Address;
const H = (s: string): Hash => s as Hash;

describe('ID generators', () => {
  it('joins parts with colons', () => {
    expect(generateId(1, 'foo', 2n)).toBe('1:foo:2');
  });

  it('generateCollectionId lowercases the address', () => {
    expect(
      generateCollectionId(1, A('0xABCDEF0000000000000000000000000000000001')),
    ).toBe('1:0xabcdef0000000000000000000000000000000001');
  });

  it('generateTokenId combines chain, collection, tokenId', () => {
    expect(
      generateTokenId(8453, A('0xAA00000000000000000000000000000000000000'), '42'),
    ).toBe('8453:0xaa00000000000000000000000000000000000000:42');
  });

  it('generateTradeId / generateEventLogId share the (txHash, logIndex) shape', () => {
    const tx = H('0xdeadbeef');
    expect(generateTradeId(tx, 3)).toBe('0xdeadbeef:3');
    expect(generateEventLogId(tx, 3)).toBe('0xdeadbeef:3');
  });

  it('generateTransactionId combines chain and txHash', () => {
    expect(generateTransactionId(1, H('0xabc'))).toBe('1:0xabc');
  });
});

describe('address utilities', () => {
  it('normalizeAddress lowercases', () => {
    expect(normalizeAddress('0xAbCdEf0000000000000000000000000000000001')).toBe(
      '0xabcdef0000000000000000000000000000000001',
    );
  });

  it('isZeroAddress accepts mixed case and rejects others', () => {
    expect(isZeroAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    expect(isZeroAddress('0X0000000000000000000000000000000000000000')).toBe(true);
    expect(isZeroAddress('0x0000000000000000000000000000000000000001')).toBe(false);
  });

  it('getZeroAddress returns the canonical zero address', () => {
    expect(getZeroAddress()).toBe('0x0000000000000000000000000000000000000000');
  });

  it('truncateAddress shortens long addresses', () => {
    expect(
      truncateAddress(A('0x1234567890abcdef1234567890abcdef12345678')),
    ).toBe('0x1234...5678');
  });

  it('truncateAddress returns short input unchanged', () => {
    expect(truncateAddress(A('0xabc'))).toBe('0xabc');
  });
});

describe('bigint conversions', () => {
  it('bigintToString handles null/undefined as 0', () => {
    expect(bigintToString(null)).toBe('0');
    expect(bigintToString(undefined)).toBe('0');
    expect(bigintToString(123n)).toBe('123');
  });

  it('stringToBigint rejects invalid input by returning 0n', () => {
    expect(stringToBigint(undefined)).toBe(0n);
    expect(stringToBigint(null)).toBe(0n);
    expect(stringToBigint('0')).toBe(0n);
    expect(stringToBigint('')).toBe(0n);
    expect(stringToBigint('not-a-number')).toBe(0n);
    expect(stringToBigint('42')).toBe(42n);
  });
});

describe('fee calculations', () => {
  it('calculateFee uses basis points', () => {
    // 1 ETH * 500 bps = 0.05 ETH
    expect(calculateFee(10n ** 18n, 500)).toBe(5n * 10n ** 16n);
  });

  it('calculatePercentage handles total=0 safely', () => {
    expect(calculatePercentage(10n, 0n)).toBe(0);
  });

  it('calculatePercentage returns 25 for 1/4', () => {
    expect(calculatePercentage(25n, 100n)).toBe(25);
  });
});

describe('date utilities', () => {
  it('getCurrentDate extracts YYYY-MM-DD from unix seconds', () => {
    // 2024-05-20T00:00:00Z
    const ts = BigInt(Math.floor(Date.UTC(2024, 4, 20) / 1000));
    expect(getCurrentDate(ts)).toBe('2024-05-20');
  });

  it('formatTimestamp returns full ISO string', () => {
    const ts = BigInt(Math.floor(Date.UTC(2024, 0, 1, 0, 0, 0) / 1000));
    expect(formatTimestamp(ts)).toBe('2024-01-01T00:00:00.000Z');
  });

  it('getUnixTimestamp respects a provided Date', () => {
    const date = new Date('2024-05-20T12:34:56.000Z');
    expect(getUnixTimestamp(date)).toBe(
      BigInt(Math.floor(date.getTime() / 1000)),
    );
  });
});

describe('string utilities', () => {
  it('sanitizeConfigKey strips non alphanumerics, collapses runs and trims', () => {
    expect(sanitizeConfigKey('Foo Bar--Baz')).toBe('foo_bar_baz');
    expect(sanitizeConfigKey('__a__b__')).toBe('a_b');
  });

  it('sanitizeConfigKey throws on empty / non-string', () => {
    expect(() => sanitizeConfigKey('')).toThrow('Invalid config key');
    expect(() =>
      sanitizeConfigKey(undefined as unknown as string),
    ).toThrow('Invalid config key');
  });

  it('truncateString appends ellipsis when over length', () => {
    expect(truncateString('hello world', 5)).toBe('hello...');
  });

  it('truncateString leaves short strings unchanged', () => {
    expect(truncateString('hi', 5)).toBe('hi');
  });
});

describe('array utilities', () => {
  it('chunkArray splits into N-sized chunks', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('chunkArray returns [] for empty input', () => {
    expect(chunkArray([], 3)).toEqual([]);
  });

  it('uniqueArray removes duplicates preserving primitives', () => {
    expect(uniqueArray([1, 1, 2, 3, 3, 3])).toEqual([1, 2, 3]);
    expect(uniqueArray(['a', 'b', 'a'])).toEqual(['a', 'b']);
  });
});

describe('validation', () => {
  it('isValidAddress accepts a 0x + 40 hex address', () => {
    expect(isValidAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
  });

  it('isValidAddress rejects malformed input', () => {
    expect(isValidAddress('0x1234')).toBe(false);
    expect(isValidAddress('1234567890abcdef1234567890abcdef12345678')).toBe(false);
    expect(isValidAddress('0xZZZZ567890abcdef1234567890abcdef12345678')).toBe(false);
  });

  it('isValidHash accepts a 0x + 64 hex hash', () => {
    expect(
      isValidHash(
        '0xabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabca',
      ),
    ).toBe(true);
  });

  it('isValidHash rejects malformed input', () => {
    expect(isValidHash('0xshort')).toBe(false);
  });

  it('isValidChainId accepts positive ints, rejects others', () => {
    expect(isValidChainId(1)).toBe(true);
    expect(isValidChainId(8453)).toBe(true);
    expect(isValidChainId(0)).toBe(false);
    expect(isValidChainId(-1)).toBe(false);
    expect(isValidChainId(1.5)).toBe(false);
  });
});

describe('error & JSON helpers', () => {
  it('createError attaches context fields', () => {
    const err = createError('boom', { code: 'X', detail: 'y' });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('boom');
    expect((err as Error & { code: string }).code).toBe('X');
    expect((err as Error & { detail: string }).detail).toBe('y');
  });

  it('safeJsonParse returns parsed object', () => {
    expect(safeJsonParse('{"a":1}', { a: 0 })).toEqual({ a: 1 });
  });

  it('safeJsonParse returns fallback on bad input', () => {
    expect(safeJsonParse('not-json', { fallback: true })).toEqual({
      fallback: true,
    });
  });

  it('safeJsonStringify returns string for plain object', () => {
    expect(safeJsonStringify({ a: 1 })).toBe('{"a":1}');
  });

  it('safeJsonStringify returns fallback for circular structure', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(safeJsonStringify(obj, '{"err":true}')).toBe('{"err":true}');
  });
});

describe('serializeBigInts', () => {
  it('converts a bare bigint to string', () => {
    expect(serializeBigInts(10n)).toBe('10');
  });

  it('returns null / undefined as-is', () => {
    expect(serializeBigInts(null)).toBeNull();
    expect(serializeBigInts(undefined)).toBeUndefined();
  });

  it('walks nested objects and arrays', () => {
    const input = {
      a: 1n,
      b: 'x',
      c: [2n, { d: 3n, e: null }],
    };
    expect(serializeBigInts(input)).toEqual({
      a: '1',
      b: 'x',
      c: ['2', { d: '3', e: null }],
    });
  });

  it('passes through non-bigint primitives untouched', () => {
    expect(serializeBigInts(42)).toBe(42);
    expect(serializeBigInts(false)).toBe(false);
    expect(serializeBigInts('hi')).toBe('hi');
  });
});
