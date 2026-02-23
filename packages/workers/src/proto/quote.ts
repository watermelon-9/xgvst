import { Writer } from 'protobufjs/minimal';

export interface QuotePayload {
  symbol: string;
  price: number;
  changePct: number;
  ts: string;
}

/**
 * QuotePayload proto3 encoding:
 * 1 -> symbol (string)
 * 2 -> price (double)
 * 3 -> changePct (double)
 * 4 -> ts (string)
 */
export function encodeQuote(payload: QuotePayload): Uint8Array {
  const writer = Writer.create();

  writer.uint32(10).string(payload.symbol);
  writer.uint32(17).double(payload.price);
  writer.uint32(25).double(payload.changePct);
  writer.uint32(34).string(payload.ts);

  return writer.finish();
}
