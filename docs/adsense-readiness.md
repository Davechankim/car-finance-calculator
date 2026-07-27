# AdSense 상업 운영 준비

최종 확인일: 2026-07-28

## 현재 상태

운영 주소는 현재 소유자 전용이라 AdSense 크롤러 심사를 받을 수 없으며,
실제 게시자 ID도 아직 설정하지 않았다. 따라서 이번 단계는 광고를 잘못
노출하지 않는 코드·콘텐츠·정책 준비까지이며 실제 수익은 발생하지 않는다.

사이트는 다음 조건을 한 중앙 설정에서 **모두** 확인하는 fail-closed 방식이다.

- `NEXT_PUBLIC_ADSENSE_ENABLED=true`
- `NEXT_PUBLIC_ADSENSE_CONSENT_READY=true`
- `NEXT_PUBLIC_ADSENSE_POLICY_READY=true`
- `NEXT_PUBLIC_ADSENSE_AUTO_ADS=false`
- 본인 계정의 유효한 `NEXT_PUBLIC_ADSENSE_CLIENT`
- 서로 다른 위치에 사용할 유효한 10자리 광고 슬롯 두 개
- 경로 없는 명시적 공개 HTTPS 원본 `NEXT_PUBLIC_SITE_URL`
- 실제 로그인 없이 공개됐음을 확인한 `NEXT_PUBLIC_SITE_PUBLIC=true`

하나라도 빠지거나 형식이 틀리면 광고 script, account meta, 슬롯 DOM과
`/ads.txt`가 함께 비활성화된다. 사이트 URL의 일반 메타데이터용 fallback은
AdSense 활성 판정에 사용하지 않는다. 계산 기능, 가이드, 계산 방법, 서비스
소개, 개인정보처리방침, 이용약관, sitemap과 robots는 광고와 독립적으로
동작한다. 가짜 ID나 다른 사람의 ID를 넣어 심사를 시도하지 않는다.

## 실제 수익화 전 필수 순서

1. 사용자 소유의 공개 HTTPS 도메인을 연결하고 로그인 없는 외부 네트워크에서
   실제 접근을 확인한다.
2. 운영 주체·연락처를 확정하고 호스팅/CDN의 접속 기록 항목, 목적, 보유기간,
   접근 주체와 국외 처리 여부를 실제 계약·설정에서 확인해 개인정보처리방침에
   반영한다.
3. AdSense 계정을 하나만 사용하고 사이트를 `Sites` 목록에 추가한다.
4. AdSense 운영 계정에서 **Auto ads를 OFF**로 유지한다. 이 프로젝트는 검토된
   고정 슬롯만 사용하며 계산 입력·결과 UI와 정책 페이지에는 Auto ads를 허용하지
   않는다. 추후 Auto ads를 검토하려면 별도 코드·정책 리뷰를 거쳐 계산기 영역과
   `/privacy`, `/terms`, `/about`을 페이지 제외 목록에 넣고 화면 증거를 남긴다.
5. AdSense의 Privacy & messaging에서 EEA·영국·스위스 대상 Google 인증 CMP를
   구성하고 IAB TCF v2.3 호환 상태를 확인한다. 동의·거부·세부 선택과 사후 철회
   링크가 실제 공개 주소의 모든 페이지에서 작동하는지 검증한다.
6. 운영 계정에서 실제 선택한 Google 및 제3자 광고기술 제공업체 목록과 각
   개인정보 링크가 CMP·개인정보처리방침에 노출되는지 확인한다.
7. 위 검증 증거를 남긴 뒤, **`npm run build`를 실행할 같은 환경**에 공개 주소,
   발급된 client와 두 광고 슬롯 ID를 설정한다. 그 환경에서만
   `NEXT_PUBLIC_ADSENSE_CONSENT_READY=true`,
   `NEXT_PUBLIC_ADSENSE_POLICY_READY=true`, `NEXT_PUBLIC_SITE_PUBLIC=true`,
   `NEXT_PUBLIC_ADSENSE_ENABLED=true`로 바꾸고
   `NEXT_PUBLIC_ADSENSE_AUTO_ADS=false`는 유지한다. `NEXT_PUBLIC_*` 값은
   브라우저 번들에 고정되므로 Sites 런타임에만 설정하면 광고를 활성화할 수 없다.
8. 같은 환경에서 `npm run build`, `npm run verify:adsense-release`,
   `npm run test:e2e` 순으로 실행한다. 값이 바뀌면 기존 `dist/`를 사용하지 않고
   다시 빌드한다. 전체 기본 검증은 `npm run release:check`로도 확인한다.
9. 페이지 소스의 `google-adsense-account` meta와 비동기 script를 확인하고
   `https://사용자도메인/ads.txt`에서 본인의 `pub-` ID가 정확히 보이는지 확인한다.
