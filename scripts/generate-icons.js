// Generates resources/icon.ico (Windows) and resources/icon.icns (macOS)
// from a single SVG source using sharp's prebuilt Windows/macOS librsvg binaries.
//
// Usage: node scripts/generate-icons.js
//   or:  npm run gen-icons

'use strict';

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// App icon — Nord-themed camera with gradient lens.
// Viewbox 1024x1024: blue-gradient rounded square, camera body with viewfinder,
// gradient photo lens, landscape scene highlight, and red notification dot.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5E81AC"/>
      <stop offset="1" stop-color="#3B4252"/>
    </linearGradient>
    <linearGradient id="photo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#EBCB8B"/>
      <stop offset="0.55" stop-color="#D08770"/>
      <stop offset="1" stop-color="#B48EAD"/>
    </linearGradient>
    <radialGradient id="lensGlow" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#ECEFF4" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#ECEFF4" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="lc"><circle cx="512" cy="560" r="160"/></clipPath>
  </defs>

  <rect x="64" y="64" width="896" height="896" rx="210" fill="url(#base)"/>

  <g transform="translate(512 540)">
    <path d="M -330,-180 Q -330,-230 -280,-230 L -170,-230 L -140,-275 L 140,-275 L 170,-230 L 280,-230 Q 330,-230 330,-180 L 330,210 Q 330,260 280,260 L -280,260 Q -330,260 -330,210 Z" fill="#2E3440"/>
    <circle cx="0" cy="20" r="215" fill="#3B4252"/>
    <circle cx="0" cy="20" r="215" fill="none" stroke="#4C566A" stroke-width="8"/>
    <circle cx="0" cy="20" r="160" fill="url(#photo)"/>
    <g clip-path="url(#lc)" transform="translate(-512 -540)">
      <path d="M 352,610 L 442,530 L 512,590 L 582,520 L 672,580 L 672,740 L 352,740 Z" fill="#4C566A" opacity="0.7"/>
      <circle cx="562" cy="510" r="38" fill="#EBCB8B"/>
    </g>
    <circle cx="0" cy="20" r="160" fill="url(#lensGlow)"/>
    <path d="M -90,-55 Q 0,-120 90,-55" fill="none" stroke="#ECEFF4" stroke-width="9" stroke-linecap="round" opacity="0.4"/>
    <circle cx="240" cy="-252" r="16" fill="#BF616A"/>
  </g>

  <rect x="65" y="65" width="894" height="894" rx="209" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="2"/>
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
