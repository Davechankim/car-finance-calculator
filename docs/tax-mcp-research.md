# 세금 데이터 MCP 연동 조사

최종 조사일: 2026-07-28

## 결론

세금 관련 공식 자료를 MCP로 연동할 수 있다. 다만 계산 요청마다 AI가 최신
법령을 읽고 세액을 해석하는 구조는 재현성과 감사 가능성이 낮으므로 사용하지
않는다.

권장 구조는 **공식 원문을 읽는 자체 MCP → 변경 검토 PR → 적용일이 고정된
규칙 스냅샷 → 결정론적 계산 엔진**이다. MCP는 자료 수집과 개정 감지까지만
담당하고, 실제 계산은 테스트를 통과한 버전별 규칙 파일을 사용한다.

```text
법제처·행정안전부 등 공식 원문
              ↓
        읽기 전용 자체 MCP
              ↓
원문 + 공고일·시행일·적용일 + 출처 URL + 콘텐츠 해시 + 변경 비교
              ↓
        사람 검토 및 테스트 PR
              ↓
      taxRules/KR/approved-*.json
              ↓
       자동차 금융 계산 엔진
```

브라우저는 MCP를 직접 호출하지 않는다. 수집·정규화·검증은 서버 또는 정기
작업에서 수행하고, 배포된 계산기는 승인된 규칙 스냅샷만 읽는다.

## 구현 상태

저장소에는 로컬·CI 관리자용 stdio MCP와 Codex 프로젝트 설정이 구현되어 있다.
`.codex/config.toml`은 신뢰된 프로젝트에서 `kr_tax_law` 서버를 시작하고,
`LAW_OPEN_API_OC`라는 환경변수 이름만 전달한다. 키 값은 설정 파일이나 저장소에
기록하지 않는다.

```bash
npm run tax:mcp:smoke
# 본인에게 발급된 LAW_OPEN_API_OC를 셸 환경에 설정한 경우
npm run tax:mcp:live-smoke
```

이 명령은 별도 stdio 프로세스에 연결해 도구 목록과 승인 스냅샷을 실제 MCP
JSON-RPC로 왕복 검증한다. 현재 도구는 모두 읽기 전용이다.
`live-smoke`는 같은 경로로 지방세법 제127조를 실조회해 API 신청·키·응답
스키마까지 확인하되 원문이나 키를 콘솔에 출력하지 않는다.

- `get_approved_tax_rule_snapshot`
- `get_official_law_article`
- `get_law_article_change_history`
- `review_law_article_changes`

승인 스냅샷 조회는 API 키 없이 동작한다. 공식 원문 도구는 키가 없을 때
`LAW_OPEN_API_OC` 설정 오류로 안전하게 종료하며, 임의 URL·신고·납부·승인·쓰기
기능은 제공하지 않는다. 프로젝트 설정 변경은 새 Codex 세션 또는 클라이언트
재시작 후 활성화되고 `/mcp` 또는 `codex mcp list`로 확인할 수 있다.

계산 엔진은 `tax-rules/approved/KR/2026.json`을 스키마 검증·동결한
`KR-2026-car-finance` 규칙만 읽는다. MCP 원문 응답이 이 파일을 자동 변경하는
경로는 없다.

## 공식 API 호출 계약

현행 조문은 법령명 allowlist의 정확한 이름으로
`https://www.law.go.kr/DRF/lawSearch.do`의 `target=eflaw`, `nw=3`,
`type=JSON`, `display=100`을 조회한다. 검색 응답에서 정확히 일치하는 하나의
`법령ID`, `법령일련번호(MST)`, `시행일자(efYd)`를 고른 뒤
`https://www.law.go.kr/DRF/lawService.do`에
`target=eflaw&MST=...&efYd=...&JO=...`로 본문을 요청한다.

`ID`만 사용하는 현행 본문 조회는 `efYd`가 무시되어 특정 시행본을 재현할 수
없으므로 사용하지 않는다. 조문 번호는 제127조를 `012700`, 제10조의2를
`001002`처럼 6자리 `JO`로 정규화한다. 변경 이력은 안정적인 법령 ID와 `JO`를
`target=lsJoHstInf`에 전달한다.

공식 API는 오류도 HTTP 200, HTML, 빈 본문 또는 예상과 다른 JSON으로 반환할 수
있다. 따라서 구현은 HTTPS·정확한 호스트·고정 경로, 리디렉션 금지, JSON MIME,
1MiB 응답 한도, 타임아웃, 예상 root와 성공 코드, 필수 식별자·본문을 모두
검증하고 모르는 응답은 실패 처리한다. 검색 결과의 단건 객체/복수 배열과
강조 표시 객체도 정규화한다.

