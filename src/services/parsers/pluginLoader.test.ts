import { describe, it, expect } from 'vitest';
import { validateAdapter } from './pluginLoader';

describe('validateAdapter', () => {
  it('akceptuje poprawny obiekt adaptera', () => {
    const obj = {
      name: 'TestProtocol',
      description: 'Test',
      feed: (_chunk: Uint8Array) => ({}),
      reset: () => {},
    };
    const adapter = validateAdapter(obj);
    expect(adapter.name).toBe('TestProtocol');
    expect(adapter.description).toBe('Test');
    expect(typeof adapter.feed).toBe('function');
    expect(typeof adapter.reset).toBe('function');
  });

  it('rzuca błąd gdy brak name', () => {
    expect(() => validateAdapter({
      description: 'Test',
      feed: () => ({}),
      reset: () => {},
    })).toThrow('name');
  });

  it('rzuca błąd gdy brak description', () => {
    expect(() => validateAdapter({
      name: 'X',
      feed: () => ({}),
      reset: () => {},
    })).toThrow('description');
  });

  it('rzuca błąd gdy brak feed', () => {
    expect(() => validateAdapter({
      name: 'X',
      description: 'X',
      reset: () => {},
    })).toThrow('feed');
  });

  it('rzuca błąd gdy brak reset', () => {
    expect(() => validateAdapter({
      name: 'X',
      description: 'X',
      feed: () => ({}),
    })).toThrow('reset');
  });

  it('rzuca błąd gdy default export nie jest obiektem', () => {
    expect(() => validateAdapter(42)).toThrow();
    expect(() => validateAdapter(null)).toThrow();
    expect(() => validateAdapter(undefined)).toThrow();
  });

  it('adapter feed() zwraca ParsedData', () => {
    const obj = {
      name: 'P',
      description: 'D',
      feed: (_chunk: Uint8Array) => ({
        positionFix: { lat: 52.0, lon: 21.0, alt: 100, fixType: '3d' as const },
      }),
      reset: () => {},
    };
    const adapter = validateAdapter(obj);
    const result = adapter.feed(new Uint8Array([1, 2, 3]));
    expect(result.positionFix?.lat).toBe(52.0);
  });
});
