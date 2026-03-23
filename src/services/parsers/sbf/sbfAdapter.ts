import type { ProtocolAdapter, ParsedData } from '../protocolAdapter';
import { SbfFramer } from './sbfFramer';
import { decodeMeasEpoch } from './measEpochDecoder';
import { decodeAlmanacBlock, decodeNavBlock } from './navDecoder';
import { decodePvtGeodetic } from './pvtGeodeticDecoder';
import { decodeSatVisibility } from './satVisibilityDecoder';

const BLOCK_MEAS_EPOCH    = 4027;
const BLOCK_PVT_GEODETIC  = 4007;
const BLOCK_SAT_VISIBILITY = 4012;

export class SbfAdapter implements ProtocolAdapter {
  readonly name = 'Septentrio SBF';
  readonly description = 'Binarny protokół Septentrio (MeasEpoch, PVTGeodetic, SatVisibility)';

  private framer = new SbfFramer();

  feed(chunk: Uint8Array): ParsedData {
    const blocks = this.framer.feed(chunk);
    const result: ParsedData = {};

    for (const blk of blocks) {
      if (blk.blockId === BLOCK_MEAS_EPOCH) {
        const meas = decodeMeasEpoch(blk.block);
        if (meas.length > 0) {
          result.measurements = [...(result.measurements ?? []), ...meas];
        }
      }

      if (blk.blockId === BLOCK_PVT_GEODETIC) {
        const fix = decodePvtGeodetic(blk.block);
        if (fix) result.positionFix = fix;
      }

      if (blk.blockId === BLOCK_SAT_VISIBILITY) {
        const obs = decodeSatVisibility(blk.block);
        if (obs.length > 0) result.observations = obs;
      }

      const eph = decodeNavBlock(blk.blockId, blk.block);
      if (eph) {
        result.ephemerides = [...(result.ephemerides ?? []), eph];
      }

      const alm = decodeAlmanacBlock(blk.blockId, blk.block);
      if (alm) {
        result.almanacs = [...(result.almanacs ?? []), alm];
      }
    }

    return result;
  }

  reset(): void {
    this.framer.reset();
  }
}
