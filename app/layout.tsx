import type { Metadata } from 'next';
import { getAdsenseConfig } from '@/lib/adsense';
import { siteUrl } from '@/lib/site';
import './globals.css';

const adsense = getAdsenseConfig();

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: '자동차 금융 비교 계산기',
    template: '%s | 자동차 금융 비교 계산기',
  },
  description:
    '장기렌트·운용리스·금융리스·할부의 월납, 잔여채무, 세금효과와 매각 비용을 같은 보유기간으로 비교합니다.',
  applicationName: '자동차 금융 비교 계산기',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  other: adsense.active
    ? { 'google-adsense-account': adsense.client }
    : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {adsense.active ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense.client}`}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body>
        <header className="site-header">
          <a className="site-brand" href="/">자동차 금융 비교</a>
          <nav className="site-nav" aria-label="주요 메뉴">
            <a href="/">계산기</a>
            <a href="/guide">사용 가이드</a>
            <a href="/methodology">계산 방법</a>
            <a href="/about">서비스 소개</a>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <nav aria-label="운영 정책">
            <a href="/privacy">개인정보처리방침</a>
            <a href="/terms">이용약관·면책</a>
            <a href="/about#contact">문의</a>
          </nav>
          <p>계약·세무 판단 전 금융회사와 세무 전문가의 확인이 필요합니다.</p>
        </footer>
      </body>
    </html>
  );
}
