import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '서비스 소개',
  description: '자동차 금융 비교 계산기의 목적, 운영 원칙과 문의 채널',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <main className="info-page">
      <article className="info-card">
        <p className="eyebrow">서비스 소개</p>
        <h1>견적의 “싼 월납”을 실제 보유비용으로 바꿔 봅니다</h1>
        <p className="lead">
          자동차 금융 상품은 선납금, 보증금, 잔존가치와 만기 선택이 달라 광고에
          표시된 월납만으로 비교하기 어렵습니다. 이 서비스는 여러 견적을 같은
          보유기간과 같은 차량 수 기준으로 정리하기 위해 만들었습니다.
        </p>

        <h2>운영 원칙</h2>
        <ul>
          <li>계산 공식과 주요 가정을 공개하고 변경 이력을 Git으로 관리합니다.</li>
          <li>차량·사업자 입력은 브라우저에만 저장하며 계산 서버로 보내지 않습니다.</li>
          <li>세법 원문 수집과 실제 계산을 분리하고 승인된 규칙만 배포합니다.</li>
          <li>광고가 계산 버튼이나 결과처럼 보이지 않도록 명확히 구분합니다.</li>
          <li>오류를 발견하면 재현 테스트를 먼저 추가한 뒤 계산식을 수정합니다.</li>
        </ul>

        <h2>무료 제공과 광고</h2>
        <p>
          계산기의 핵심 기능은 무료로 제공합니다. 운영비를 충당하기 위해 Google
          AdSense를 사용할 수 있습니다. 서비스의 계산 코드는 입력값을 광고 요청에
          포함하지 않으며, 광고 활성화 여부와 Google이 처리할 수 있는 기술
          정보·쿠키 내용은 개인정보처리방침에 공개합니다.
        </p>

        <h2 id="contact">문의와 오류 제보</h2>
        <p>
          계산 오류나 개선 제안은 운영자의
          {' '}<a href="https://github.com/Davechankim" rel="noreferrer">GitHub 프로필</a>을
          통해 연락해 주세요. 제보할 때 개인정보나 실제 계약번호를 보내지 말고,
          재현에 필요한 익명화된 입력과 기대 결과만 전달해 주세요.
        </p>
        <p className="muted">최종 내용 검토일: 2026년 7월 28일</p>
      </article>
    </main>
  );
}
