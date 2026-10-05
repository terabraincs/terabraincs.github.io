import fs from "node:fs";

const OGG_HEADER_BYTES = 27;
const MAX_OGG_PAGE_BYTES = OGG_HEADER_BYTES + 255 + 255 * 255;
const OGG_CAPTURE = Buffer.from("OggS");
const OPUS_HEADER = Buffer.from("OpusHead");
const OPUS_SAMPLE_RATE = 48000;
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value << 24;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = ((crc << 1) ^ (crc & 0x80000000 ? 0x04c11db7 : 0)) >>> 0;
  }
  return crc;
});

function getPageEnd(data: Buffer, offset: number) {
  if (
    offset < 0 ||
    offset + OGG_HEADER_BYTES > data.length ||
    !data.subarray(offset, offset + 4).equals(OGG_CAPTURE) ||
    data[offset + 4] !== 0
  ) {
    return null;
  }

  const segmentCount = data[offset + 26];
  let end = offset + OGG_HEADER_BYTES + segmentCount;
  if (end > data.length) return null;
  for (let segment = 0; segment < segmentCount; segment += 1) {
    end += data[offset + OGG_HEADER_BYTES + segment];
  }
  return end <= data.length ? end : null;
}

function hasValidChecksum(data: Buffer, start: number, end: number) {
  let crc = 0;
  for (let offset = start; offset < end; offset += 1) {
    const byte = offset >= start + 22 && offset < start + 26 ? 0 : data[offset];
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ byte) & 255]) >>> 0;
  }
  return crc === data.readUInt32LE(start + 22);
}

// The web transcode produces one complete Ogg Opus stream per file.
// RFC 7845 sections 4.2-4.4: subtract pre-skip from the final granule position,
// then divide by 48 kHz, regardless of the source WAV's sample rate.
export function readOggOpusDuration(filePath: string | null): number {
  if (!filePath) return 0;

  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(/* turbopackIgnore: true */ filePath, "r");
    const fileSize = fs.fstatSync(descriptor).size;
    const windowBytes = Math.min(fileSize, MAX_OGG_PAGE_BYTES);
    const first = Buffer.alloc(windowBytes);
    if (fs.readSync(descriptor, first, 0, windowBytes, 0) !== windowBytes) return 0;
    const firstPageEnd = getPageEnd(first, 0);
    if (
      firstPageEnd === null ||
      first[5] !== 2 ||
      first.readUInt32LE(18) !== 0 ||
      !hasValidChecksum(first, 0, firstPageEnd)
    ) {
      return 0;
    }

    const segments = first[26];
    const packetStart = OGG_HEADER_BYTES + segments;
    // The identification header must complete alone on the first page.
    if (!segments || first[packetStart - 1] === 255) return 0;
    for (let segment = 0; segment < segments - 1; segment += 1) {
      if (first[OGG_HEADER_BYTES + segment] !== 255) return 0;
    }
    if (
      firstPageEnd - packetStart < 19 ||
      !first.subarray(packetStart, packetStart + 8).equals(OPUS_HEADER) ||
      first[packetStart + 8] === 0 ||
      first[packetStart + 8] > 15 ||
      first[packetStart + 9] === 0
    ) {
      return 0;
    }
    const preSkip = first.readUInt16LE(packetStart + 10);
    const serial = first.readUInt32LE(14);

    const tail = Buffer.alloc(windowBytes);
    if (
      fs.readSync(descriptor, tail, 0, windowBytes, fileSize - windowBytes) !==
      windowBytes
    ) {
      return 0;
    }
    // Read at most one maximum-sized page from each end, rather than loading
    // every song in full. Validate the final page so payload "OggS" bytes and
    // incomplete uploads cannot be mistaken for duration metadata.
    let offset = tail.lastIndexOf(OGG_CAPTURE);
    while (offset >= 0) {
      const end = getPageEnd(tail, offset);
      if (
        end === tail.length &&
        (tail[offset + 5] & 4) !== 0 &&
        (tail[offset + 5] & 2) === 0 &&
        tail[offset + 26] > 0 &&
        tail[offset + 26 + tail[offset + 26]] < 255 &&
        tail.readUInt32LE(offset + 14) === serial &&
        hasValidChecksum(tail, offset, end)
      ) {
        const samples = tail.readBigInt64LE(offset + 6) - BigInt(preSkip);
        if (samples < BigInt(0) || samples > BigInt(Number.MAX_SAFE_INTEGER)) return 0;
        return Number(samples) / OPUS_SAMPLE_RATE;
      }
      if (offset === 0) break;
      offset = tail.lastIndexOf(OGG_CAPTURE, offset - 1);
    }
  } catch {
    return 0;
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
  return 0;
}
