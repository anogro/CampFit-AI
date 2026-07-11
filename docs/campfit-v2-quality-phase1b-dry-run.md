# CampFit v2 품질평가 Phase 1B-1 Pilot Dry-run 보고서

## 1. 실행 개요

- 작업 ID: `QUALITY-PHASE1B-1-RUNNER-DRYRUN`
- 대상 Supabase project ref: `lhgigsnwvzjoqxdjrhaw`
- 첫 성공 실행: 2026-07-11 15:28:05 KST (`2026-07-11T06:28:05.447Z`)
- 두 번째 성공 실행: 2026-07-11 15:28:35 KST (`2026-07-11T06:28:35.076Z`)
- 실행 모드: production read-only dry-run
- Backfill version: `quality-phase1b-v1`
- Mapper version: `legacy-mapper-v1`
- Backfill run ID: `740bc030-7d5a-52d1-8567-379c51b59466`
- 실제 production write: 실행하지 않음

## 2. Pilot 프로그램

| 정렬 순서 | 프로그램 ID | 프로그램 이름 | Legacy rows |
|---:|---|---|---:|
| 1 | `1cb1a728-03d5-4bce-ad16-71ca03a4477e` | 란나 국제학교 치앙마이 여름 캠프 2026 | 1 |
| 2 | `bd54f391-4315-41ee-96aa-27bdb63dd5a6` | 세부 블루오션 2027 겨울방학 가족캠프 | 1 |
| 3 | `d1ea93fc-873a-416a-bac4-6aaeaf8952da` | GITC 세부 2026 여름방학 영어캠프 | 1 |
| 4 | `f6dcee13-6d60-4891-b72c-510d1d5ad726` | 2026 와우영어캠프 사이판 아이만 참가 PIC 여름방학 영어캠프 | 2 |
| 5 | `fa6fa0f8-ecec-486e-bcfa-ca299fd978af` | 2026 와우영어캠프 사이판 PIC 여름방학 영어캠프 3주 | 2 |

합계는 5개 프로그램, 7개 legacy verification row다.

## 3. Evidence 및 observation 계획

| 항목 | Create | Reuse | Drift |
|---|---:|---:|---:|
| Evidence source | 7 | 0 | 0 |
| Metadata observation | 42 | 0 | 0 |

- Legacy verification 1개당 deterministic evidence candidate 1개를 계획했다.
- Legacy verification 1개당 `legacy_completeness.*` observation 6개를 계획했다.
- 기존 품질 테이블이 비어 있어 모든 candidate action은 `create`다.
- Dry-run에서는 insert, update, delete, upsert를 호출하지 않았다.

## 4. Scoring 및 공개 상태

| 지표 | 결과 |
|---|---:|
| Scoring-eligible facts | 0 |
| Dimension inputs | 0 |
| Evidence confidence | 0 |
| Dimension coverage | 0 |
| Independent sources | 0 |
| Overall quality score | `null` |
| Public eligible | `false` |
| Public status | `운영 정보 확인 중` |

Legacy completeness 값은 품질점수 fact로 승격하지 않았다. 따라서 모든 프로그램은 실패 상태가 아니라 정상적인 `no_scoring_eligible_evidence` shadow 상태다.

## 5. Shadow snapshot 계획

| 프로그램 ID | Action | Snapshot ID | Input hash |
|---|---|---|---|
| `1cb1a728-03d5-4bce-ad16-71ca03a4477e` | create | `f968003d-15d7-5fb2-9078-b18206cb7f41` | `759c2d4efdfc716e1b46389b79050aa83eb841eef7180d2408138c4ddfc21c15` |
| `bd54f391-4315-41ee-96aa-27bdb63dd5a6` | create | `a6c75db6-b950-531a-8da0-f9f6fa76a7e9` | `adbae2cfaf625a4b8ad0db4cb2034adf1139d23bb402c1ac2b55a69c33c40556` |
| `d1ea93fc-873a-416a-bac4-6aaeaf8952da` | create | `a78da292-b45e-5ddd-8579-5138f7e1b5eb` | `74229d2c569934e560c1281db27ee86b2eb42b51c35f7ff0e0cfc4de90153bd2` |
| `f6dcee13-6d60-4891-b72c-510d1d5ad726` | create | `9ac38f49-4ac0-58d1-8c4f-75b588008048` | `9e8368d7fa93e28642cf32181beae126c79e9df8750ed8de736c2676a8d9da05` |
| `fa6fa0f8-ecec-486e-bcfa-ca299fd978af` | create | `30f75c49-641f-55f9-8519-891c10cb9a45` | `97275ceb0adff7267255e4182ce11d63ae1171afe39bd2eb9286a154a885c7e5` |

Dimension score candidate는 0개다. 기존 snapshot supersede도 실행하지 않았다.

