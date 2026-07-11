import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const outputDir = path.resolve(process.env.ICON_OUTPUT_DIR || "extension/icons");
const sizes = [16, 32, 48, 128];

fs.mkdirSync(outputDir, { recursive: true });

for (const size of sizes) {
  const image = renderIcon(size);
  const png = encodePng(image.width, image.height, image.pixels);
  fs.writeFileSync(path.join(outputDir, `icon-${size}.png`), png);
}

console.log(`generated ${sizes.length} icons in ${outputDir}`);

function renderIcon(size) {
  const scale = 4;
  const highSize = size * scale;
  const high = createImage(highSize, highSize);
  const s = highSize / 128;

  drawRoundedRect(high, 4 * s, 4 * s, 120 * s, 120 * s, 22 * s, [14, 18, 58, 255], [24, 18, 78, 255]);
  drawRoundedRect(high, 14 * s, 20 * s, 58 * s, 92 * s, 12 * s, [15, 115, 249, 255], [7, 82, 222, 255]);
  drawPageFold(high, s);

  drawRoundedRect(high, 23 * s, 35 * s, 22 * s, 17 * s, 4 * s, [255, 255, 255, 250], [245, 247, 255, 250]);
  drawLine(high, 23 * s, 62 * s, 54 * s, 62 * s, 5 * s, [255, 255, 255, 245]);
  drawLine(high, 23 * s, 72 * s, 48 * s, 72 * s, 5 * s, [255, 255, 255, 235]);
  drawLine(high, 23 * s, 82 * s, 39 * s, 82 * s, 5 * s, [255, 255, 255, 225]);

  drawLine(high, 55 * s, 84 * s, 55 * s, 102 * s, 7 * s, [255, 255, 255, 250]);
  drawLine(high, 45 * s, 94 * s, 55 * s, 104 * s, 7 * s, [255, 255, 255, 250]);
  drawLine(high, 65 * s, 94 * s, 55 * s, 104 * s, 7 * s, [255, 255, 255, 250]);

  drawCrystal(high, s);

  return downsample(high, size, scale);
}

function createImage(width, height) {
  return {
    width,
    height,
    pixels: new Uint8Array(width * height * 4)
  };
}

function drawPageFold(image, s) {
  fillPolygon(image, [
    [53 * s, 20 * s],
    [72 * s, 39 * s],
    [53 * s, 39 * s]
  ], [157, 193, 255, 255]);
}

function drawCrystal(image, s) {
  fillPolygon(image, [
    [89 * s, 20 * s],
    [114 * s, 49 * s],
    [103 * s, 105 * s],
    [73 * s, 112 * s],
    [64 * s, 55 * s]
  ], [107, 70, 193, 255]);
  fillPolygon(image, [
    [89 * s, 20 * s],
    [94 * s, 58 * s],
    [64 * s, 55 * s]
  ], [197, 177, 255, 255]);
  fillPolygon(image, [
    [89 * s, 20 * s],
    [114 * s, 49 * s],
    [94 * s, 58 * s]
  ], [151, 113, 255, 255]);
  fillPolygon(image, [
    [94 * s, 58 * s],
    [114 * s, 49 * s],
    [103 * s, 105 * s]
  ], [88, 54, 168, 255]);
  fillPolygon(image, [
    [64 * s, 55 * s],
    [94 * s, 58 * s],
    [73 * s, 112 * s]
  ], [126, 83, 221, 255]);
  fillPolygon(image, [
    [94 * s, 58 * s],
    [103 * s, 105 * s],
    [73 * s, 112 * s]
  ], [55, 35, 111, 255]);

  drawLine(image, 89 * s, 21 * s, 94 * s, 58 * s, 2 * s, [255, 255, 255, 100]);
  drawLine(image, 65 * s, 55 * s, 94 * s, 58 * s, 2 * s, [255, 255, 255, 80]);
  drawLine(image, 94 * s, 58 * s, 103 * s, 104 * s, 2 * s, [255, 255, 255, 70]);
}

