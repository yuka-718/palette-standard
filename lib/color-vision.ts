export type CorrectableVisionType = 'P' | 'D' | 'T';

export type RgbColor = { r: number; g: number; b: number };
type LabColor = { l: number; a: number; b: number };

export type CorrectionMetrics = {
  conflictPairsBefore: number;
  conflictPairsAfter: number;
  averageDeltaEBefore: number;
  averageDeltaEAfter: number;
  averageLuminanceDrift: number;
  remappedClusters: number;
  sampledPixels: number;
};

export type CorrectionResult = {
  data: Uint8ClampedArray;
  metrics: CorrectionMetrics;
};

type ColorCluster = {
  lab: LabColor;
  rgb: RgbColor;
  simulatedLab: LabColor;
  count: number;
};

type CandidateColor = {
  lab: LabColor;
  rgb: RgbColor;
  simulatedLab: LabColor;
  source: string;
};

type ConflictPair = {
  first: number;
  second: number;
  before: number;
  severity: number;
};

// Machado, Oliveira & Fernandes (2009), full-severity matrices.
// The published model expects linearly encoded sRGB values.
const MACHADO_MATRICES: Record<CorrectableVisionType, readonly number[]> = {
  P: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  D: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  T: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

// CUD recommended color set ver.4, screen/sRGB chromatic colors.
// Achromatic colors are intentionally excluded from recoloring candidates.
export const CUD_SCREEN_PALETTE = [
  { name: '赤', hex: '#FF4B00' },
  { name: '黄', hex: '#FFF100' },
  { name: '緑', hex: '#03AF7A' },
  { name: '青', hex: '#005AFF' },
  { name: '空色', hex: '#4DC4FF' },
  { name: 'ピンク', hex: '#FF8082' },
  { name: 'オレンジ', hex: '#F6AA00' },
  { name: '紫', hex: '#990099' },
  { name: '茶', hex: '#804000' },
  { name: '明るいピンク', hex: '#FFCABF' },
  { name: 'クリーム', hex: '#FFFF80' },
  { name: '明るい黄緑', hex: '#D8F255' },
  { name: '明るい空色', hex: '#BFE4FF' },
  { name: 'ベージュ', hex: '#FFCA80' },
  { name: '明るい緑', hex: '#77D9A8' },
  { name: '明るい紫', hex: '#C9ACE6' },
] as const;

const D65 = { x: 0.95047, y: 1, z: 1.08883 };
const COLOR_DIFFERENCE_TARGET = 12;
const MIN_ORIGINAL_DIFFERENCE = 10;
const MAX_CONFUSED_DIFFERENCE = 10;

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function srgbChannelToLinear(value: number) {
  const encoded = clamp(value / 255);
  return encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(value: number) {
  const linear = clamp(value);
  const encoded = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  return clamp(encoded, 0, 1) * 255;
}

function hexToRgb(hex: string): RgbColor {
  const value = hex.replace('#', '');
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function multiplyMatrix(rgb: readonly number[], matrix: readonly number[]) {
  return [
    matrix[0] * rgb[0] + matrix[1] * rgb[1] + matrix[2] * rgb[2],
    matrix[3] * rgb[0] + matrix[4] * rgb[1] + matrix[5] * rgb[2],
    matrix[6] * rgb[0] + matrix[7] * rgb[1] + matrix[8] * rgb[2],
  ] as const;
}

export function simulateCvdColor(r: number, g: number, b: number, type: CorrectableVisionType): RgbColor {
  const linear = [srgbChannelToLinear(r), srgbChannelToLinear(g), srgbChannelToLinear(b)] as const;
  const simulated = multiplyMatrix(linear, MACHADO_MATRICES[type]);
  return {
    r: linearChannelToSrgb(simulated[0]),
    g: linearChannelToSrgb(simulated[1]),
    b: linearChannelToSrgb(simulated[2]),
  };
}

function labPivot(value: number) {
  const delta = 6 / 29;
  return value > delta ** 3 ? Math.cbrt(value) : value / (3 * delta ** 2) + 4 / 29;
}

function inverseLabPivot(value: number) {
  const delta = 6 / 29;
  return value > delta ? value ** 3 : 3 * delta ** 2 * (value - 4 / 29);
}

export function rgbToLab(color: RgbColor): LabColor {
  const red = srgbChannelToLinear(color.r);
  const green = srgbChannelToLinear(color.g);
  const blue = srgbChannelToLinear(color.b);
  const x = (0.4124564 * red + 0.3575761 * green + 0.1804375 * blue) / D65.x;
  const y = (0.2126729 * red + 0.7151522 * green + 0.072175 * blue) / D65.y;
  const z = (0.0193339 * red + 0.119192 * green + 0.9503041 * blue) / D65.z;
  const fx = labPivot(x);
  const fy = labPivot(y);
  const fz = labPivot(z);
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function labToLinearRgb(color: LabColor) {
  const fy = (color.l + 16) / 116;
  const fx = fy + color.a / 500;
  const fz = fy - color.b / 200;
  const x = D65.x * inverseLabPivot(fx);
  const y = D65.y * inverseLabPivot(fy);
  const z = D65.z * inverseLabPivot(fz);
  return {
    r: 3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    g: -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    b: 0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  };
}

function isInGamut(color: { r: number; g: number; b: number }) {
  return color.r >= 0 && color.r <= 1 && color.g >= 0 && color.g <= 1 && color.b >= 0 && color.b <= 1;
}

function labToRgb(color: LabColor): RgbColor {
  let mapped = color;
  let linear = labToLinearRgb(mapped);
  if (!isInGamut(linear)) {
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const scale = (low + high) / 2;
      const attempt = { l: color.l, a: color.a * scale, b: color.b * scale };
      const attemptLinear = labToLinearRgb(attempt);
      if (isInGamut(attemptLinear)) {
        low = scale;
        mapped = attempt;
        linear = attemptLinear;
      } else {
        high = scale;
      }
    }
  }
  return {
    r: linearChannelToSrgb(linear.r),
    g: linearChannelToSrgb(linear.g),
    b: linearChannelToSrgb(linear.b),
  };
}

function degrees(value: number) {
  return (value * 180) / Math.PI;
}

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function hueAngle(a: number, b: number) {
  const angle = degrees(Math.atan2(b, a));
  return angle >= 0 ? angle : angle + 360;
}

// CIEDE2000 (kL = kC = kH = 1), used only for cluster-level comparisons.
export function deltaE2000(first: LabColor, second: LabColor) {
  const c1 = Math.hypot(first.a, first.b);
  const c2 = Math.hypot(second.a, second.b);
  const averageC = (c1 + c2) / 2;
  const averageC7 = averageC ** 7;
  const g = 0.5 * (1 - Math.sqrt(averageC7 / (averageC7 + 25 ** 7)));
  const a1 = (1 + g) * first.a;
  const a2 = (1 + g) * second.a;
  const adjustedC1 = Math.hypot(a1, first.b);
  const adjustedC2 = Math.hypot(a2, second.b);
  const h1 = hueAngle(a1, first.b);
  const h2 = hueAngle(a2, second.b);
  const deltaL = second.l - first.l;
  const deltaC = adjustedC2 - adjustedC1;
  let deltaHAngle = h2 - h1;
  if (adjustedC1 * adjustedC2 === 0) deltaHAngle = 0;
  else if (deltaHAngle > 180) deltaHAngle -= 360;
  else if (deltaHAngle < -180) deltaHAngle += 360;
  const deltaH = 2 * Math.sqrt(adjustedC1 * adjustedC2) * Math.sin(radians(deltaHAngle / 2));
  const averageL = (first.l + second.l) / 2;
  const averageAdjustedC = (adjustedC1 + adjustedC2) / 2;
  let averageH = h1 + h2;
  if (adjustedC1 * adjustedC2 === 0) averageH = h1 + h2;
  else if (Math.abs(h1 - h2) <= 180) averageH /= 2;
  else if (h1 + h2 < 360) averageH = (h1 + h2 + 360) / 2;
  else averageH = (h1 + h2 - 360) / 2;
  const t =
    1 -
    0.17 * Math.cos(radians(averageH - 30)) +
    0.24 * Math.cos(radians(2 * averageH)) +
    0.32 * Math.cos(radians(3 * averageH + 6)) -
    0.2 * Math.cos(radians(4 * averageH - 63));
  const deltaTheta = 30 * Math.exp(-(((averageH - 275) / 25) ** 2));
  const averageC7Adjusted = averageAdjustedC ** 7;
  const rc = 2 * Math.sqrt(averageC7Adjusted / (averageC7Adjusted + 25 ** 7));
  const sl = 1 + (0.015 * (averageL - 50) ** 2) / Math.sqrt(20 + (averageL - 50) ** 2);
  const sc = 1 + 0.045 * averageAdjustedC;
  const sh = 1 + 0.015 * averageAdjustedC * t;
  const rt = -Math.sin(radians(2 * deltaTheta)) * rc;
  const lTerm = deltaL / sl;
  const cTerm = deltaC / sc;
  const hTerm = deltaH / sh;
  return Math.sqrt(lTerm ** 2 + cTerm ** 2 + hTerm ** 2 + rt * cTerm * hTerm);
}

export function relativeLuminance(color: RgbColor) {
  return (
    0.2126 * srgbChannelToLinear(color.r) +
    0.7152 * srgbChannelToLinear(color.g) +
    0.0722 * srgbChannelToLinear(color.b)
  );
}

function squaredLabDistance(first: LabColor, second: LabColor) {
  return (first.l - second.l) ** 2 + (first.a - second.a) ** 2 + (first.b - second.b) ** 2;
}

function sampleImage(data: Uint8ClampedArray, width: number, height: number) {
  const targetSamples = 12000;
  const gridStep = Math.max(1, Math.floor(Math.sqrt((width * height) / targetSamples)));
  const samples: LabColor[] = [];
  for (let y = 0; y < height; y += gridStep) {
    for (let x = 0; x < width; x += gridStep) {
      const pixel = (y * width + x) * 4;
      if (data[pixel + 3] < 128) continue;
      samples.push(rgbToLab({ r: data[pixel], g: data[pixel + 1], b: data[pixel + 2] }));
    }
  }
  return samples;
}

function meanLab(samples: readonly LabColor[]) {
  const total = samples.reduce(
    (sum, color) => ({ l: sum.l + color.l, a: sum.a + color.a, b: sum.b + color.b }),
    { l: 0, a: 0, b: 0 },
  );
  return { l: total.l / samples.length, a: total.a / samples.length, b: total.b / samples.length };
}

function buildClusters(data: Uint8ClampedArray, width: number, height: number, type: CorrectableVisionType) {
  const samples = sampleImage(data, width, height);
  if (!samples.length) return { clusters: [] as ColorCluster[], sampledPixels: 0 };
  const clusterCount = Math.min(10, Math.max(4, Math.round(4 + Math.log2(samples.length) / 3)));
  const centerMean = meanLab(samples);
  let first = samples[0];
  let firstDistance = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const distance = squaredLabDistance(sample, centerMean);
    if (distance < firstDistance) {
      first = sample;
      firstDistance = distance;
    }
  }
  const centers: LabColor[] = [{ ...first }];
  while (centers.length < clusterCount) {
    let farthest = samples[0];
    let farthestDistance = -1;
    for (const sample of samples) {
      const distance = Math.min(...centers.map((center) => squaredLabDistance(sample, center)));
      if (distance > farthestDistance) {
        farthest = sample;
        farthestDistance = distance;
      }
    }
    centers.push({ ...farthest });
  }

  let counts = Array.from({ length: clusterCount }, () => 0);
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const totals = Array.from({ length: clusterCount }, () => ({ l: 0, a: 0, b: 0 }));
    counts = Array.from({ length: clusterCount }, () => 0);
    for (const sample of samples) {
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < centers.length; index += 1) {
        const distance = squaredLabDistance(sample, centers[index]);
        if (distance < nearestDistance) {
          nearest = index;
          nearestDistance = distance;
        }
      }
      totals[nearest].l += sample.l;
      totals[nearest].a += sample.a;
      totals[nearest].b += sample.b;
      counts[nearest] += 1;
    }
    for (let index = 0; index < centers.length; index += 1) {
      if (!counts[index]) continue;
      centers[index] = {
        l: totals[index].l / counts[index],
        a: totals[index].a / counts[index],
        b: totals[index].b / counts[index],
      };
    }
  }

  const clusters = centers
    .map((lab, index) => {
      const rgb = labToRgb(lab);
      return { lab: rgbToLab(rgb), rgb, simulatedLab: rgbToLab(simulateCvdColor(rgb.r, rgb.g, rgb.b, type)), count: counts[index] };
    })
    .filter((cluster) => cluster.count > 0)
    .sort((firstCluster, secondCluster) => secondCluster.count - firstCluster.count);
  return { clusters, sampledPixels: samples.length };
}

