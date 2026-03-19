const fs = require('fs');
const zlib = require('zlib');

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function generatePNG(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; ihdrData[9] = 2;

  const ihdrPayload = Buffer.concat([Buffer.from('IHDR'), ihdrData]);
  const ihdrCrc = crc32(ihdrPayload);
  const ihdrLen = Buffer.alloc(4); ihdrLen.writeUInt32BE(13, 0);
  const ihdrCrcBuf = Buffer.alloc(4); ihdrCrcBuf.writeUInt32BE(ihdrCrc, 0);
  const ihdrChunk = Buffer.concat([ihdrLen, ihdrPayload, ihdrCrcBuf]);

  const rawRows = [];
  for (let y = 0; y < size; y++) {
    rawRows.push(0);
    for (let x = 0; x < size; x++) {
      rawRows.push(13, 148, 136);
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(rawRows));

  const idatPayload = Buffer.concat([Buffer.from('IDAT'), compressed]);
  const idatCrc = crc32(idatPayload);
  const idatLen = Buffer.alloc(4); idatLen.writeUInt32BE(compressed.length, 0);
  const idatCrcBuf = Buffer.alloc(4); idatCrcBuf.writeUInt32BE(idatCrc, 0);
  const idatChunk = Buffer.concat([idatLen, idatPayload, idatCrcBuf]);

  const iendPayload = Buffer.from('IEND');
  const iendCrc = crc32(iendPayload);
  const iendLen = Buffer.from([0, 0, 0, 0]);
  const iendCrcBuf = Buffer.alloc(4); iendCrcBuf.writeUInt32BE(iendCrc, 0);
  const iendChunk = Buffer.concat([iendLen, iendPayload, iendCrcBuf]);

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

[16, 48, 128].forEach(size => {
  const png = generatePNG(size);
  fs.writeFileSync(`public/icons/icon-${size}.png`, png);
  console.log(`Generated icon-${size}.png (${png.length} bytes)`);
});
