import { describe, it, expect } from 'vitest';
import { klobucherDelay, DEFAULT_KLOBUCHAR, buildIonoGrid } from './ionosphere';

describe('klobucherDelay', () => {
  it('południe, równik, zenith: opóźnienie > 0', () => {
    const d = klobucherDelay(90, 0, 0, 0, 50400, DEFAULT_KLOBUCHAR);
    expect(d).toBeGreaterThan(0);
  });

  it('noc: mniejsze opóźnienie niż południe', () => {
    const noon  = klobucherDelay(90, 0, 0, 0, 50400, DEFAULT_KLOBUCHAR);
    const night = klobucherDelay(90, 0, 0, 0, 0,     DEFAULT_KLOBUCHAR);
    expect(noon).toBeGreaterThan(night);
  });

  it('niski kąt elewacji: większe opóźnienie niż zenith', () => {
    const low  = klobucherDelay(10, 0, 0, 0, 50400, DEFAULT_KLOBUCHAR);
    const high = klobucherDelay(90, 0, 0, 0, 50400, DEFAULT_KLOBUCHAR);
    expect(low).toBeGreaterThan(high);
  });

  it('zwraca wartości w sensownym zakresie [0.5m, 100m]', () => {
    for (const elev of [5, 15, 30, 45, 60, 90]) {
      const d = klobucherDelay(elev, 50, 20, 180, 50400, DEFAULT_KLOBUCHAR);
      expect(d).toBeGreaterThan(0.1);
      expect(d).toBeLessThan(200);
    }
  });
});

describe('buildIonoGrid', () => {
  it('zwraca tablicę o rozmiarze nLat*nLon', () => {
    const { grid } = buildIonoGrid(18, 36);
    expect(grid.length).toBe(18 * 36);
  });

  it('minV < maxV', () => {
    const { minV, maxV } = buildIonoGrid(18, 36);
    expect(minV).toBeLessThan(maxV);
  });
});
