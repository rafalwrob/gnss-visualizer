import type { ProtocolAdapter, ParsedData } from '../protocolAdapter';
import { UbxFramer } from './ubxFramer';
import { SfrbxDecoder } from './sfrbxDecoder';
import { decodeRawx } from './rawxDecoder';

export class UbxAdapter implements ProtocolAdapter {
  readonly name = 'u-blox UBX';
  readonly description = 'Binarny protokół u-blox (UBX-RXM-RAWX, UBX-RXM-SFRBX)';

  private framer = new UbxFramer();
  private sfrbx = new SfrbxDecoder();

  feed(chunk: Uint8Array): ParsedData {
    const frames = this.framer.feed(chunk);
    const result: ParsedData = {};

    for (const frame of frames) {
      // UBX-RXM-RAWX cls=0x02, id=0x15
      if (frame.cls === 0x02 && frame.id === 0x15) {
        const meas = decodeRawx(frame.payload);
        if (meas.length > 0) {
          result.measurements = [...(result.measurements ?? []), ...meas];
        }
      }

      // UBX-RXM-SFRBX cls=0x02, id=0x13
      if (frame.cls === 0x02 && frame.id === 0x13) {
        const eph = this.sfrbx.feed(frame.payload);
        if (eph) {
          result.ephemerides = [...(result.ephemerides ?? []), eph];
        }
      }
    }

    return result;
  }

  reset(): void {
    this.framer.reset();
    this.sfrbx.reset();
  }
}
