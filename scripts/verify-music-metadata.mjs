// UTF-8. Exercise the real jukebox loader using only deployable Ogg files.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(app);
process.env.NODE_ENV = "production";
delete process.env.NEXT_PUBLIC_BGM_BASE_URL;
delete process.env.NEXT_PUBLIC_ASSET_BASE_URL;
const cache = new Map();
let wavAccesses = 0;
const guardedFs = new Proxy(fs, {
  get(target, key) {
    const original = Reflect.get(target, key);
    if (!["existsSync", "statSync", "openSync", "readFileSync"].includes(key)) return original;
    return (...args) => {
      if (typeof args[0] === "string" && /\.wav$/i.test(args[0])) {
        wavAccesses += 1;
        throw new Error(`Jukebox attempted to access a source WAV: ${args[0]}`);
      }
      return original(...args);
    };
  },
});
function loadTypeScript(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} };
  cache.set(file, loaded);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const localRequire = (specifier) => {
    if (specifier === "node:fs") return guardedFs;
    return specifier.startsWith("@/")
      ? loadTypeScript(path.join(app, `${specifier.slice(2)}.ts`))
      : specifier.startsWith('.')
        ? loadTypeScript(path.resolve(path.dirname(file), specifier + '.ts'))
        : require(specifier);
  };
  new Function("require", "module", "exports", source)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}
const { readOggOpusDuration } = loadTypeScript(path.join(app, "lib/oggOpusDuration.ts"));
const { loadMusicTracks, getMusicFilePath } = loadTypeScript(path.join(app, "scripts/music-source.ts"));
const temporaryParent = path.join(app, ".tmp");
fs.mkdirSync(temporaryParent, { recursive: true });
const temporary = fs.mkdtempSync(path.join(temporaryParent, "music-metadata-"));

// Independent bit-at-a-time Ogg CRC reference for synthetic container fixtures.
function checksum(page) {
  let crc = 0;
  for (const byte of page) {
    crc ^= byte << 24;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = ((crc << 1) ^ (crc & 0x80000000 ? 0x04c11db7 : 0)) >>> 0;
    }
  }
  return crc;
}
function page(body, { flags = 0, serial = 123, sequence = 0, granule = 0 } = {}) {
  const segments = [...Array(Math.floor(body.length / 255)).fill(255), body.length % 255];
  assert(segments.length <= 255);
  const result = Buffer.alloc(27 + segments.length + body.length);
  result.write("OggS");
  result[5] = flags;
  result.writeBigInt64LE(BigInt(granule), 6);
  result.writeUInt32LE(serial, 14);
  result.writeUInt32LE(sequence, 18);
  result[26] = segments.length;
  result.set(segments, 27);
  result.set(body, 27 + segments.length);
  result.writeUInt32LE(checksum(result), 22);
  return result;
}
function opus({ channels = 2, inputRate = 44100, preSkip = 312, finalGranule = 480312,
  finalFlags = 4, finalSerial = 123, finalBody = Buffer.from([0xf8, 0xff, 0xfe]), codec = "OpusHead" } = {}) {
  const header = Buffer.alloc(19);
  header.write(codec);
  header[8] = 1;
  header[9] = channels;
  header.writeUInt16LE(preSkip, 10);
  header.writeUInt32LE(inputRate, 12);
  return Buffer.concat([
    page(header, { flags: 2 }),
    page(Buffer.from("OpusTags\0\0\0\0\0\0\0\0"), { sequence: 1 }),
    page(finalBody, { flags: finalFlags, serial: finalSerial, sequence: 2, granule: finalGranule }),
  ]);
}
let fixtureCount = 0;
function check(name, data, expected) {
  const file = path.join(temporary, `${name}.ogg`);
  fs.writeFileSync(file, data);
  assert.equal(readOggOpusDuration(file), expected, name);
  fixtureCount += 1;
}