function drawRoundedRect(image, x, y, width, height, radius, topColor, bottomColor) {
  const minX = Math.floor(x);
  const maxX = Math.ceil(x + width);
  const minY = Math.floor(y);
  const maxY = Math.ceil(y + height);

  for (let py = minY; py < maxY; py += 1) {
    for (let px = minX; px < maxX; px += 1) {
      if (!isInRoundedRect(px + 0.5, py + 0.5, x, y, width, height, radius)) {
        continue;
      }

      const t = clamp((py - y) / height, 0, 1);
      const color = mixColor(topColor, bottomColor, t);
      blendPixel(image, px, py, color);
    }
  }
}

function isInRoundedRect(px, py, x, y, width, height, radius) {
  const cx = clamp(px, x + radius, x + width - radius);
  const cy = clamp(py, y + radius, y + height - radius);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function fillPolygon(image, points, color) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.floor(Math.min(...xs));
  const maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil(Math.max(...ys));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (isPointInPolygon(x + 0.5, y + 0.5, points)) {
        blendPixel(image, x, y, color);
      }
    }
  }
}

function isPointInPolygon(x, y, points) {
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function drawLine(image, x1, y1, x2, y2, width, color) {
  const radius = width / 2;
  const minX = Math.floor(Math.min(x1, x2) - radius);
  const maxX = Math.ceil(Math.max(x1, x2) + radius);
  const minY = Math.floor(Math.min(y1, y2) - radius);
  const maxY = Math.ceil(Math.max(y1, y2) + radius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = distanceToSegment(x + 0.5, y + 0.5, x1, y1, x2, y2);

      if (distance <= radius) {
        blendPixel(image, x, y, color);
      }
    }
  }
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function downsample(image, targetSize, scale) {
  const output = createImage(targetSize, targetSize);

  for (let y = 0; y < targetSize; y += 1) {
    for (let x = 0; x < targetSize; x += 1) {
      const sum = [0, 0, 0, 0];

      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const index = ((y * scale + sy) * image.width + (x * scale + sx)) * 4;
          sum[0] += image.pixels[index];
          sum[1] += image.pixels[index + 1];
          sum[2] += image.pixels[index + 2];
          sum[3] += image.pixels[index + 3];
        }
      }

      const count = scale * scale;
      const outputIndex = (y * targetSize + x) * 4;
      output.pixels[outputIndex] = Math.round(sum[0] / count);
      output.pixels[outputIndex + 1] = Math.round(sum[1] / count);
      output.pixels[outputIndex + 2] = Math.round(sum[2] / count);
      output.pixels[outputIndex + 3] = Math.round(sum[3] / count);
    }
  }

  return output;
}

function blendPixel(image, x, y, color) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
    return;
  }

  const index = (Math.floor(y) * image.width + Math.floor(x)) * 4;
  const alpha = color[3] / 255;
  const existingAlpha = image.pixels[index + 3] / 255;
  const outputAlpha = alpha + existingAlpha * (1 - alpha);

  if (outputAlpha === 0) {
    return;
  }

  image.pixels[index] = Math.round((color[0] * alpha + image.pixels[index] * existingAlpha * (1 - alpha)) / outputAlpha);
  image.pixels[index + 1] = Math.round((color[1] * alpha + image.pixels[index + 1] * existingAlpha * (1 - alpha)) / outputAlpha);
  image.pixels[index + 2] = Math.round((color[2] * alpha + image.pixels[index + 2] * existingAlpha * (1 - alpha)) / outputAlpha);
  image.pixels[index + 3] = Math.round(outputAlpha * 255);
}

function mixColor(start, end, t) {
  return [
    Math.round(start[0] + (end[0] - start[0]) * t),
    Math.round(start[1] + (end[1] - start[1]) * t),
    Math.round(start[2] + (end[2] - start[2]) * t),
    Math.round(start[3] + (end[3] - start[3]) * t)
  ];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function encodePng(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(pixels.subarray(y * width * 4, (y + 1) * width * 4)).copy(raw, rowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", Buffer.concat([
      uint32(width),
      uint32(height),
      Buffer.from([8, 6, 0, 0, 0])
    ])),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  return Buffer.concat([
    uint32(data.length),
    typeBuffer,
    data,
    uint32(crc32(Buffer.concat([typeBuffer, data])))
  ]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
