const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/** Icon mark only — same gradient + white C as logo-confidance-official.svg / Navbar */
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="url(#g)"/>
  <text x="16" y="23" text-anchor="middle" fill="white"
        font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="18">C</text>
</svg>`;

const iconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Confidance">
  <defs>
    <linearGradient id="confidance-favicon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="url(#confidance-favicon-gradient)"/>
  <text x="16" y="23" text-anchor="middle" fill="white"
        font-family="system-ui, -apple-system, Arial, sans-serif" font-weight="700" font-size="18">C</text>
</svg>`;

function createIco(pngBuffers) {
  const num = pngBuffers.length;
  const headerSize = 6 + num * 16;
  let offset = headerSize;
  const entries = pngBuffers.map(({ size, data }) => {
    const entry = {
      width: size >= 256 ? 0 : size,
      height: size >= 256 ? 0 : size,
      size: data.length,
      offset,
    };
    offset += data.length;
    return entry;
  });
  const buf = Buffer.alloc(offset);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(num, 4);
  let entryOffset = 6;
  for (const e of entries) {
    buf[entryOffset] = e.width;
    buf[entryOffset + 1] = e.height;
    buf[entryOffset + 2] = 0;
    buf[entryOffset + 3] = 0;
    buf.writeUInt16LE(1, entryOffset + 4);
    buf.writeUInt16LE(32, entryOffset + 6);
    buf.writeUInt32LE(e.size, entryOffset + 8);
    buf.writeUInt32LE(e.offset, entryOffset + 12);
    entryOffset += 16;
  }
  let dataOffset = headerSize;
  for (const { data } of pngBuffers) {
    data.copy(buf, dataOffset);
    dataOffset += data.length;
  }
  return buf;
}

async function main() {
  const appDir = path.join(__dirname, '..', 'src', 'app');
  const svgBuf = Buffer.from(svg);

  fs.writeFileSync(path.join(appDir, 'icon.svg'), iconSvg);

  const sizes = [16, 32, 48];
  const pngs = [];
  for (const size of sizes) {
    const data = await sharp(svgBuf, { density: 300 }).resize(size, size).png().toBuffer();
    pngs.push({ size, data });
    console.log(`PNG ${size}x${size}: ${data.length} bytes`);
  }

  const ico = createIco(pngs);
  fs.writeFileSync(path.join(appDir, 'favicon.ico'), ico);
  console.log(`favicon.ico: ${ico.length} bytes`);

  const icon32 = await sharp(svgBuf, { density: 300 }).resize(32, 32).png().toBuffer();
  fs.writeFileSync(path.join(appDir, 'icon.png'), icon32);

  const apple = await sharp(svgBuf, { density: 300 }).resize(180, 180).png().toBuffer();
  fs.writeFileSync(path.join(appDir, 'apple-icon.png'), apple);
  console.log(`apple-icon.png: ${apple.length} bytes`);
  console.log('Done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
