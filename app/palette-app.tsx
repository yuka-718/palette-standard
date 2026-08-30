'use client';

import {
  ArrowDown,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Download,
  Eye,
  ImageUp,
  Info,
  Layers3,
  LockKeyhole,
  ScanSearch,
  Shirt,
  Sparkles,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';

type ModuleKey = 'bridge' | 'edu' | 'talk';
type VisionType = 'C' | 'P' | 'D' | 'T';
type BridgeMode = 'simulate' | 'fix';
type EduMode = 'outline' | 'brightness' | 'underline';

const modules = [
  {
    key: 'bridge' as const,
    number: '01',
    label: 'つくる',
    title: 'Color Bridge',
    description: '資料やデザインの見分けにくい配色を検出し、伝わる表現へ。',
    icon: Layers3,
    accent: 'module-blue',
  },
  {
    key: 'edu' as const,
    number: '02',
    label: 'まなぶ',
    title: 'Edu Vision',
    description: '黒板や教材で背景に同化した文字を、くっきり読みやすく。',
    icon: ScanSearch,
    accent: 'module-orange',
  },
  {
    key: 'talk' as const,
    number: '03',
    label: '暮らす',
    title: 'Color Talk',
    description: '服やアイテムの配色を、色名と自然なことばでアドバイス。',
    icon: Shirt,
    accent: 'module-green',
  },
];

const visionLabels: Record<VisionType, string> = {
  C: 'C型（一般色覚）',
  P: 'P型（赤系）',
  D: 'D型（緑系）',
  T: 'T型（青黄系）',
};

const matrices: Record<Exclude<VisionType, 'C'>, number[]> = {
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

function luminance({ r, g, b }: ReturnType<typeof hexToRgb>) {
  const convert = (value: number) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * convert(r) + 0.7152 * convert(g) + 0.0722 * convert(b);
}

function contrastRatio(first: string, second: string) {
  const a = luminance(hexToRgb(first));
  const b = luminance(hexToRgb(second));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function colorName(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  if (s < 0.12) {
    if (l < 0.18) return '黒に近い色';
    if (l > 0.86) return '白に近い色';
    return 'グレー';
  }
  const tone = l < 0.34 ? '深い' : l > 0.72 ? '明るい' : '';
  const name = h < 15 || h >= 345 ? '赤' : h < 42 ? 'オレンジ' : h < 70 ? '黄' : h < 165 ? '緑' : h < 200 ? '青緑' : h < 255 ? '青' : h < 295 ? '紫' : h < 345 ? 'ピンク' : '赤';
  return `${tone}${name}`;
}

function getColorAdvice(first: string, second: string) {
  const aRgb = hexToRgb(first);
  const bRgb = hexToRgb(second);
  const a = rgbToHsl(aRgb.r, aRgb.g, aRgb.b);
  const b = rgbToHsl(bRgb.r, bRgb.g, bRgb.b);
  const hueDiff = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h));
  const lightnessDiff = Math.abs(a.l - b.l);
  const contrast = contrastRatio(first, second);
  let relation = '近い色どうしの、落ち着いた組み合わせです。';
  if (hueDiff > 145) relation = '反対側の色相を使った、メリハリのある組み合わせです。';
  else if (hueDiff > 75) relation = 'ほどよく離れた色相で、バランスのよい組み合わせです。';
  else if (hueDiff < 28) relation = '同系色でまとまりがあり、自然になじむ組み合わせです。';
  const visibility =
    contrast >= 4.5
      ? '明るさの差も十分で、文字や小さな要素にも使いやすいです。'
      : lightnessDiff >= 0.25
        ? '明るさの差はありますが、小さな文字ではコントラストを確認しましょう。'
        : '明るさが近いため、並べるときは白い境界・模様・ラベルを加えると安心です。';
  return { relation, visibility, contrast, hueDiff };
}

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('bridge');
  const [vision, setVision] = useState<VisionType>('D');
  const [bridgeMode, setBridgeMode] = useState<BridgeMode>('simulate');
  const [eduMode, setEduMode] = useState<EduMode>('outline');
  const [fileName, setFileName] = useState('サンプル資料');
  const [risk, setRisk] = useState(28);
  const [firstColor, setFirstColor] = useState('#005AFF');
  const [secondColor, setSecondColor] = useState('#F6AA00');
  const [isDragging, setIsDragging] = useState(false);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceDataRef = useRef<ImageData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const talkAdvice = useMemo(() => getColorAdvice(firstColor, secondColor), [firstColor, secondColor]);

  function drawSample(module: ModuleKey = 'bridge') {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    canvas.width = 960;
    canvas.height = 600;
    if (module === 'edu') {
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
    setFileName(module === 'edu' ? 'サンプル教材' : 'サンプル資料');
    processResult(vision, bridgeMode, eduMode, module);
  }

  function processResult(nextVision = vision, nextBridgeMode = bridgeMode, nextEduMode = eduMode, module = activeModule) {
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

    if (module === 'edu') {
      const mask = new Uint8Array(source.width * source.height);
      for (let pixel = 0; pixel < data.length; pixel += 4) {
        const index = pixel / 4;
        const r = data[pixel];
        const g = data[pixel + 1];
        const b = data[pixel + 2];
        const { h, s, l } = rgbToHsl(r, g, b);
        if ((h < 28 || h > 330) && s > 0.28 && l > 0.12 && l < 0.8) {
          mask[index] = 1;
          affected += 1;
          if (nextEduMode === 'brightness') {
            data[pixel] = 255;
            data[pixel + 1] = 255;
            data[pixel + 2] = 255;
          }
        }
      }
      if (nextEduMode === 'outline') {
        const radius = 4;
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
      if (nextEduMode === 'underline') {
        context.strokeStyle = '#ffffff';
        context.lineWidth = Math.max(5, source.width / 150);
        context.setLineDash([16, 8]);
        for (let y = 12; y < source.height - 12; y += 18) {
          let start = -1;
          for (let x = 0; x < source.width; x += 1) {
            const found = mask[y * source.width + x] === 1;
            if (found && start < 0) start = x;
            if ((!found || x === source.width - 1) && start >= 0) {
              if (x - start > 18) {
                context.beginPath(); context.moveTo(start, y + 9); context.lineTo(x, y + 9); context.stroke();
              }
              start = -1;
            }
          }
        }
        context.setLineDash([]);
      }
    } else {
      const matrix = nextVision === 'C' ? null : matrices[nextVision];
      for (let pixel = 0; pixel < data.length; pixel += 4) {
        const r = source.data[pixel];
        const g = source.data[pixel + 1];
        const b = source.data[pixel + 2];
        let nr = r;
        let ng = g;
        let nb = b;
        if (matrix) {
          nr = clamp(matrix[0] * r + matrix[1] * g + matrix[2] * b);
          ng = clamp(matrix[3] * r + matrix[4] * g + matrix[5] * b);
          nb = clamp(matrix[6] * r + matrix[7] * g + matrix[8] * b);
          if (Math.abs(nr - r) + Math.abs(ng - g) + Math.abs(nb - b) > 85) affected += 1;
        }
        if (nextBridgeMode === 'fix') {
          const { h, s, l } = rgbToHsl(r, g, b);
          if (s > 0.24 && ((h < 75 || h > 330) || (h > 80 && h < 170))) {
            const isGreen = h > 80 && h < 170;
            const stripe = ((pixel / 4) % source.width + Math.floor(pixel / 4 / source.width)) % 24 < 6;
            const shift = isGreen ? (stripe ? 64 : 38) : stripe ? -42 : -18;
            nr = clamp(r + shift);
            ng = clamp(g + shift);
            nb = clamp(b + shift);
            affected += 1;
          } else {
            const contrast = (l - 0.5) * 1.08 + 0.5;
            const delta = (contrast - l) * 255;
            nr = clamp(r + delta); ng = clamp(g + delta); nb = clamp(b + delta);
          }
        }
        data[pixel] = nr;
        data[pixel + 1] = ng;
        data[pixel + 2] = nb;
      }
      context.putImageData(output, 0, 0);
    }
    setRisk(Math.max(1, Math.round((affected / (source.width * source.height)) * 100)));
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
  }, [activeModule, vision, bridgeMode, eduMode]);

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
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    handleImage(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    handleImage(event.dataTransfer.files?.[0]);
  }

  function downloadResult() {
    const canvas = resultCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    const suffix = activeModule === 'edu' ? 'edu-vision' : 'color-bridge';
    link.download = `palette-standard-${suffix}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function switchModule(module: ModuleKey) {
    setActiveModule(module);
    if (module === 'talk') return;
    if (fileName.startsWith('サンプル')) {
      window.setTimeout(() => drawSample(module), 0);
    } else {
      window.setTimeout(() => processResult(vision, bridgeMode, eduMode, module), 0);
    }
  }

  return (
    <main id="main">
      <a className="skip-link" href="#workspace">デモへ移動</a>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Palette Standard トップへ">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>Palette <b>Standard</b></span>
        </a>
        <nav aria-label="メインナビゲーション">
          <a href="#modules">3つの機能</a>
          <a href="#how">しくみ</a>
          <a className="nav-cta" href="#workspace">無料で試す <ArrowDown aria-hidden="true" /></a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles aria-hidden="true" /> Color accessibility platform</p>
          <h1>色の違いを、<br /><span>伝わる違いへ。</span></h1>
          <p className="lead">
            見えづらさを見つけるだけで終わらない。<br />
            Palette Standard は、画像を解析し、誰にでも識別しやすい形へ自動で補正します。
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#workspace">画像で試してみる <ArrowDown aria-hidden="true" /></a>
            <a className="text-link" href="#modules">できることを見る</a>
          </div>
          <ul className="trust-list" aria-label="Palette Standard の特徴">
            <li><Check aria-hidden="true" /> ブラウザだけで完結</li>
            <li><Check aria-hidden="true" /> 画像は端末内で処理</li>
            <li><Check aria-hidden="true" /> P・D・T型に対応</li>
          </ul>
        </div>

        <div className="hero-visual" aria-label="配色を識別しやすく補正するイメージ">
          <div className="visual-label">BEFORE</div>
          <div className="chart-card before-card">
            <p>地域別アンケート結果</p>
            <div className="bars" aria-hidden="true">
              <i style={{ height: '48%' }} /><i style={{ height: '72%' }} />
              <i style={{ height: '58%' }} /><i style={{ height: '88%' }} />
            </div>
          </div>
          <div className="bridge-line" aria-hidden="true"><Sparkles /></div>
          <div className="visual-label after-label">AFTER</div>
          <div className="chart-card after-card">
            <p>地域別アンケート結果</p>
            <div className="bars" aria-hidden="true">
              <i style={{ height: '48%' }} data-label="A" /><i style={{ height: '72%' }} data-label="B" />
              <i style={{ height: '58%' }} data-label="C" /><i style={{ height: '88%' }} data-label="D" />
            </div>
            <span className="fixed-note"><Check aria-hidden="true" /> 模様とラベルを追加</span>
          </div>
        </div>
      </section>

      <section className="module-strip" id="modules" aria-label="3つのコアモジュール">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              className={`module-card ${module.accent}`}
              key={module.title}
              type="button"
              onClick={() => { switchModule(module.key); document.querySelector('#workspace')?.scrollIntoView(); }}
              aria-label={`${module.title} を試す`}
            >
              <span className="module-topline"><b>{module.number}</b><Icon aria-hidden="true" /></span>
              <span className="module-label">{module.label}</span>
              <strong>{module.title}</strong>
              <span className="module-description">{module.description}</span>
              <span className="module-link">試してみる <ArrowRight aria-hidden="true" /></span>
            </button>
          );
        })}
      </section>

      <section className="workspace-section" id="workspace">
        <div className="section-heading">
          <p className="section-kicker">TRY IT IN YOUR BROWSER</p>
          <h2>{activeModule === 'bridge' ? '画像の色を、伝わる形へ。' : activeModule === 'edu' ? '見えにくい文字を、くっきり。' : '2色の相性を、ことばで。'}</h2>
          <p>
            {activeModule === 'bridge' && '画像を置くだけで、色覚タイプ別の見え方と自動補正を比較できます。'}
            {activeModule === 'edu' && '教材や黒板画像の赤系文字を抽出し、読みやすい表現へ変換します。'}
            {activeModule === 'talk' && '2色を選ぶと、色名・明るさ・色相差から自然なアドバイスを返します。'}
          </p>
        </div>

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
                <span>{module.number}</span> {module.title}
                {activeModule === module.key && <Check aria-label="選択中" />}
              </button>
            ))}
          </div>

          {activeModule !== 'talk' ? (
            <div className="image-tool">
              <aside className="tool-sidebar">
                <div>
                  <p className="tool-kicker">SOURCE IMAGE</p>
                  <h3>{activeModule === 'bridge' ? '画像を解析する' : '教材を補正する'}</h3>
                  <p>PNG・JPG・WebP / 最大 12MB</p>
                </div>
                <input ref={inputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileInput} />
                <button className="upload-button" type="button" onClick={() => inputRef.current?.click()}>
                  <Upload aria-hidden="true" /> 画像を選ぶ
                </button>

                {activeModule === 'bridge' ? (
                  <>
                    <fieldset className="control-group">
                      <legend>見え方のタイプ</legend>
                      <div className="vision-options">
                        {(Object.keys(visionLabels) as VisionType[]).map((type) => (
                          <button
                            type="button"
                            key={type}
                            aria-pressed={vision === type}
                            onClick={() => { setVision(type); processResult(type, bridgeMode, eduMode); }}
                          >
                            <b>{type}</b><span>{visionLabels[type].split('（')[0]}</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="control-group">
                      <legend>表示モード</legend>
                      <button className="wide-option" type="button" aria-pressed={bridgeMode === 'simulate'} onClick={() => { setBridgeMode('simulate'); processResult(vision, 'simulate', eduMode); }}>
                        <Eye aria-hidden="true" /> 見え方を確認
                        {bridgeMode === 'simulate' && <Check aria-label="選択中" />}
                      </button>
                      <button className="wide-option" type="button" aria-pressed={bridgeMode === 'fix'} onClick={() => { setBridgeMode('fix'); processResult(vision, 'fix', eduMode); }}>
                        <WandSparkles aria-hidden="true" /> 自動補正
                        {bridgeMode === 'fix' && <Check aria-label="選択中" />}
                      </button>
                    </fieldset>
                  </>
                ) : (
                  <fieldset className="control-group">
                    <legend>補正方法</legend>
                    {([
                      ['outline', '白い縁取り'],
                      ['brightness', '白文字へ変換'],
                      ['underline', '下線を追加'],
                    ] as [EduMode, string][]).map(([mode, label]) => (
                      <button className="wide-option" key={mode} type="button" aria-pressed={eduMode === mode} onClick={() => { setEduMode(mode); processResult(vision, bridgeMode, mode); }}>
                        <ScanSearch aria-hidden="true" /> {label}
                        {eduMode === mode && <Check aria-label="選択中" />}
                      </button>
                    ))}
                  </fieldset>
                )}

                <div className="privacy-note"><LockKeyhole aria-hidden="true" /><span><strong>端末内で処理</strong>画像はサーバーへ送信されません。</span></div>
              </aside>

              <div className="canvas-workspace">
                <div className="analysis-bar">
                  <div><span className="status-dot" /> {fileName}</div>
                  <div className="analysis-result">
                    {bridgeMode === 'fix' || activeModule === 'edu' ? <CheckCircle2 aria-hidden="true" /> : <Info aria-hidden="true" />}
                    <strong>{bridgeMode === 'fix' || activeModule === 'edu' ? '補正済み' : '解析中'}</strong>
                    <span>対象領域 {risk}%</span>
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
                      <span>{activeModule === 'bridge' ? (bridgeMode === 'fix' ? 'FIXED' : visionLabels[vision]) : 'ENHANCED'}</span>
                      {activeModule === 'bridge' ? (bridgeMode === 'fix' ? '自動補正' : 'シミュレーション') : '教材補正'}
                    </figcaption>
                    <canvas ref={resultCanvasRef} aria-label="処理後画像のプレビュー" />
                  </figure>
                  {isDragging && <div className="drop-overlay"><ImageUp aria-hidden="true" />ここにドロップ</div>}
                </div>
                <div className="canvas-actions">
                  <p><Info aria-hidden="true" /> シミュレーションは見分けにくさの目安です。実際の見え方を断定するものではありません。</p>
                  <button type="button" onClick={downloadResult}><Download aria-hidden="true" /> PNGをダウンロード</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="talk-tool">
              <div className="color-pickers">
                <label>
                  <span>COLOR A</span>
                  <input type="color" value={firstColor} onChange={(event) => setFirstColor(event.target.value.toUpperCase())} />
                  <strong>{colorName(firstColor)}</strong>
                  <code>{firstColor}</code>
                </label>
                <span className="plus" aria-hidden="true">＋</span>
                <label>
                  <span>COLOR B</span>
                  <input type="color" value={secondColor} onChange={(event) => setSecondColor(event.target.value.toUpperCase())} />
                  <strong>{colorName(secondColor)}</strong>
                  <code>{secondColor}</code>
                </label>
              </div>
              <div className="talk-result" aria-live="polite">
                <p className="tool-kicker"><Sparkles aria-hidden="true" /> COLOR TALK ADVICE</p>
                <h3>{colorName(firstColor)}と{colorName(secondColor)}の組み合わせ</h3>
                <p>{talkAdvice.relation} {talkAdvice.visibility}</p>
                <dl>
                  <div><dt>色相の差</dt><dd>{Math.round(talkAdvice.hueDiff)}°</dd></div>
                  <div><dt>コントラスト</dt><dd>{talkAdvice.contrast.toFixed(2)} : 1</dd></div>
                  <div><dt>文字利用</dt><dd>{talkAdvice.contrast >= 4.5 ? 'AA目安を満たす' : '背景・文字には要調整'}</dd></div>
                </dl>
                <div className="cue-tip"><Info aria-hidden="true" /><span><strong>色だけに頼らないコツ</strong>服なら素材感や柄、UIなら文字・アイコン・枠線も一緒に使いましょう。</span></div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="how-section" id="how">
        <div className="section-intro">
          <p className="dark-kicker">FROM DETECTION TO SOLUTION</p>
          <h2>確認で終わらない。<br /><span>解決まで、ひと続き。</span></h2>
        </div>
        <div className="steps-grid">
          <article>
            <span>STEP 01</span><div className="step-icon blue"><ImageUp aria-hidden="true" /></div>
            <h3>置く・かざす</h3><p>画像を選ぶだけ。複雑な設定や専門知識は必要ありません。</p>
          </article>
          <article>
            <span>STEP 02</span><div className="step-icon orange"><ScanSearch aria-hidden="true" /></div>
            <h3>見つける</h3><p>RGBからLMS・HSVへ変換し、識別しにくい領域を端末内で解析。</p>
          </article>
          <article>
            <span>STEP 03</span><div className="step-icon green"><WandSparkles aria-hidden="true" /></div>
            <h3>伝わる形にする</h3><p>明度・模様・輪郭・ことばを加え、色以外の手掛かりも残します。</p>
          </article>
        </div>
      </section>

      <section className="principles" id="principles">
        <div className="principle-copy">
          <p className="section-kicker">DESIGNED FOR DIFFERENCE</p>
          <h2>色を消しても、<br />意味が残る設計。</h2>
          <p>見やすい配色に加えて、文字・形・模様・明暗を組み合わせます。色覚タイプや利用環境が違っても、大切な情報へたどり着けることを基準にしています。</p>
        </div>
        <div className="principle-list">
          <div><CheckCircle2 aria-hidden="true" /><span><strong>十分なコントラスト</strong>通常文字は WCAG 2.2 AA の 4.5:1 以上を基準に。</span></div>
          <div><Layers3 aria-hidden="true" /><span><strong>色＋もう1つの手掛かり</strong>アイコン、ラベル、模様、太さを必ず併用。</span></div>
          <div><BookOpenCheck aria-hidden="true" /><span><strong>検証を重ねる</strong>P・D・T型、グレースケール、実機、当事者評価へ。</span></div>
        </div>
      </section>

      <section className="vision-section">
        <p>OUR VISION</p>
        <h2>色のバリアフリーを、<br /><span>すべての人へ。</span></h2>
        <p>創作・教育・暮らしをひとつの技術でつなぎ、<br />誰もが色で迷わない社会の標準をつくります。</p>
        <a className="light-button" href="#workspace">Palette Standard を試す <ArrowRight aria-hidden="true" /></a>
      </section>

      <footer>
        <a className="brand" href="#top"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>Palette <b>Standard</b></span></a>
        <p>Color accessibility for everyone.</p>
        <p>© 2026 Palette Standard</p>
      </footer>
    </main>
  );
}
