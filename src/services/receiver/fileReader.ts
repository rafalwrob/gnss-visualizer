import type { ProtocolAdapter, ParsedData } from '../parsers/protocolAdapter';

export async function readFileWithAdapter(
  file: File,
  adapter: ProtocolAdapter,
  onData: (data: ParsedData) => void,
  onProgress?: (pct: number) => void,
  onBytes?: (n: number) => void,
  chunkSize = 4096,
): Promise<void> {
  adapter.reset();
  let offset = 0;
  const total = file.size;

  while (offset < total) {
    const slice = file.slice(offset, offset + chunkSize);
    const buf = await slice.arrayBuffer();
    const chunk = new Uint8Array(buf);
    onBytes?.(chunk.byteLength);
    const data = adapter.feed(chunk);

    const hasData =
      (data.measurements?.length ?? 0) > 0 ||
      (data.observations?.length ?? 0) > 0 ||
      (data.ephemerides?.length ?? 0) > 0 ||
      (data.almanacs?.length ?? 0) > 0 ||
      data.positionFix != null;
    if (hasData) onData(data);

    offset += chunkSize;
    onProgress?.(Math.min(100, Math.round((offset / total) * 100)));
  }
}
