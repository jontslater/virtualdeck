import { describe, it, expect } from 'vitest';
import { createBattle, applyDamageToBattle, endBattle } from '../src/store';

describe('battle engine', () => {
  it('creates a battle and applies damage', () => {
    const b = createBattle('room1', 60, 1000);
    expect(b.hpA).toBe(1000);
    expect(b.hpB).toBe(1000);
    applyDamageToBattle(b, 'A', 200);
    expect(b.hpB).toBe(800);
    applyDamageToBattle(b, 'B', 800);
    expect(b.hpA).toBe(200);
  });

  it('ends battle when hp reaches 0', () => {
    const b = createBattle('room2', 60, 500);
    applyDamageToBattle(b, 'A', 500);
    expect(b.status).toBe('ended');
    expect(b.winnerTeam).toBe('A');
  });
});

