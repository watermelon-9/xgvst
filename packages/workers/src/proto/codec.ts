import {
  decodeQuote,
  decodeQuoteSnapshot,
  decodeSelfSelectList,
  encodeQuote,
  encodeQuoteSnapshot,
  encodeSelfSelectList,
  type QuotePayload,
  type QuoteSnapshotPayload,
  type SelfSelectListPayload
} from './quote';
import type { QuoteTick } from '../sources/QuoteSource';

export class ProtobufCodec {
  private static _instance: ProtobufCodec | null = null;

  static instance(): ProtobufCodec {
    if (!ProtobufCodec._instance) {
      ProtobufCodec._instance = new ProtobufCodec();
    }
    return ProtobufCodec._instance;
  }

  encodeTicker(tick: QuotePayload): Uint8Array {
    return encodeQuote(tick);
  }

  decodeTicker(input: ArrayBuffer | Uint8Array): QuotePayload {
    return decodeQuote(input);
  }

  encodeQuoteTick(tick: QuoteTick): Uint8Array {
    return encodeQuote({
      symbol: tick.symbol,
      price: tick.price,
      changePct: tick.changePct,
      ts: tick.ts,
      source: tick.source
    });
  }

  encodeSnapshot(tick: QuoteTick, capturedAtMs = Date.now()): Uint8Array {
    const payload: QuoteSnapshotPayload = {
      ticker: {
        symbol: tick.symbol,
        price: tick.price,
        changePct: tick.changePct,
        ts: tick.ts,
        source: tick.source
      },
      capturedAtMs
    };
    return encodeQuoteSnapshot(payload);
  }

  decodeSnapshot(input: ArrayBuffer | Uint8Array): QuoteSnapshotPayload {
    return decodeQuoteSnapshot(input);
  }

  encodeSelfSelectList(payload: SelfSelectListPayload): Uint8Array {
    return encodeSelfSelectList(payload);
  }

  decodeSelfSelectList(input: ArrayBuffer | Uint8Array): SelfSelectListPayload {
    return decodeSelfSelectList(input);
  }
}

export const protobufCodec = ProtobufCodec.instance();
