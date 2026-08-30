'use client';

import {
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Crosshair,
  Download,
  Eye,
  ImageUp,
  Info,
  LockKeyhole,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';

type ModuleKey = 'bridge' | 'camera';
type VisionType = 'C' | 'P' | 'D' | 'T' | 'A';
type BridgeMode = 'simulate' | 'fix';
type BridgeFixStyle = 'color' | 'pattern' | 'both';
type BridgePreset = 'standard' | 'education';
type CameraStatus = 'idle' | 'starting' | 'active' | 'error';

const modules = [
  {
    key: 'bridge' as const,
    number: '01',
    label: 'つくる',
    title: 'Color Bridge',
  },
  {
    key: 'camera' as const,
    number: '02',
    label: '色を知る',
    title: 'Color Lens',
  },
];

const visionLabels: Record<VisionType, string> = {
  C: 'C型（一般色覚・比較用）',
  P: 'P型（1型色覚）',
  D: 'D型（2型色覚）',
  T: 'T型（3型色覚）',
  A: 'A型（参考表示）',
};

const visionShortLabels: Record<VisionType, string> = {
  C: '一般・比較',
  P: '1型',
  D: '2型',
  T: '3型',
  A: '参考',
};

const bridgePresetLabels: Record<BridgePreset, string> = {
  standard: 'デザイン・資料',
  education: '教材・黒板',
};

const bridgeFixLabels: Record<BridgeFixStyle, string> = {
  color: '色を変える',
  pattern: '模様を付ける',
  both: '色＋模様',
};

const matrices: Record<Exclude<VisionType, 'C' | 'A'>, number[]> = {
  P: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  D: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  T: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

function clamp(value: number) {
  return Math.max(0, Math.min(255, value));
}

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness };
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
  if (max === green) hue = (blue - red) / delta + 2;
  if (max === blue) hue = (red - green) / delta + 4;
  return { h: hue * 60, s: saturation, l: lightness };
}

function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function simulateVisionColor(r: number, g: number, b: number, type: VisionType) {
  if (type === 'C') return { r, g, b };
  if (type === 'A') {
    const gray = clamp(0.2126 * r + 0.7152 * g + 0.0722 * b);
    return { r: gray, g: gray, b: gray };
  }
  const matrix = matrices[type];
  return {
    r: clamp(matrix[0] * r + matrix[1] * g + matrix[2] * b),
    g: clamp(matrix[3] * r + matrix[4] * g + matrix[5] * b),
    b: clamp(matrix[6] * r + matrix[7] * g + matrix[8] * b),
  };
}

function cudTargetColor(hue: number, lightness: number, type: VisionType) {
  if (type === 'P' || type === 'D') {
    if (hue < 18 || hue >= 345) return lightness < 0.35 ? { r: 153, g: 0, b: 153 } : { r: 246, g: 170, b: 0 };
    if (hue < 48) return { r: 246, g: 170, b: 0 };
    if (hue < 78) return { r: 255, g: 241, b: 0 };
    if (hue < 175) return { r: 0, g: 90, b: 255 };
    if (hue < 270) return { r: 77, g: 196, b: 255 };
    if (hue < 330) return { r: 153, g: 0, b: 153 };
    return { r: 255, g: 128, b: 130 };
  }
  if (type === 'T') {
    if (hue < 18 || hue >= 345) return { r: 77, g: 196, b: 255 };
    if (hue < 48) return { r: 246, g: 170, b: 0 };
    if (hue < 78) return { r: 255, g: 241, b: 0 };
    if (hue < 210) return { r: 255, g: 75, b: 0 };
    if (hue < 270) return { r: 0, g: 90, b: 255 };
    return { r: 153, g: 0, b: 153 };
  }
  if (hue < 18 || hue >= 345) return { r: 255, g: 75, b: 0 };
  if (hue < 48) return { r: 246, g: 170, b: 0 };
  if (hue < 78) return { r: 255, g: 241, b: 0 };
  if (hue < 175) return { r: 3, g: 175, b: 122 };
  if (hue < 210) return { r: 77, g: 196, b: 255 };
  if (hue < 270) return { r: 0, g: 90, b: 255 };
  if (hue < 330) return { r: 153, g: 0, b: 153 };
  return { r: 255, g: 128, b: 130 };
}

