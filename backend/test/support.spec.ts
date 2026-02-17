import { describe, it, expect } from 'vitest';
import { supportEventToDamage } from '../src/lib/support';

describe('supportEventToDamage', () => {
  it('calculates bits damage', () => {
    expect(supportEventToDamage({ type: 'bits', amount: 100 })).toBe(100);
  });

  it('calculates sub damage', () => {
    expect(supportEventToDamage({ type: 'sub' })).toBe(500);
  });

  it('calculates gift_sub damage', () => {
    expect(supportEventToDamage({ type: 'gift_sub' })).toBe(250);
  });
});