응답의 `법령상세링크`에는 `OC`가 포함될 수 있으므로 반환 전에 키와 `OC` 쿼리를
제거한다. MCP가 내보내는 출처 endpoint에는 인증 쿼리를 넣지 않는다.

## 공식 데이터 원천

| 원천 | 용도 | 적합성 및 제한 |
|---|---|---|
| [국가법령정보 공동활용 API](https://open.law.go.kr/LSO/information/service.do) | 법률·시행령·시행규칙·행정규칙·자치법규 및 변경 이력 | 자체 MCP의 주 원천으로 적합. 이용 신청, 호출 제한, 출처 표시 조건을 준수해야 한다. |
| [행정안전부 2026 차량 시가표준액 고시](https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000016&nttId=122833) | 차량 시가표준액 산정용 기준가격 | 전용 JSON API가 아니라 첨부파일 중심이다. 실제 취득세 과세표준은 취득 유형·신고가액·해당 조문에 따라 별도 판정해야 한다. |
| [2026-05-27 기준가격 재산정·추가산정 고시](https://law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=2100000279896) | 원 고시 이후 정정·추가 값 | 재산정분과 추가산정분의 적용 시점이 다를 수 있다. 원 고시 하나가 아니라 후속 고시까지 수집해 납세의무 성립일 기준으로 값을 선택해야 한다. |
| [공공데이터포털 목록조회 API](https://www.data.go.kr/data/15077093/openapi.do) | 관련 공식 API 탐색과 메타데이터 조회 | REST JSON/XML을 제공하지만 실제 데이터별 승인·트래픽·이용조건은 별도로 확인해야 한다. |
| [국세청 종합소득세 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7666&mi=2227) | 개인 소득세율 검증 | 공개 계산 API보다는 안내 페이지 중심이다. 세율은 매출이 아니라 과세표준에 적용해야 한다. |
| [국세청 법인세 안내](https://j.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7746&mi=2372) | 법인 세율과 누진공제 검증 | 2026년 영리법인 구간은 과세표준 기준 10%·20%·22%·25%다. |
| [지방세법 제127조](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029491353) | 배기량별 자동차세와 차령 경감 | 소유형 차량의 보유비용 규칙에 필요하다. |
| [지방세법 제151조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1021868417) | 자동차세분 지방교육세 | 자동차세와 별도 규칙으로 함께 버전 관리해야 한다. |

국가법령정보센터 자료는 참고자료이며 법적 효력은 관보 등에 있다는
[공식 안내](https://www.law.go.kr/LSW/lawPetitionForm.do?menuId=13&query=&subMenuId=79)도
결과 화면과 운영 절차에 반영한다.

## 공개 MCP 조사 결과

[공식 MCP Registry](https://modelcontextprotocol.io/registry/about)는 아직 Preview
단계이며, 조사일 기준 HomeTax·Wetax·한국 자동차세를 생산 환경에서 바로 사용할
수 있는 공식 등록 서버는 확인하지 못했다. Registry 미등록이 구현체 부재를
뜻하지는 않는다.

[Registry 등록](https://modelcontextprotocol.io/registry/about#security-scanning)은
namespace와 배포 메타데이터 확인에 도움을 줄 뿐, 서버 코드의 안전성이나 세법
정확성을 보증하지 않는다. 패키지 코드·의존성·운영 주체는 별도로 검증해야 한다.

참고 가능한 커뮤니티 구현체는 다음과 같다.

- [finalchild/law-mcp](https://github.com/finalchild/law-mcp): 법제처 API를
  사용하지만 저장소가 실험적 구현임을 명시하고 특정 클라이언트의 파일 읽기에
  의존한다.
- [ChangooLee/mcp-kr-legislation](https://github.com/ChangooLee/mcp-kr-legislation):
  법령 도구 범위는 넓지만 연결·신청 안내와 기본 전송 설정을 현재 공식 절차 및
  HTTPS 기준으로 다시 검증해야 한다.
- [aeriis-kr/opendata-mcp](https://github.com/aeriis-kr/opendata-mcp):
  공공데이터포털 범용 호출 구현이다. 외부 중계 서버, 사용자가 지정하는 호출
  대상, 서비스키 전달 구조를 그대로 생산 환경에 도입하면 SSRF 또는 키 유출
  위험이 있으므로 참고 코드로만 취급한다.

따라서 커뮤니티 서버를 계산기의 생산 의존성으로 추가하지 않고, 필요한 공식
원천만 좁게 감싼 읽기 전용 MCP를 자체 구현하는 것이 적절하다.

## 권장 MCP 도구

현재 구현된 조문·스냅샷 도구 외에 다음 단계에서 고려할 도구는 아래 두 개다.

- `get_vehicle_standard_value(officialVehicleKey, taxLiabilityDate)`
- `list_pending_rule_changes()`

`get_approved_tax_rule_snapshot`은 승인·커밋된 스냅샷만 조회하며 새 규칙을
생성하거나 법령을 해석하지 않는다. 변경 후보 생성은 별도 PR 파이프라인에서만
수행한다. 차량 식별키가 모호하면 첫 검색 결과를 임의 선택하지 않고 후보 목록과
`reviewRequired`를 반환한다.

각 원천 값에는 최소한 `sourceNoticeId`, `publishedAt`, `effectiveFrom`,
`appliesFrom`, `supersedes`, `retrievedAt`, 원문 URL·콘텐츠 해시·파서 버전을
포함한다. 규칙이 없거나 해석이 모호한 경우 추정값을 만들지 않고 명시적인 오류
또는 `reviewRequired` 상태를 반환한다.

## 필수 안전장치

1. HTTPS와 공식 도메인 allowlist만 허용한다.
2. 법령 조회 외 임의 URL 호출을 금지하고 리디렉션 후 호스트도 다시 검증한다.
3. API 키는 서버에서만 보관하며 로그·브라우저·MCP 응답에 노출하지 않는다.
4. 조회 도구는 읽기 전용으로 제한하고 신고·납부·개인 세무정보 조회 도구는
   만들지 않는다.
5. 원문과 정규화 결과를 함께 보존하고 공고일·시행일·적용일 기준으로 버전 관리한다.
6. 법령 변경은 자동 배포하지 않는다. 출처 검증, 수치 골든 테스트, 사람의
   승인을 모두 통과한 PR만 규칙 스냅샷에 반영한다.
7. 홈택스·위택스 로그인이나 인증서·자동입력 방지 화면을 UI 자동화로 우회하지
   않는다.
8. HWPX·ZIP 등 첨부파일은 불신 입력으로 취급한다. MIME/magic, 파일·해제
   크기, entry 수, 경로와 심볼릭링크를 검증하고 zip-slip·zip-bomb·XXE·외부
   네트워크 참조를 차단한 샌드박스 파서에서 시간 제한과 함께 처리한다. 원본
   바이트와 해시는 불변 보관한다.
9. MCP 원문은 LLM에 대한 지시가 아니라 데이터로 격리해 prompt injection을
   신뢰 경계 밖에 둔다.
10. 과세표준 등 민감 재무정보는 기본적으로 브라우저에서만 처리하고 MCP·로그·
    텔레메트리에 전송하지 않으며, 사용자가 명시하지 않으면 영구 저장하지 않는다.

납세자와 차량 속성도 하나의 `businessType`으로 합치지 않는다. 최소한
`entityType`, `vatRegime`(일반·간이·면세·겸영), `vehicleTaxUseClass`,
`taxableBusinessUsePct`, `evidenceStatus`, `jurisdiction`,
`taxLiabilityDate`를 독립된 입력으로 관리한다.

## 계산 정확도 개선과의 연결 순서

1. 금융기간과 실제 보유기간을 분리한다.
2. 차량 처분손익과 출구별 세금을 먼저 계산한 뒤 세후 최적 출구를 선택하는
   연도별 세금 원장을 만든다.
3. 실제 월납을 금융 원리금, 보험·자동차세·정비·서비스비로 분리한다. 운용리스
   정비비가 구분되면 실제 구성으로 계산하고, 구분되지 않을 때만 보험·자동차세
   차감 후 금액의 7%를 정비비로 보는 대체 규칙을 사용한다.
4. 연도별 과세표준과 개인·법인지방소득세를 반영한다. 단일 한계세율은 누진구간
   경계를 생략하는 명시적 시나리오 override로만 제공하고 불확실성 범위를 표시한다.
5. VAT 과세유형·업무사용비율·증빙 여부와 보험 가입일수, 감가상각 한도 초과액
   이월을 연도별 원장에 반영한다.
6. 소유형 차량의 자동차세와 지방교육세를 반영한다.
7. 차량 시가표준액을 원 고시와 후속 재산정·추가산정 고시 단위로 생성하고
   납세의무 성립일에 맞는 값을 선택한다.
8. 경차 취득세 75만원 감면 등 일몰 규칙은 적용 종료일을 데이터에 강제하고
   경계 연도 테스트를 둔다.
9. 법제처 MCP로 관련 조문·고시·시행일·적용일 변경을 감지한다.

MCP 자체를 먼저 붙여도 현재 계산 모델의 입력·원장이 부족하면 정확도가
자동으로 높아지지 않는다. 위 순서대로 계산 구조를 먼저 개선하고, MCP는 그
규칙의 최신성·출처·변경 이력을 관리하는 계층으로 도입한다.