function correctColorForVision(r: number, g: number, b: number, type: VisionType) {
  if (type === 'C') return { r, g, b };
  const { h, s, l } = rgbToHsl(r, g, b);
  if (s <= 0.2) return { r, g, b };
  const target = cudTargetColor(h, l, type);
  const mix = Math.min(0.76, 0.32 + s * 0.46);
  return {
    r: clamp(r * (1 - mix) + target.r * mix),
    g: clamp(g * (1 - mix) + target.g * mix),
    b: clamp(b * (1 - mix) + target.b * mix),
  };
}

function patternInkForColor(r: number, g: number, b: number, x: number, y: number) {
  const { h, s, l } = rgbToHsl(r, g, b);
  if (s <= 0.2) return null;
  const positiveDiagonal = (x + y) % 16 < 2;
  const negativeDiagonal = ((x - y) % 16 + 16) % 16 < 2;
  let marked = false;

  if (l < 0.35) marked = positiveDiagonal || negativeDiagonal;
  else if (h < 18 || h >= 345) marked = positiveDiagonal;
  else if (h < 78) marked = x % 14 < 3 && y % 14 < 3;
  else if (h < 175) marked = y % 13 < 2;
  else if (h < 210) marked = x % 13 < 2;
  else if (h < 270) marked = negativeDiagonal;
  else if (h < 330) marked = x % 15 < 2 || y % 15 < 2;
  else marked = (x + 7) % 14 < 3 && (y + 7) % 14 < 3;

  if (!marked) return null;
  return l > 0.55 ? 24 : 245;
}