function findConflicts(clusters: readonly ColorCluster[]) {
  const conflicts: ConflictPair[] = [];
  for (let first = 0; first < clusters.length; first += 1) {
    for (let second = first + 1; second < clusters.length; second += 1) {
      const normalDistance = deltaE2000(clusters[first].lab, clusters[second].lab);
      if (normalDistance < MIN_ORIGINAL_DIFFERENCE) continue;
      const simulatedDistance = deltaE2000(clusters[first].simulatedLab, clusters[second].simulatedLab);
      const retainedRatio = simulatedDistance / Math.max(normalDistance, 1);
      if (simulatedDistance >= MAX_CONFUSED_DIFFERENCE || retainedRatio >= 0.72) continue;
      const loss = clamp(1 - retainedRatio);
      const closeness = clamp((MAX_CONFUSED_DIFFERENCE - simulatedDistance) / MAX_CONFUSED_DIFFERENCE);
      conflicts.push({ first, second, before: simulatedDistance, severity: 0.35 + 0.65 * loss * closeness });
    }
  }
  return conflicts;
}

function buildCandidate(cluster: ColorCluster, type: CorrectableVisionType, source: string, base?: RgbColor): CandidateColor {
  if (!base) return { lab: cluster.lab, rgb: cluster.rgb, simulatedLab: cluster.simulatedLab, source };
  const baseLab = rgbToLab(base);
  const rgb = labToRgb({ l: cluster.lab.l, a: baseLab.a, b: baseLab.b });
  const lab = rgbToLab(rgb);
  return { lab, rgb, simulatedLab: rgbToLab(simulateCvdColor(rgb.r, rgb.g, rgb.b, type)), source };
}

