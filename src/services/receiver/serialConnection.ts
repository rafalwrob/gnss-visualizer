import type { ProtocolAdapter, ParsedData } from '../parsers/protocolAdapter';

export type ReceiverStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SerialConnectionOptions {
  baudRate?: number;
  onData: (data: ParsedData) => void;
  onStatus: (status: ReceiverStatus, error?: string) => void;
  onBytes?: (count: number) => void;
}

// Minimalne typy WebSerial API (nie wymagamy zewnętrznego pakietu)
interface WebSerialPort {
  open(opts: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
}
interface WebSerial {
  requestPort(): Promise<WebSerialPort>;
}

export class SerialConnection {
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private port: WebSerialPort | null = null;
  private running = false;

  static isSupported(): boolean {
    return 'serial' in navigator;
  }

  async connect(adapter: ProtocolAdapter, opts: SerialConnectionOptions): Promise<void> {
    if (!SerialConnection.isSupported()) {
      opts.onStatus('error', 'WebSerial nie jest obsługiwany w tej przeglądarce (wymagany Chrome/Edge)');
      return;
    }

    opts.onStatus('connecting');
    try {
      const serial = (navigator as unknown as { serial: WebSerial }).serial;
      this.port = await serial.requestPort();
      await this.port.open({ baudRate: opts.baudRate ?? 115200 });
      opts.onStatus('connected');
      adapter.reset();
      this.running = true;
      this._readLoop(adapter, opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      opts.onStatus('error', msg);
    }
  }

  async disconnect(): Promise<void> {
    this.running = false;
    try {
      await this.reader?.cancel();
    } catch { /* ignoruj */ }
    this.reader = null;
    try {
      await this.port?.close();
    } catch { /* ignoruj */ }
    this.port = null;
  }

  private async _readLoop(adapter: ProtocolAdapter, opts: SerialConnectionOptions): Promise<void> {
    const readable = this.port?.readable;
    if (!readable) return;
    this.reader = readable.getReader();
    try {
      while (this.running) {
        const { value, done } = await this.reader.read();
        if (done || !value) break;
        opts.onBytes?.(value.byteLength);
        const data = adapter.feed(value);
        const hasData =
          (data.measurements?.length ?? 0) > 0 ||
          (data.observations?.length ?? 0) > 0 ||
          (data.ephemerides?.length ?? 0) > 0 ||
          (data.almanacs?.length ?? 0) > 0 ||
          data.positionFix != null;
        if (hasData) opts.onData(data);
      }
    } catch (err) {
      if (this.running) {
        const msg = err instanceof Error ? err.message : String(err);
        opts.onStatus('error', msg);
      }
    } finally {
      this.reader = null;
      if (this.running) opts.onStatus('disconnected');
    }
  }
}
