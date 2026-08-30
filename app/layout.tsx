import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://yuka-718.github.io'),
  title: 'Palette Standard｜色を、伝わる情報に。',
  description:
    '色覚多様性に配慮し、画像の見え方を確認して、色・模様・縁取りで補正できるアクセシビリティ・ツール。',
  openGraph: {
    title: 'Palette Standard｜色を、伝わる情報に。',
    description: '画像の見え方を確認し、色・模様・縁取りで識別しやすい形へ補正。',
    url: 'https://yuka-718.github.io/palette-standard/',
    siteName: 'Palette Standard',
    locale: 'ja_JP',
    type: 'website',
    images: [{ url: '/palette-standard/og.png', width: 1200, height: 630, alt: 'Palette Standard — 色を、伝わる情報に。' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Palette Standard｜色を、伝わる情報に。',
    description: '画像の見え方を確認し、色・模様・縁取りで識別しやすい形へ補正。',
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