function optimizeMappings(clusters: readonly ColorCluster[], conflicts: readonly ConflictPair[], type: CorrectableVisionType) {
  const mappings = clusters.map((cluster) => buildCandidate(cluster, type, 'original'));
  const conflictLoad = clusters.map(() => 0);
  for (const conflict of conflicts) {
    conflictLoad[conflict.first] += conflict.severity;
    conflictLoad[conflict.second] += conflict.severity;
  }
  const order = clusters
    .map((cluster, index) => ({ index, importance: conflictLoad[index] * Math.sqrt(cluster.count) }))
    .filter((item) => item.importance > 0)
    .sort((first, second) => second.importance - first.importance)
    .map((item) => item.index);
  const candidateSets = clusters.map((cluster) => [
    buildCandidate(cluster, type, 'original'),
    ...CUD_SCREEN_PALETTE.map((entry) => buildCandidate(cluster, type, entry.name, hexToRgb(entry.hex))),
  ]);

  for (let pass = 0; pass < 3; pass += 1) {
    for (const index of order) {
      const cluster = clusters[index];
      const neutral = Math.hypot(cluster.lab.a, cluster.lab.b) < 7;
      let best = mappings[index];
      let bestScore = Number.POSITIVE_INFINITY;
      for (const candidate of candidateSets[index]) {
        const naturalness = deltaE2000(cluster.lab, candidate.lab);
        let score = naturalness * 0.72;
        if (neutral && candidate.source !== 'original') score += 140;
        for (const conflict of conflicts) {
          let other = -1;
          if (conflict.first === index) other = conflict.second;
          else if (conflict.second === index) other = conflict.first;
          if (other < 0) continue;
          const visibleDistance = deltaE2000(candidate.simulatedLab, mappings[other].simulatedLab);
          const shortfall = Math.max(0, COLOR_DIFFERENCE_TARGET - visibleDistance);
          score += conflict.severity * shortfall ** 2 * 2.25;
        }
        if (candidate.source !== 'original' && mappings.some((mapping, mappingIndex) => mappingIndex !== index && mapping.source === candidate.source)) {
          score += 4;
        }
        if (score < bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
      mappings[index] = best;
    }
  }
  return mappings;
}

function nearestCluster(lab: LabColor, clusters: readonly ColorCluster[]) {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < clusters.length; index += 1) {
    const distance = squaredLabDistance(lab, clusters[index].lab);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function correctedMetrics(
  clusters: readonly ColorCluster[],
  mappings: readonly CandidateColor[],
  conflicts: readonly ConflictPair[],
  sampledPixels: number,
): CorrectionMetrics {
  if (!conflicts.length) {
    return {
      conflictPairsBefore: 0,
      conflictPairsAfter: 0,
      averageDeltaEBefore: 0,
      averageDeltaEAfter: 0,
      averageLuminanceDrift: 0,
      remappedClusters: 0,
      sampledPixels,
    };
  }
  const afterDistances = conflicts.map((conflict) =>
    deltaE2000(mappings[conflict.first].simulatedLab, mappings[conflict.second].simulatedLab),
  );
  const remapped = mappings.filter((mapping, index) => deltaE2000(mapping.lab, clusters[index].lab) >= 2);
  const affected = mappings
    .map((mapping, index) => ({ mapping, cluster: clusters[index] }))
    .filter(({ mapping, cluster }) => deltaE2000(mapping.lab, cluster.lab) >= 2);
  const luminanceDrift = affected.length
    ? affected.reduce(
        (sum, { mapping, cluster }) => sum + Math.abs(relativeLuminance(mapping.rgb) - relativeLuminance(cluster.rgb)),
        0,
      ) / affected.length
    : 0;
  return {
    conflictPairsBefore: conflicts.length,
    conflictPairsAfter: afterDistances.filter((distance) => distance < MAX_CONFUSED_DIFFERENCE).length,
    averageDeltaEBefore: conflicts.reduce((sum, conflict) => sum + conflict.before, 0) / conflicts.length,
    averageDeltaEAfter: afterDistances.reduce((sum, distance) => sum + distance, 0) / afterDistances.length,
    averageLuminanceDrift: luminanceDrift,
    remappedClusters: remapped.length,
    sampledPixels,
  };
}

export function correctImageColors(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  type: CorrectableVisionType,
): CorrectionResult {
  const data = new Uint8ClampedArray(source);
  const { clusters, sampledPixels } = buildClusters(source, width, height, type);
  if (clusters.length < 2) {
    return {
      data,
      metrics: {
        conflictPairsBefore: 0,
        conflictPairsAfter: 0,
        averageDeltaEBefore: 0,
        averageDeltaEAfter: 0,
        averageLuminanceDrift: 0,
        remappedClusters: 0,
        sampledPixels,
      },
    };
  }
  const conflicts = findConflicts(clusters);
  const mappings = optimizeMappings(clusters, conflicts, type);
  const shifts = mappings.map((mapping, index) => ({
    a: mapping.lab.a - clusters[index].lab.a,
    b: mapping.lab.b - clusters[index].lab.b,
    // The optimizer already penalizes excessive changes. Keep the applied
    // shift close enough to its selected candidate that the measured gain is
    // not lost during the final per-pixel interpolation.
    strength: clamp(0.9 + 0.1 * Math.min(1, deltaE2000(mapping.lab, clusters[index].lab) / 24)),
  }));

  // Metrics must describe the color actually applied to the representative
  // cluster, including the gradual strength and neutral-color guard below.
  const appliedMappings = mappings.map((mapping, index) => {
    const cluster = clusters[index];
    const shift = shifts[index];
    const chromaGuard = clamp((Math.hypot(cluster.lab.a, cluster.lab.b) - 3) / 10);
    if (mapping.source === 'original' || !chromaGuard) return buildCandidate(cluster, type, 'original');
    const rgb = labToRgb({
      l: cluster.lab.l,
      a: cluster.lab.a + shift.a * shift.strength * chromaGuard,
      b: cluster.lab.b + shift.b * shift.strength * chromaGuard,
    });
    const lab = rgbToLab(rgb);
    return {
      lab,
      rgb,
      simulatedLab: rgbToLab(simulateCvdColor(rgb.r, rgb.g, rgb.b, type)),
      source: mapping.source,
    };
  });

  if (conflicts.length) {
    for (let pixel = 0; pixel < data.length; pixel += 4) {
      if (source[pixel + 3] < 128) continue;
      const original: RgbColor = { r: source[pixel], g: source[pixel + 1], b: source[pixel + 2] };
      const lab = rgbToLab(original);
      const clusterIndex = nearestCluster(lab, clusters);
      const shift = shifts[clusterIndex];
      if (Math.abs(shift.a) + Math.abs(shift.b) < 0.5) continue;
      const chroma = Math.hypot(lab.a, lab.b);
      const chromaGuard = clamp((chroma - 3) / 10);
      if (!chromaGuard) continue;
      const corrected = labToRgb({
        l: lab.l,
        a: lab.a + shift.a * shift.strength * chromaGuard,
        b: lab.b + shift.b * shift.strength * chromaGuard,
      });
      data[pixel] = corrected.r;
      data[pixel + 1] = corrected.g;
      data[pixel + 2] = corrected.b;
    }
  }
  return { data, metrics: correctedMetrics(clusters, appliedMappings, conflicts, sampledPixels) };
}
