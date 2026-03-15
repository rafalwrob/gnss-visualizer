import type { ProtocolAdapter } from './protocolAdapter';
import type { ProtocolSchema } from '../../types/protocolSchema';
import { SchemaAdapter } from './schemaAdapter';

export function validateAdapter(obj: unknown): ProtocolAdapter {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Plugin musi eksportować obiekt jako default export');
  }
  const a = obj as Record<string, unknown>;

  // Schemat deklaratywny — zawiera $schema: true
  if (a.$schema === true) {
    return new SchemaAdapter(a as unknown as ProtocolSchema);
  }

  if (typeof a.name !== 'string') throw new Error('Plugin: brak pola name (string)');
  if (typeof a.description !== 'string') throw new Error('Plugin: brak pola description (string)');
  if (typeof a.feed !== 'function') throw new Error('Plugin: brak metody feed(chunk)');
  if (typeof a.reset !== 'function') throw new Error('Plugin: brak metody reset()');
  return obj as ProtocolAdapter;
}

/** Tworzy adapter z obiektu schematu (do użycia wewnętrznego — bez ładowania pliku) */
export function adapterFromSchema(schema: ProtocolSchema): ProtocolAdapter {
  return new SchemaAdapter(schema);
}

export async function loadPluginFromFile(file: File): Promise<ProtocolAdapter> {
  const text = await file.text();
  const blob = new Blob([text], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    const mod = await import(/* @vite-ignore */ url);
    return validateAdapter(mod.default);
  } finally {
    URL.revokeObjectURL(url);
  }
}
