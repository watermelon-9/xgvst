import protobuf from 'protobufjs/light';

export interface QuotePayload {
  symbol: string;
  price: number;
  changePct: number;
  ts: string;
}

const QuoteType = new protobuf.Type('QuotePayload')
  .add(new protobuf.Field('symbol', 1, 'string'))
  .add(new protobuf.Field('price', 2, 'double'))
  .add(new protobuf.Field('changePct', 3, 'double'))
  .add(new protobuf.Field('ts', 4, 'string'));

export function encodeQuote(payload: QuotePayload): Uint8Array {
  const message = QuoteType.create(payload);
  return QuoteType.encode(message).finish();
}
