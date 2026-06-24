# CampFit AI

우리아이 캠프핏 AI MVP입니다. 학부모 기본 조건, 자유서술 고민, AI 분석, 꼬리질문, 3분 캠프 영어 적응도 체크를 거쳐 샘플 캠프 Top 3를 추천합니다.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Zod
- Gemini API
- Supabase Postgres

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000/campfit`.

## Environment

Copy `.env.example` to `.env.local`.

```bash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

If Gemini or Supabase variables are missing, the app still runs with fallback analysis and skips persistence.

## Supabase

Run `supabase/campfit.sql` in the Supabase SQL editor. The service role key is used only in server Route Handlers.

## Test Scenarios

1. 영어 초급, 낯가림 높음, 한국인 관리자 필수, 영어 향상 목표: 관리형 영어몰입 캠프가 Stretch Fit으로 나와야 합니다.
2. 첫 해외경험, 부모 동반 선호, 안전 우선: 가족동반 ESL 또는 안정형 스쿨링이 Comfort Fit으로 나와야 합니다.
3. 영어 가능, 도전형, 한국인 관리자 불필요, 긴 기간: 뉴질랜드/캐나다형 캠프가 상위권으로 올라와야 합니다.

## Commands

```bash
npm run typecheck
npm run test
npm run build
```
