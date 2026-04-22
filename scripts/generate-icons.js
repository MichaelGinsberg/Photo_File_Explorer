// Generates resources/icon.ico (Windows) and resources/icon.icns (macOS)
// from a single SVG source using sharp's prebuilt Windows/macOS librsvg binaries.
//
// Usage: node scripts/generate-icons.js
//   or:  npm run gen-icons

'use strict';

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Nord-themed camera icon.
// Viewbox 512x512: dark rounded-square bg, camera body, multi-ring lens assembly.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <!-- Background rounded square -->
  <rect width="512" height="512" rx="96" fill="#2E3440"/>

  <!-- Camera body -->
  <rect x="52" y="176" width="408" height="268" rx="32" fill="#3B4252"/>

  <!-- Viewfinder bump (top-center) -->
  <path d="M174,176 L174,132 Q174,112 194,112 L318,112 Q338,112 338,132 L338,176 Z"
        fill="#3B4252"/>

  <!-- Shutter button -->
  <circle cx="406" cy="148" r="26" fill="#4C566A"/>
  <circle cx="406" cy="148" r="14" fill="#88C0D0" opacity="0.7"/>

  <!-- Flash LED -->
  <rect x="88" y="130" width="48" height="28" rx="8" fill="#4C566A"/>
  <rect x="96" y="136" width="32" height="16" rx="4" fill="#EBCB8B" opacity="0.5"/>

  <!-- Lens bezel (outermost ring - shadow) -->
  <circle cx="256" cy="316" r="118" fill="#2E3440"/>

  <!-- Lens housing ring -->
  <circle cx="256" cy="316" r="106" fill="#4C566A"/>

  <!-- Lens glass (blue) -->
  <circle cx="256" cy="316" r="88" fill="#5E81AC"/>

  <!-- Mid lens ring -->
  <circle cx="256" cy="316" r="68" fill="#4C566A"/>

  <!-- Pupil -->
  <circle cx="256" cy="316" r="50" fill="#2E3440"/>

  <!-- Center highlight -->
  <circle cx="256" cy="316" r="24" fill="#88C0D0" opacity="0.85"/>

  <!-- Lens glass shine (top-left, rotated ellipse) -->
  <ellipse cx="214" cy="274" rx="28" ry="16" fill="white" opacity="0.13"
           transform="rotate(-35 214 274)"/>

  <!-- Tick marks ring on lens housing -->
  <circle cx="256" cy="316" r="98" fill="none" stroke="#88C0D0"
          stroke-width="2" stroke-dasharray="5 18" opacity="0.35"/>
</svg>`;

// ── ICO builder ──────────────────────────────────────────────────────────────
// Embeds PNG data directly (supported since Windows Vista / IE 6).
// sizes: array of { size: number, data: Buffer }
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);              // reserved
  header.writeUInt16LE(1, 2);              // type = 1 (icon)
  header.writeUInt16LE(images.length, 4);  // image count

  let offset = 6 + 16 * images.length;
  const entries = [];

  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);  // width  (0 means 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1);  // height (0 means 256)
    e.writeUInt8(0, 2);                        // color count
    e.writeUInt8(0, 3);                        // reserved
    e.writeUInt16LE(1, 4);                     // planes
    e.writeUInt16LE(32, 6);                    // bits per pixel
    e.writeUInt32LE(data.length, 8);           // data size
    e.writeUInt32LE(offset, 12);               // data offset
    entries.push(e);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map(i => i.data)]);
}

// ── ICNS builder ─────────────────────────────────────────────────────────────
// Each chunk: 4-byte OSType + 4-byte BE length (including header) + PNG data.
// Type map: ic07=128, ic08=256, ic09=512, ic10=1024
function buildIcns(chunks) {
  const parts = [];

  for (const [type, data] of Object.entries(chunks)) {
    if (!data) continue;
    const h = Buffer.alloc(8);
    h.write(type, 0, 'ascii');
    h.writeUInt32BE(data.length + 8, 4);
    parts.push(h, data);
  }

  const body = Buffer.concat(parts);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(body.length + 8, 4);

  return Buffer.concat([header, body]);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const outDir = path.resolve(__dirname, '..', 'resources');
  fs.mkdirSync(outDir, { recursive: true });

  const svgBuf = Buffer.from(SVG);

  console.log('Rendering PNG sizes...');
  const pngs = {};
  for (const size of [16, 32, 48, 128, 256, 512, 1024]) {
    process.stdout.write(`  ${size}x${size} ... `);
    pngs[size] = await sharp(svgBuf).resize(size, size).png().toBuffer();
    console.log('ok');
  }

  // icon.ico  (16 / 32 / 48 / 256)
  const icoPath = path.join(outDir, 'icon.ico');
  fs.writeFileSync(icoPath, buildIco([
    { size: 16,  data: pngs[16] },
    { size: 32,  data: pngs[32] },
    { size: 48,  data: pngs[48] },
    { size: 256, data: pngs[256] },
  ]));
  console.log(`Written ${icoPath}`);

  // icon.icns  (128 / 256 / 512 / 1024)
  const icnsPath = path.join(outDir, 'icon.icns');
  fs.writeFileSync(icnsPath, buildIcns({
    ic07: pngs[128],
    ic08: pngs[256],
    ic09: pngs[512],
    ic10: pngs[1024],
  }));
  console.log(`Written ${icnsPath}`);

  // Also save the 1024px source PNG for reference / electron-builder fallback
  const pngPath = path.join(outDir, 'icon.png');
  fs.writeFileSync(pngPath, pngs[1024]);
  console.log(`Written ${pngPath}`);

  console.log('\nAll icons generated successfully.');
}

main().catch(err => {
  console.error('Icon generation failed:', err.message);
  process.exit(1);
});
