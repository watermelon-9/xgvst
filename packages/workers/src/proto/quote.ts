import { Reader, Writer } from 'protobufjs/minimal';

export interface QuotePayload {
  symbol: string;
  price: number;
  changePct: number;
  ts: string;
  source?: string;
}

export interface QuoteSnapshotPayload {
  ticker: QuotePayload;
  capturedAtMs: number;
}

export interface SelfSelectItemPayload {
  userId: string;
  symbol: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelfSelectListPayload {
  userId: string;
  items: SelfSelectItemPayload[];
  updatedAt: string;
}

function toUint8Array(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

/**
 * Ticker proto3 encoding:
 * 1 -> symbol (string)
 * 2 -> price (double)
 * 3 -> changePct (double)
 * 4 -> ts (string)
 * 5 -> source (string)
 */
export function encodeQuote(payload: QuotePayload): Uint8Array {
  const writer = Writer.create();

  writer.uint32(10).string(payload.symbol);
  writer.uint32(17).double(payload.price);
  writer.uint32(25).double(payload.changePct);
  writer.uint32(34).string(payload.ts);

  if (payload.source) writer.uint32(42).string(payload.source);

  return writer.finish();
}

export function decodeQuote(input: ArrayBuffer | Uint8Array): QuotePayload {
  const reader = Reader.create(toUint8Array(input));
  const payload: QuotePayload = {
    symbol: '',
    price: 0,
    changePct: 0,
    ts: '',
    source: ''
  };

  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        payload.symbol = reader.string();
        break;
      case 2:
        payload.price = reader.double();
        break;
      case 3:
        payload.changePct = reader.double();
        break;
      case 4:
        payload.ts = reader.string();
        break;
      case 5:
        payload.source = reader.string();
        break;
      default:
        reader.skipType(tag & 7);
    }
  }

  return payload;
}

/**
 * QuoteSnapshot proto3 encoding:
 * 1 -> ticker (message<Ticker>)
 * 2 -> capturedAtMs (uint64)
 */
export function encodeQuoteSnapshot(payload: QuoteSnapshotPayload): Uint8Array {
  const writer = Writer.create();

  const ticker = encodeQuote(payload.ticker);
  writer.uint32(10).bytes(ticker);
  writer.uint32(16).uint64(payload.capturedAtMs);

  return writer.finish();
}

export function decodeQuoteSnapshot(input: ArrayBuffer | Uint8Array): QuoteSnapshotPayload {
  const reader = Reader.create(toUint8Array(input));
  const payload: QuoteSnapshotPayload = {
    ticker: {
      symbol: '',
      price: 0,
      changePct: 0,
      ts: '',
      source: ''
    },
    capturedAtMs: 0
  };

  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1: {
        const bytes = reader.bytes();
        payload.ticker = decodeQuote(bytes);
        break;
      }
      case 2:
        payload.capturedAtMs = Number(reader.uint64());
        break;
      default:
        reader.skipType(tag & 7);
    }
  }

  return payload;
}

/**
 * SelfSelectList proto3 encoding:
 * 1 -> userId (string)
 * 2 -> items (repeated message<SelfSelectItem>)
 * 3 -> updatedAt (string)
 */
export function encodeSelfSelectList(payload: SelfSelectListPayload): Uint8Array {
  const writer = Writer.create();

  writer.uint32(10).string(payload.userId);

  for (const item of payload.items) {
    writer.uint32(18).fork();
    writer.uint32(10).string(item.userId);
    writer.uint32(18).string(item.symbol);
    writer.uint32(26).string(item.createdAt);
    writer.uint32(34).string(item.updatedAt);
    writer.ldelim();
  }

  writer.uint32(26).string(payload.updatedAt);

  return writer.finish();
}

export function decodeSelfSelectList(input: ArrayBuffer | Uint8Array): SelfSelectListPayload {
  const reader = Reader.create(toUint8Array(input));
  const payload: SelfSelectListPayload = {
    userId: '',
    items: [],
    updatedAt: ''
  };

  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        payload.userId = reader.string();
        break;
      case 2: {
        const end = reader.uint32() + reader.pos;
        const item: SelfSelectItemPayload = {
          userId: '',
          symbol: '',
          createdAt: '',
          updatedAt: ''
        };

        while (reader.pos < end) {
          const itemTag = reader.uint32();
          switch (itemTag >>> 3) {
            case 1:
              item.userId = reader.string();
              break;
            case 2:
              item.symbol = reader.string();
              break;
            case 3:
              item.createdAt = reader.string();
              break;
            case 4:
              item.updatedAt = reader.string();
              break;
            default:
              reader.skipType(itemTag & 7);
          }
        }

        payload.items.push(item);
        break;
      }
      case 3:
        payload.updatedAt = reader.string();
        break;
      default:
        reader.skipType(tag & 7);
    }
  }

  return payload;
}
