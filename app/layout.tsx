import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '자동차 금융 비교 계산기',
  description: '장기렌트·운용리스·금융리스·할부를 자유 조합으로 비교',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
