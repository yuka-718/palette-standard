import assert from 'node:assert/strict';
import test from 'node:test';

import { correctImageColors, deltaE2000, rgbToLab, simulateCvdColor } from './color-vision.ts';

function imageFromStripes(colors: readonly [number, number, number][], stripeWidth = 48, height = 48) {
  const width = colors.length * stripeWidth;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = colors[Math.floor(x / stripeWidth)];
      const pixel = (y * width + x) * 4;
      data[pixel] = color[0];
      data[pixel + 1] = color[1];
      data[pixel + 2] = color[2];
      data[pixel + 3] = 255;
    }
  }
  return { data, width, height };
}

void test('CIEDE2000 matches a published reference pair', () => {
  const difference = deltaE2000(
    { l: 50, a: 2.6772, b: -79.7751 },
    { l: 50, a: 0, b: -82.7485 },
  );
  assert.ok(Math.abs(difference - 2.0425) < 0.0002);
});

void test('Machado simulation preserves neutral gray in linear sRGB', () => {
  for (const type of ['P', 'D', 'T'] as const) {
    const simulated = simulateCvdColor(128, 128, 128, type);
    assert.ok(Math.abs(simulated.r - 128) < 1);
    assert.ok(Math.abs(simulated.g - 128) < 1);
    assert.ok(Math.abs(simulated.b - 128) < 1);
  }
});

void test('RGB to Lab keeps black and white on the neutral axis', () => {
  const black = rgbToLab({ r: 0, g: 0, b: 0 });
  const white = rgbToLab({ r: 255, g: 255, b: 255 });
  assert.ok(Math.abs(black.l) < 0.001);
  assert.ok(Math.abs(white.l - 100) < 0.01);
  assert.ok(Math.abs(white.a) < 0.01);
  assert.ok(Math.abs(white.b) < 0.01);
});

void test('data-driven correction expands simulated separation for a red-green palette', () => {
  const image = imageFromStripes([
    [220, 70, 55],
    [70, 145, 65],
    [145, 92, 35],
    [20, 95, 125],
  ]);
  const result = correctImageColors(image.data, image.width, image.height, 'D');
  assert.ok(result.metrics.conflictPairsBefore > 0);
  assert.ok(result.metrics.conflictPairsAfter <= result.metrics.conflictPairsBefore);
  assert.ok(result.metrics.averageDeltaEAfter > result.metrics.averageDeltaEBefore);
  assert.ok(result.metrics.averageLuminanceDrift < 0.05);
  assert.notDeepEqual(result.data, image.data);
});

void test('correction is deterministic and preserves alpha for every supported type', () => {
  const image = imageFromStripes([
    [220, 70, 55],
    [70, 145, 65],
    [35, 110, 190],
    [180, 145, 50],
  ]);
  image.data[3] = 77;
  for (const type of ['P', 'D', 'T'] as const) {
    const first = correctImageColors(image.data, image.width, image.height, type);
    const second = correctImageColors(image.data, image.width, image.height, type);
    assert.equal(first.data.length, image.data.length);
    assert.deepEqual(first.data, second.data);
    assert.equal(first.data[3], 77);
    assert.ok(Number.isFinite(first.metrics.averageDeltaEAfter));
  }
});