10. 사이트가 로그인 없이 크롤러에서 열리고 robots.txt가 차단하지 않는지 확인한다.
11. 광고 없는 상태와 활성 상태의 계산기·가이드·정책 페이지 링크, 모바일 화면,
    동의 철회 흐름과 속도를 확인한 뒤 심사를 요청한다.
12. 사이트 상태가 `Ready`가 된 뒤에만 광고 노출과 수익 발생을 기대한다.

공개 전환은 검색·광고 크롤러뿐 아니라 일반 이용자에게도 사이트가 열리는 운영
변경이다. 공개할 도메인과 정책 문구, 게시자 ID를 최종 확인한 뒤 별도 배포한다.

Google은 고유하고 충분한 콘텐츠, 명확한 내비게이션과 좋은 이용 경험을
심사한다. 광고 코드를 넣었다고 승인이 보장되지 않으며 검토에는 수일에서
경우에 따라 2~4주가 걸릴 수 있다.

공식 참고:

- [사이트 페이지 준비](https://support.google.com/adsense/answer/7299563)
- [새 사이트 관리와 Ready 상태](https://support.google.com/adsense/answer/12131223)
- [사이트 연결 코드와 meta](https://support.google.com/adsense/answer/7584263)
- [ads.txt 안내](https://support.google.com/adsense/answer/12171612)
- [개인정보처리방침 필수 고지](https://support.google.com/adsense/answer/1348695)
- [유럽 규정 메시지와 동의](https://support.google.com/adsense/answer/10961068)
- [Google 인증 CMP 요구사항](https://support.google.com/adsense/answer/13554116)
- [유럽 규정 메시지 관리](https://support.google.com/adsense/answer/10959060)
- [Google 파트너 사이트 정보 사용](https://policies.google.com/technologies/partner-sites)
- [광고기술 파트너 관리](https://support.google.com/admanager/answer/9012903)

## 광고 배치 원칙

- 광고는 `광고`라고 표시하고 계산 입력, 저장·초기화 버튼, 결과 탭과 시각적으로
  분리한다.
- 첫 슬롯은 계산기 설명 뒤, 두 번째 슬롯은 계산 결과 전체 뒤에만 둔다.
- 게시자 ID가 있어도 슬롯 ID가 없으면 빈 광고 상자를 만들지 않는다.
- 광고 차단 또는 네트워크 오류가 계산·저장·결과 표시를 방해하지 않게 한다.
- Auto ads는 코드 설정과 AdSense 운영 계정 모두에서 OFF로 유지한다.
- 계산 UI와 정책 페이지에는 검토된 고정 광고 슬롯 외 광고를 만들지 않는다.

## 동의 준비 플래그의 의미

`NEXT_PUBLIC_ADSENSE_CONSENT_READY=true`는 CMP를 설치하는 기능이 아니라 운영자가
실제 공개 배포에서 Google 인증 상태, TCF v2.3, 동의·거부·철회 링크, 실제 광고
파트너 고지를 직접 검증했다는 릴리스 확인값이다. 확인 전에는 `false`로 둔다.
현재 개인정보처리방침은 CMP가 아직 없다고 명시하며, 미래 기능을 이미 제공하는
것처럼 약속하지 않는다.

`NEXT_PUBLIC_ADSENSE_POLICY_READY=true`는 운영자·문의처, 호스팅/CDN 접속기록,
실제 광고기술 제공업체, 쿠키 선택권과 동의 철회 문구를 공개 배포 기준으로
확정했다는 별도 확인값이다. CMP만 준비됐거나 정책에 “미정” 문구가 남아 있으면
`false`로 유지한다.

## 자동 검증 범위

- Vitest는 no-env, 일부 env, 완전한 env 조합과 각 필수값 누락을 검사한다.
- 렌더러 테스트는 중앙 게이트가 닫히면 광고 DOM이 없음을 확인한다.
- 라우트 테스트는 같은 게이트가 닫히면 `/ads.txt`가 404인지 확인한다.
- Playwright는 기본 릴리스에서 script, meta, 슬롯과 `ads.txt`가 모두 닫혔는지
  브라우저·HTTP 수준에서 확인한다.
- `npm run verify:adsense-release`는 릴리스 환경의 부분 활성화를 실패시키고,
  테스트용 식별자를 차단하며 빌드된 `/`, `/privacy`, `/ads.txt`가 같은 활성
  상태인지 대조한다. 활성 릴리스에서는 client·두 슬롯·모든 공개 활성 플래그가
  한 `dist/client` 번들에 실제 빌드된 값으로 함께 들어갔는지도 확인해, 광고 OFF
  빌드 뒤 런타임 환경변수만 켠 상태를 거부한다.

자동 검증은 실제 AdSense 계정의 Auto ads 설정, CMP 인증 상태, 외부 공개 여부나
정책 문구의 법률 적합성을 대신 확인할 수 없다. 이 항목은 위 체크리스트의 운영
증거로 별도 확인한다.