## 6. 결정성 검증

- 첫 report hash: `63dc420951fe09b9c25ff4692a34bbc765e59534c25ec4e868f994dafc77a9b6`
- 두 번째 report hash: `63dc420951fe09b9c25ff4692a34bbc765e59534c25ec4e868f994dafc77a9b6`
- 동일 여부: 동일
- 두 실행의 backfill run ID, 정렬된 프로그램, evidence/observation/snapshot ID, create/reuse/drift 계획, totals, warnings 및 unresolved 요약이 동일했다.
- 실행 시각은 달랐지만 deterministic hash 입력에서 제외됐다.

## 7. Exact DB count 전후

| 품질 테이블 | 첫 실행 전 | 첫 실행 후 | 두 번째 실행 전 | 두 번째 실행 후 |
|---|---:|---:|---:|---:|
| `program_evidence_sources` | 0 | 0 | 0 | 0 |
| `program_fact_observations` | 0 | 0 | 0 | 0 |
| `program_quality_scores` | 0 | 0 | 0 | 0 |
| `program_quality_dimension_scores` | 0 | 0 | 0 | 0 |
| `program_critical_risk_flags` | 0 | 0 | 0 | 0 |

- Mutation dependency factory 호출: 0
- Writer 호출: 0
- Supabase mutation 호출: 0

## 8. Warnings 및 unresolved

- 모든 프로그램 status: `completed`
- Warning: 없음
- Error: 없음
- `legacy_risk_labels_require_manual_review`:
  - `1cb1a728-03d5-4bce-ad16-71ca03a4477e`
  - `f6dcee13-6d60-4891-b72c-510d1d5ad726`
- Risk label 원문은 출력하거나 신규 품질 row로 변환하지 않았다.

## 9. 실제 write 승인 전 체크리스트

- [x] 동일 pilot 5개 dry-run 2회 exit code 0
- [x] 두 deterministic report hash 일치
- [x] 모든 프로그램 `completed`
- [x] Evidence 7, observations 42, snapshots 5 계획 확인
- [x] Scoring facts 0, dimension inputs 0 확인
- [x] Exact DB count 전후 동일
- [x] Mutation dependency 0, writer 0, Supabase mutation 0 확인
- [x] Typecheck, 전체 test, production build 통과
- [ ] Production Supabase mutation adapter 구현 및 별도 검증
- [ ] Evidence/observation/snapshot payload 최종 수동 감사
- [ ] `legacy_risk_labels_require_manual_review` 2개 프로그램 수동 확인
- [ ] 정확한 write 명령에 대한 사용자 별도 승인

현재 CLI에는 production mutation adapter가 연결되어 있지 않으므로 실제 pilot write 승인은 아직 준비되지 않았다. 아래 명령은 adapter 연결·재검증·별도 승인 이후에만 사용한다.

## 10. CLI와 server-only 경계 검증

- Next.js wrapper인 `programVerificationBackfillRepository.ts`는 `import "server-only"`를 유지한다.
- 공용 read 계약, row 검증, mapper는 CLI import가 가능한 순수 모듈로 분리했다.
- CLI는 `scripts/campfit`의 전용 Supabase read adapter를 사용하며 Next.js server-only repository를 import하지 않는다.
- `vitest.config.ts`의 `server-only` 대체 플러그인을 제거했다. 우회가 없는 일반 Vite/Node 런타임에서 직접 import가 실패하는 것을 회귀 테스트로 확인했다.
- Next.js source root에서 CLI로 이어지는 import edge가 없음을 회귀 테스트로 확인했다.
- 실제 `npm run campfit:quality:backfill` 2회 성공으로 `@/` path alias 해석과 `.env.local` 로딩을 함께 확인했다.
- CLI 출력에는 Supabase project ref만 포함하며 전체 URL과 service-role key는 출력하지 않는다.
- 최종 검증은 typecheck, 전체 39개 test file/174개 test, production build 모두 exit code 0이다.

## 11. 승인 후 사용할 정확한 write 명령

```powershell
npm run campfit:quality:backfill -- --write --program-ids=fa6fa0f8-ecec-486e-bcfa-ca299fd978af,f6dcee13-6d60-4891-b72c-510d1d5ad726,bd54f391-4315-41ee-96aa-27bdb63dd5a6,1cb1a728-03d5-4bce-ad16-71ca03a4477e,d1ea93fc-873a-416a-bac4-6aaeaf8952da --confirm-program-count=5 --confirm-production-write=QUALITY_PHASE1B_PILOT --expected-project-ref=lhgigsnwvzjoqxdjrhaw
```

`--limit`은 write mode에서 금지된다. 이 보고서 작성 시점에는 위 명령을 실행하지 않았다.
