import { describe, expect, it } from 'vitest'

import {
  formatXlm,
  hasEnded,
  progressPercent,
  shortenAddress,
  stroopsToXlm,
  timeAgo,
  timeRemaining,
  xlmToStroops,
} from './format'

describe('stroopsToXlm', () => {
  it('converts whole XLM without a decimal point', () => {
    expect(stroopsToXlm(10_000_000n)).toBe('1')
    expect(stroopsToXlm(0n)).toBe('0')
  })

  it('trims trailing zeros rather than printing 1.5000000', () => {
    expect(stroopsToXlm(15_000_000n)).toBe('1.5')
    expect(stroopsToXlm(1_230_000n)).toBe('0.123')
  })

  it('keeps every one of the 7 decimal places when they carry information', () => {
    expect(stroopsToXlm(1n)).toBe('0.0000001')
    expect(stroopsToXlm(12_345_678n)).toBe('1.2345678')
  })

  /**
   * The reason amounts stay bigint end to end: this campaign total is past
   * Number.MAX_SAFE_INTEGER, and a float round-trip would quietly lose stroops.
   */
  it('does not lose precision on amounts beyond 2^53', () => {
    expect(stroopsToXlm(90_071_992_547_409_910n)).toBe('9007199254.740991')
  })
})

describe('xlmToStroops', () => {
  it('parses whole and fractional amounts', () => {
    expect(xlmToStroops('1')).toBe(10_000_000n)
    expect(xlmToStroops('1.5')).toBe(15_000_000n)
    expect(xlmToStroops('0.0000001')).toBe(1n)
    expect(xlmToStroops(' 12.25 ')).toBe(122_500_000n)
  })

  it('round-trips with stroopsToXlm', () => {
    for (const amount of ['0', '1', '1.5', '0.0000001', '1234.5678901']) {
      expect(stroopsToXlm(xlmToStroops(amount))).toBe(amount === '0' ? '0' : amount)
    }
  })

  it('rejects input rather than silently returning zero', () => {
    expect(() => xlmToStroops('')).toThrow()
    expect(() => xlmToStroops('abc')).toThrow()
    expect(() => xlmToStroops('-1')).toThrow()
    expect(() => xlmToStroops('1.2.3')).toThrow()
    // 8 decimal places is finer than a stroop.
    expect(() => xlmToStroops('0.00000001')).toThrow()
  })
})

describe('formatXlm', () => {
  it('groups thousands', () => {
    expect(formatXlm(10_000_000_000n)).toBe('1,000')
    expect(formatXlm(12_345_678_900_000n)).toBe('1,234,567.89')
  })

  it('leaves small amounts alone', () => {
    expect(formatXlm(5_000_000n)).toBe('0.5')
  })
})

describe('progressPercent', () => {
  it('reports the share of the goal raised', () => {
    expect(progressPercent(500n, 1_000n)).toBe(50)
    expect(progressPercent(0n, 1_000n)).toBe(0)
  })

  it('caps at 100 so an overfunded campaign does not overflow the bar', () => {
    expect(progressPercent(5_000n, 1_000n)).toBe(100)
  })

  it('treats a zero goal as zero progress instead of dividing by it', () => {
    expect(progressPercent(100n, 0n)).toBe(0)
  })
})

describe('shortenAddress', () => {
  const address = 'GDD5YXT3WW6GOGGTVCTP6TXGR2B7OWKK247KYCWXRUSMOZ2TOJU73ORY'

  it('keeps the ends, which is what makes an address recognisable', () => {
    expect(shortenAddress(address)).toBe('GDD5YX…3ORY')
  })

  it('leaves anything already short enough untouched', () => {
    expect(shortenAddress('GABC')).toBe('GABC')
  })
})

describe('timeRemaining', () => {
  const now = 1_700_000_000_000 // ms

  it('counts down in the largest sensible unit', () => {
    expect(timeRemaining(1_700_259_200n, now)).toBe('3 days left')
    expect(timeRemaining(1_700_007_200n, now)).toBe('2 hours left')
    expect(timeRemaining(1_700_000_300n, now)).toBe('5 minutes left')
  })

  it('says Ended once the deadline passes', () => {
    expect(timeRemaining(1_699_999_999n, now)).toBe('Ended')
    expect(hasEnded(1_699_999_999n, now)).toBe(true)
    expect(hasEnded(1_700_000_001n, now)).toBe(false)
  })

  it('never rounds a live campaign down to "0 minutes left"', () => {
    expect(timeRemaining(1_700_000_030n, now)).toBe('1 minute left')
  })
})

describe('timeAgo', () => {
  const now = 1_700_000_000_000

  it('describes how long ago an event landed', () => {
    expect(timeAgo(1_700_000_000n, now)).toBe('just now')
    expect(timeAgo(1_699_999_700n, now)).toBe('5m ago')
    expect(timeAgo(1_699_992_800n, now)).toBe('2h ago')
    expect(timeAgo(1_699_827_200n, now)).toBe('2d ago')
  })

  it('clamps a clock skew into the future rather than printing a negative', () => {
    expect(timeAgo(1_700_000_060n, now)).toBe('just now')
  })
})