function colorName(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  if (l < 0.1) return '黒';
  if (l > 0.94) return '白';
  if (s < 0.14) {
    if (l < 0.32) return '濃いグレー';
    if (l > 0.74) return '明るいグレー';
    return 'グレー';
  }
  if (h >= 15 && h < 50 && l < 0.38) return '茶色';
  const tone = l < 0.3 ? '濃い' : l > 0.76 ? '明るい' : '';
  const name = h < 15 || h >= 345 ? '赤' : h < 45 ? 'オレンジ' : h < 70 ? '黄' : h < 95 ? '黄緑' : h < 165 ? '緑' : h < 195 ? '青緑' : h < 220 ? '水色' : h < 260 ? '青' : h < 290 ? '青紫' : h < 330 ? '紫' : 'ピンク';
  return `${tone}${name}`;
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('bridge');
  const [vision, setVision] = useState<VisionType>('D');
  const [bridgeMode, setBridgeMode] = useState<BridgeMode>('simulate');
  const [bridgeFixStyle, setBridgeFixStyle] = useState<BridgeFixStyle>('color');
  const [bridgePreset, setBridgePreset] = useState<BridgePreset>('standard');
  const [fileName, setFileName] = useState('サンプル資料');
  const [risk, setRisk] = useState(28);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState('');
  const [detectedColor, setDetectedColor] = useState({ r: 132, g: 145, b: 158, hex: '#84919E', name: 'グレー' });
  const [isDragging, setIsDragging] = useState(false);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceDataRef = useRef<ImageData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraTimerRef = useRef<number | null>(null);
  const cameraRequestRef = useRef(0);
  const activeVisionName = visionLabels[vision].split('（')[0];
  const effectiveFixStyle: BridgeFixStyle = vision === 'A' ? 'pattern' : bridgeFixStyle;
  const activeFixLabel = bridgeFixLabels[effectiveFixStyle];

  function drawSample(preset: BridgePreset = bridgePreset) {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    canvas.width = 960;
    canvas.height = 600;
    if (preset === 'education') {
      context.fillStyle = '#124f43';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = 'rgba(255,255,255,.35)';
      context.lineWidth = 4;
      context.strokeRect(46, 42, 868, 500);
      context.font = '800 44px sans-serif';
      context.fillStyle = '#f8f4e5';
      context.fillText('今日のポイント', 82, 130);
      context.font = '800 58px sans-serif';
      context.fillStyle = '#d25550';
      context.fillText('赤い文字も、大切な情報。', 82, 260);
      context.fillStyle = '#f8f4e5';
      context.font = '700 38px sans-serif';
      context.fillText('学びを、見える形へ。', 82, 365);
      context.fillStyle = 'rgba(255,255,255,.68)';
      context.font = '600 24px sans-serif';
      context.fillText('8 / 30  ｜  総合学習', 82, 485);
    } else {
      context.fillStyle = '#f7f7f2';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#111820';
      context.font = '800 42px sans-serif';
      context.fillText('地域別アンケート結果', 60, 82);
      context.font = '600 20px sans-serif';
      context.fillStyle = '#536170';
      context.fillText('4つの地域を色で比較', 60, 118);
      const colors = ['#ff4b00', '#03af7a', '#f6aa00', '#77d9a8'];
      const heights = [250, 335, 205, 285];
      colors.forEach((color, index) => {
        const x = 95 + index * 205;
        const y = 490 - heights[index];
        context.fillStyle = color;
        context.fillRect(x, y, 126, heights[index]);
        context.fillStyle = '#111820';
        context.font = '700 20px sans-serif';
        context.fillText(`地域 ${String.fromCharCode(65 + index)}`, x + 25, 535);
      });
      context.strokeStyle = '#111820';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(62, 490);
      context.lineTo(902, 490);
      context.stroke();
    }
    sourceDataRef.current = context.getImageData(0, 0, canvas.width, canvas.height);
    setFileName(preset === 'education' ? 'サンプル教材' : 'サンプル資料');
    processResult(vision, bridgeMode, effectiveFixStyle, preset);
  }

  function processResult(nextVision = vision, nextBridgeMode = bridgeMode, nextFixStyle = effectiveFixStyle, nextPreset = bridgePreset) {
    const result = resultCanvasRef.current;
    const source = sourceDataRef.current;
    if (!result || !source) return;
    result.width = source.width;
    result.height = source.height;
    const context = result.getContext('2d');
    if (!context) return;
    const output = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
    const data = output.data;
    let affected = 0;

    const effectiveMode: BridgeMode = nextVision === 'C' ? 'simulate' : nextBridgeMode;
    const fixStyle = nextVision === 'A' ? 'pattern' : nextFixStyle;
    for (let pixel = 0; pixel < data.length; pixel += 4) {
        const r = source.data[pixel];
        const g = source.data[pixel + 1];
        const b = source.data[pixel + 2];
        let nr: number;
        let ng: number;
        let nb: number;
        if (effectiveMode === 'fix') {
          const { s } = rgbToHsl(r, g, b);
          const useColor = fixStyle === 'color' || fixStyle === 'both';
          const usePattern = fixStyle === 'pattern' || fixStyle === 'both';
          const corrected = useColor ? correctColorForVision(r, g, b, nextVision) : { r, g, b };
          nr = corrected.r;
          ng = corrected.g;
          nb = corrected.b;
          if (s > 0.2) affected += 1;
          if (usePattern) {
            const index = pixel / 4;
            const x = index % source.width;
            const y = Math.floor(index / source.width);
            const ink = patternInkForColor(r, g, b, x, y);
            if (ink !== null) {
              nr = clamp(nr * 0.28 + ink * 0.72);
              ng = clamp(ng * 0.28 + ink * 0.72);
              nb = clamp(nb * 0.28 + ink * 0.72);
            }
          }
        } else {
          const simulated = simulateVisionColor(r, g, b, nextVision);
          nr = simulated.r;
          ng = simulated.g;
          nb = simulated.b;
          if (Math.abs(nr - r) + Math.abs(ng - g) + Math.abs(nb - b) > 85) affected += 1;
        }
        data[pixel] = nr;
        data[pixel + 1] = ng;
        data[pixel + 2] = nb;
      }

    if (effectiveMode === 'fix' && nextPreset === 'education') {
      const mask = new Uint8Array(source.width * source.height);
      for (let pixel = 0; pixel < data.length; pixel += 4) {
        const { h, s, l } = rgbToHsl(source.data[pixel], source.data[pixel + 1], source.data[pixel + 2]);
        if ((h < 28 || h > 330) && s > 0.28 && l > 0.12 && l < 0.8) mask[pixel / 4] = 1;
      }
      const radius = 3;
      for (let y = radius; y < source.height - radius; y += 1) {
        for (let x = radius; x < source.width - radius; x += 1) {
          const index = y * source.width + x;
          if (mask[index]) continue;
          let near = false;
          for (let oy = -radius; oy <= radius && !near; oy += 2) {
            for (let ox = -radius; ox <= radius; ox += 2) {
              if (mask[(y + oy) * source.width + x + ox]) { near = true; break; }
            }
          }
          if (near) {
            const pixel = index * 4;
            data[pixel] = 255;
            data[pixel + 1] = 255;
            data[pixel + 2] = 255;
          }
        }
      }
    }
    context.putImageData(output, 0, 0);
    setRisk(Math.round((affected / (source.width * source.height)) * 100));
  }

  useEffect(() => {
    drawSample();
    // The first render seeds a local demo image.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    processResult();
    // Canvas state is intentionally recalculated from the current controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule, vision, bridgeMode, bridgeFixStyle, bridgePreset]);

  useEffect(() => () => releaseCamera(false), []);

  function handleImage(file?: File) {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 12 * 1024 * 1024) {
      window.alert('画像は12MB以下を選んでください。');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = sourceCanvasRef.current;
        if (!canvas) return;
        const maxWidth = 1100;
        const maxHeight = 760;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        sourceDataRef.current = context.getImageData(0, 0, canvas.width, canvas.height);
        setFileName(file.name);
        processResult();
      };
      if (typeof reader.result === 'string') image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    handleImage(event.target.files?.[0]);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleImage(event.dataTransfer.files?.[0]);
  }

  function sampleCameraColor() {
    const video = videoRef.current;
    const canvas = cameraCanvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (!video.videoWidth || !video.videoHeight) return;
    const sampleSize = Math.max(12, Math.round(Math.min(video.videoWidth, video.videoHeight) * 0.04));
    canvas.width = 20;
    canvas.height = 20;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(
      video,
      (video.videoWidth - sampleSize) / 2,
      (video.videoHeight - sampleSize) / 2,
      sampleSize,
      sampleSize,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let pixel = 0; pixel < pixels.length; pixel += 4) {
      if (pixels[pixel + 3] === 0) continue;
      r += pixels[pixel];
      g += pixels[pixel + 1];
      b += pixels[pixel + 2];
      count += 1;
    }
    if (!count) return;
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    const hex = rgbToHex(r, g, b);
    setDetectedColor({ r, g, b, hex, name: colorName(hex) });
  }

  function releaseCamera(updateState = true) {
    cameraRequestRef.current += 1;
    if (cameraTimerRef.current !== null) {
      window.clearInterval(cameraTimerRef.current);
      cameraTimerRef.current = null;
    }
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (updateState) setCameraStatus('idle');
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('このブラウザではカメラを利用できません。');
      setCameraStatus('error');
      return;
    }
    setCameraStatus('starting');
    setCameraError('');
    const requestId = cameraRequestRef.current + 1;
    cameraRequestRef.current = requestId;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (cameraRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      sampleCameraColor();
      cameraTimerRef.current = window.setInterval(sampleCameraColor, 250);
      setCameraStatus('active');
    } catch (error) {
      releaseCamera(false);
      const name = error instanceof DOMException ? error.name : '';
      setCameraError(name === 'NotAllowedError' ? 'カメラの使用が許可されていません。' : name === 'NotFoundError' ? '利用できるカメラが見つかりません。' : 'カメラを開始できませんでした。');
      setCameraStatus('error');
    }
  }

  function downloadResult() {
    const canvas = resultCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'eyepalette-color-bridge.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function switchModule(module: ModuleKey) {
    if (activeModule === 'camera' && module !== 'camera') releaseCamera();
    setActiveModule(module);
    if (module === 'camera') return;
    if (fileName.startsWith('サンプル')) {
      window.setTimeout(() => drawSample(bridgePreset), 0);
    } else {
      window.setTimeout(() => processResult(), 0);
    }
  }

  return (
    <main id="main" className="tool-page">
      <a className="skip-link" href="#workspace">ツールへ移動</a>

      <header className="site-header" id="top">
        <a className="brand" href="#workspace" aria-label="EyePalette ツールへ">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>Eye<b>Palette</b></span>
        </a>
        <p className="header-status"><LockKeyhole aria-hidden="true" /> 画像・映像は端末内で処理</p>
      </header>

      <section className="workspace-section" id="workspace">
        <div className="workspace-shell">
          <div className="workspace-tabs" role="tablist" aria-label="利用する機能">
            {modules.map((module) => (
              <button
                key={module.key}
                type="button"
                role="tab"
                aria-selected={activeModule === module.key}
                onClick={() => switchModule(module.key)}
              >
                <span>{module.number} / {module.label}</span>
                <strong>{module.title}</strong>
                {activeModule === module.key && <Check aria-label="選択中" />}
              </button>
            ))}
          </div>

          {activeModule !== 'camera' ? (
            <div className="image-tool">
              <aside className="tool-sidebar">
                <div>
                  <p className="tool-kicker">SOURCE IMAGE</p>
                  <h3>画像を解析・補正する</h3>
                  <p>PNG・JPG・WebP / 最大 12MB</p>
                </div>
                <input ref={inputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileInput} />
                <input ref={captureInputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={handleFileInput} />
                <div className="source-actions">
                  <button className="upload-button" type="button" onClick={() => inputRef.current?.click()}>
                    <Upload aria-hidden="true" /> 画像を選ぶ
                  </button>
                  <button className="capture-button" type="button" onClick={() => captureInputRef.current?.click()}>
                    <Camera aria-hidden="true" /> カメラで撮る
                  </button>
                </div>

                <fieldset className="control-group">
                  <legend>対象</legend>
                  {(Object.keys(bridgePresetLabels) as BridgePreset[]).map((preset) => (
                    <button
                      className="wide-option"
                      key={preset}
                      type="button"
                      aria-pressed={bridgePreset === preset}
                      onClick={() => {
                        setBridgePreset(preset);
                        if (fileName.startsWith('サンプル')) window.setTimeout(() => drawSample(preset), 0);
                        else processResult(vision, bridgeMode, effectiveFixStyle, preset);
                      }}
                    >
                      {bridgePresetLabels[preset]}
                      {bridgePreset === preset && <Check aria-label="選択中" />}
                    </button>
                  ))}
                  {bridgePreset === 'education' && <p className="control-note">補正時に、赤系の強調箇所へ白い縁を加えます。</p>}
                </fieldset>

                <fieldset className="control-group">
                  <legend>見え方のタイプ</legend>
                  <div className="vision-options">
                    {(Object.keys(visionLabels) as VisionType[]).map((type) => (
                      <button
                        type="button"
                        key={type}
                        aria-label={visionLabels[type]}
                        aria-pressed={vision === type}
                        onClick={() => {
                          setVision(type);
                          const nextMode: BridgeMode = type === 'C' ? 'simulate' : bridgeMode;
                          if (type === 'C') setBridgeMode('simulate');
                          processResult(type, nextMode, type === 'A' ? 'pattern' : bridgeFixStyle);
                        }}
                      >
                        <b>{type}</b><span>{visionShortLabels[type]}</span>
                      </button>
                    ))}
                  </div>
                  <p className="control-note">C型は元画像との比較用で、補正は行いません。P・D・T・A型が主な色覚特性の分類です。A型は参考表示です。</p>
                </fieldset>
                <fieldset className="control-group">
                  <legend>表示モード</legend>
                  <button className="wide-option" type="button" aria-pressed={bridgeMode === 'simulate'} onClick={() => { setBridgeMode('simulate'); processResult(vision, 'simulate'); }}>
                    <Eye aria-hidden="true" /> 見え方を確認
                    {bridgeMode === 'simulate' && <Check aria-label="選択中" />}
                  </button>
                  {vision !== 'C' && (
                    <button className="wide-option" type="button" aria-pressed={bridgeMode === 'fix'} onClick={() => { setBridgeMode('fix'); processResult(vision, 'fix'); }}>
                      <WandSparkles aria-hidden="true" /> {activeVisionName}向けに補正
                      {bridgeMode === 'fix' && <Check aria-label="選択中" />}
                    </button>
                  )}
                </fieldset>
                {vision !== 'C' && bridgeMode === 'fix' && (
                  <fieldset className="control-group">
                    <legend>補正方法</legend>
                    {(vision === 'A' ? (['pattern'] as BridgeFixStyle[]) : (Object.keys(bridgeFixLabels) as BridgeFixStyle[])).map((style) => (
                      <button
                        className="wide-option"
                        key={style}
                        type="button"
                        aria-pressed={effectiveFixStyle === style}
                        onClick={() => {
                          setBridgeFixStyle(style);
                          processResult(vision, 'fix', style);
                        }}
                      >
                        {bridgeFixLabels[style]}
                        {effectiveFixStyle === style && <Check aria-label="選択中" />}
                      </button>
                    ))}
                    {vision === 'A' && <p className="control-note">色の置換ではなく、模様で情報を区別します。</p>}
                  </fieldset>
                )}

                <div className="privacy-note"><LockKeyhole aria-hidden="true" /><span><strong>端末内で処理</strong>画像はサーバーへ送信されません。</span></div>
              </aside>

              <div className="canvas-workspace">
                <div className="analysis-bar">
                  <div><span className="status-dot" /> {fileName}</div>
                  <div className="analysis-result">
                    {bridgeMode === 'fix' ? <CheckCircle2 aria-hidden="true" /> : <Info aria-hidden="true" />}
                    <strong>{bridgeMode === 'fix' ? `${activeVisionName}向け補正済み` : '解析中'}</strong>
                    <span>{bridgeMode === 'fix' ? '補正候補' : '変化画素'} {risk}%</span>
                  </div>
                </div>
                <div
                  className={`canvas-grid ${isDragging ? 'is-dragging' : ''}`}
                  onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <figure>
                    <figcaption><span>ORIGINAL</span> 元の画像</figcaption>
                    <canvas ref={sourceCanvasRef} aria-label="元画像のプレビュー" />
                  </figure>
                  <figure>
                    <figcaption>
                      <span>{bridgeMode === 'fix' ? 'FIXED' : visionLabels[vision]}</span>
                      {bridgeMode === 'fix' ? `${activeVisionName}向け・${activeFixLabel}` : 'シミュレーション'}
                    </figcaption>
                    <canvas ref={resultCanvasRef} aria-label="処理後画像のプレビュー" />
                  </figure>
                  {isDragging && <div className="drop-overlay"><ImageUp aria-hidden="true" />ここにドロップ</div>}
                </div>
                <div className="canvas-actions">
                  <p><Info aria-hidden="true" /> {bridgeMode === 'fix' ? '補正結果は目安です。重要な用途では当事者による確認も行ってください。' : vision === 'A' ? 'A型は単純な白黒表示と同一ではありません。色の識別が限られる状態の参考表示です。' : 'シミュレーションは見分けにくさの目安です。実際の見え方を断定するものではありません。'}</p>
                  <button type="button" onClick={downloadResult}><Download aria-hidden="true" /> PNGをダウンロード</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="camera-tool">
              <div className={`camera-stage is-${cameraStatus}`}>
                <video ref={videoRef} muted playsInline aria-label="色を読み取るカメラ映像" />
                <canvas ref={cameraCanvasRef} className="visually-hidden" aria-hidden="true" />
                {cameraStatus === 'active' ? (
                  <div className="camera-reticle" aria-hidden="true"><Crosshair /></div>
                ) : (
                  <div className="camera-empty">
                    <Camera aria-hidden="true" />
                    <h3>{cameraStatus === 'starting' ? 'カメラを起動中' : cameraStatus === 'error' ? 'カメラを使えません' : 'カメラで色を調べる'}</h3>
                    {cameraError && <p role="alert">{cameraError}</p>}
                    <button type="button" onClick={startCamera} disabled={cameraStatus === 'starting'}>
                      <Camera aria-hidden="true" /> {cameraStatus === 'error' ? 'もう一度試す' : 'カメラを開始'}
                    </button>
                  </div>
                )}
              </div>

              <aside className="camera-readout">
                <p className="tool-kicker">CENTER COLOR</p>
                <p className="camera-guide"><Crosshair aria-hidden="true" /> 中央の枠に調べたい色を合わせる</p>
                <div className="detected-swatch" style={{ backgroundColor: detectedColor.hex }} aria-label={`検出した色 ${detectedColor.name}`} />
                <h3 aria-live="polite">{detectedColor.name}</h3>
                <dl>
                  <div><dt>HEX</dt><dd>{detectedColor.hex}</dd></div>
                  <div><dt>RGB</dt><dd>{detectedColor.r}, {detectedColor.g}, {detectedColor.b}</dd></div>
                </dl>
                {cameraStatus === 'active' && (
                  <button className="camera-stop" type="button" onClick={() => releaseCamera()}>
                    <CameraOff aria-hidden="true" /> カメラを停止
                  </button>
                )}
                <div className="privacy-note"><LockKeyhole aria-hidden="true" /><span><strong>端末内で判定</strong>映像は保存・送信されません。</span></div>
              </aside>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