try {
  check("stereo-44100-preskip", opus(), 10);
  check("mono-48000-preskip", opus({ channels: 1, inputRate: 48000 }), 10);
  check("unspecified-input-rate", opus({ inputRate: 0 }), 10);
  check("large-preskip", opus({ preSkip: 65535, finalGranule: 65535 + 480000 }), 10);
  check("end-trimming", opus({ finalGranule: 480312 - 120 }), 9.9975);
  const largeBody = Buffer.alloc(65024, 7);
  largeBody.write("OggS", 64000); // A payload marker must not be taken as a page.
  check("maximum-final-page", opus({ finalBody: largeBody }), 10);
  check("truncated-body", opus().subarray(0, -1), 0);
  check("truncated-header", Buffer.from("OggS"), 0);
  check("foreign-stream-serial", opus({ finalSerial: 456 }), 0);
  check("missing-end-of-stream", opus({ finalFlags: 0 }), 0);
  check("invalid-granule", opus({ finalGranule: -1 }), 0);
  check("granule-before-preskip", opus({ finalGranule: 311 }), 0);
  check("unsupported-codec", opus({ codec: "NotOpus!" }), 0);
  check("trailing-garbage", Buffer.concat([opus(), Buffer.from("bad")]), 0);
  const corrupt = opus();
  corrupt[corrupt.length - 1] ^= 1;
  check("damaged-page-checksum", corrupt, 0);
  assert.equal(readOggOpusDuration(null), 0);
  assert.equal(readOggOpusDuration(path.join(temporary, "missing.ogg")), 0);

  const originalTracks = loadMusicTracks();
  assert(originalTracks.length > 0);
  const originalFiles = new Map();
  for (const track of originalTracks) {
    assert(!track.isLocked && track.audioPath.endsWith(".ogg"), track.id);
    assert(Number.isFinite(track.duration) && track.duration > 0, track.id);
    const filename = decodeURIComponent(path.posix.basename(track.audioPath));
    originalFiles.set(filename, getMusicFilePath(filename));
  }
  const isolatedRoot = path.join(temporary, "converted-only");
  const musicRoot = path.join(isolatedRoot, "sound/music");
  const jsonRoot = path.join(isolatedRoot, "json/sound");
  fs.mkdirSync(musicRoot, { recursive: true });
  fs.mkdirSync(jsonRoot, { recursive: true });
  for (const [filename, source] of originalFiles) {
    assert(source, filename);
    // Read-only hard links keep the real audio bytes without copying 1.2 GB.
    fs.linkSync(source, path.join(musicRoot, filename));
  }
  for (const filename of ["124_LUA_BGM_INFO_TEMPLETE_h.json", "063_LUA_SI_BGM_INFO_TEMPLET_KOREA_y.json"]) {
    fs.copyFileSync(path.join(app, "json/sound", filename), path.join(jsonRoot, filename));
  }
  assert(fs.readdirSync(musicRoot).every(name => name.endsWith(".ogg")));
  process.env.COUNTERSIDE_ASSET_ROOT = path.join(isolatedRoot, "no-source-assets");
  process.env.COUNTERSIDE_BGM_DIR = musicRoot;
  process.chdir(isolatedRoot);
  const convertedOnlyTracks = loadMusicTracks();
  assert.deepEqual(convertedOnlyTracks, originalTracks,
    "WAV-free loading changed durations, titles, albums, volume, or track grouping");
  assert.equal(wavAccesses, 0);
  process.chdir(app);

  let decodedChecks = 0;
  const ffmpegOption = process.argv.indexOf("--ffmpeg");
  if (ffmpegOption >= 0) {
    const ffmpeg = process.argv[ffmpegOption + 1];
    assert(ffmpeg && fs.existsSync(ffmpeg), "Pass an existing ffmpeg binary");
    const samples = new Map();
    for (const registered of [true, false]) {
      const track = originalTracks.filter(track => track.isRegistered === registered)
        .sort((a, b) => a.duration - b.duration)[0];
      samples.set(track.id, track);
    }
    const longer = originalTracks.filter(track => track.duration < 30)
      .sort((a, b) => b.duration - a.duration)[0];
    if (longer) samples.set(longer.id, longer);
    for (const track of samples.values()) {
      const filename = decodeURIComponent(path.posix.basename(track.audioPath));
      const result = spawnSync(ffmpeg, ["-v", "error", "-nostdin", "-i", originalFiles.get(filename),
        "-map", "0:a:0", "-ar", "48000", "-ac", "1", "-f", "s16le", "pipe:1"],
      { maxBuffer: 64 * 1024 * 1024 });
      assert.equal(result.status, 0, result.error?.message ?? result.stderr?.toString());
      assert.equal(result.stdout.length / 2 / 48000, track.duration, track.id);
      decodedChecks += 1;
    }
  }
  console.log(JSON.stringify({ fixtures: fixtureCount, tracksWithoutWav: convertedOnlyTracks.length,
    registered: convertedOnlyTracks.filter(track => track.isRegistered).length,
    unregistered: convertedOnlyTracks.filter(track => !track.isRegistered).length,
    wavAccesses, independentDecodedChecks: decodedChecks }, null, 2));
} finally {
  process.chdir(app);
  // Verify the resolved deletion target is the newly created test directory.
  const relative = path.relative(temporaryParent, path.resolve(temporary));
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  fs.rmSync(temporary, { recursive: true, force: true });
}
