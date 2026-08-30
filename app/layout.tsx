import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://yuka-718.github.io'),
  title: 'Palette Standard｜色を、伝わる情報に。',
  description:
    '色覚多様性に配慮し、画像の見えづらさを検出から補正まで一気通貫で支援するアクセシビリティ・プラットフォーム。',
  openGraph: {
    title: 'Palette Standard｜色を、伝わる情報に。',
    description: '見えづらさの検出から、誰にでも識別しやすい形への自動補正まで。',
    url: 'https://yuka-718.github.io/palette-standard/',
    siteName: 'Palette Standard',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: '/palette-standard/og.png', width: 1200, height: 630, alt: 'Palette Standard — 色を、伝わる情報に。' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Palette Standard｜色を、伝わる情報に。',
    description: '見えづらさの検出から、誰にでも識別しやすい形への自動補正まで。',
    images: ['/palette-standard/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
