# 2025 시설급여 평가 매뉴얼 앱

로컬에서 이어서 작업할 때:

```bash
git clone https://github.com/han20059-rgb/2025-yoyang-eval.git
cd 2025-yoyang-eval
npm install
cp .env.example .env.local   # 파일이 없으면 아래 이름만 채워도 됩니다
npm run dev -- -p 3042
```

원문 PDF는 `data/manual-store/official/2025-eval-manual.pdf`, 추출은 `data/manual-store/preview.json`입니다. 미리보기 재생성:

```bash
MANUAL_SKIP_OCR=1 npx tsx scripts/rebuild-preview-from-pdf.ts
npx tsx scripts/verify-workflows.ts
```

Windows PowerShell에서는 `$env:MANUAL_SKIP_OCR='1'` 뒤에 같은 명령을 씁니다.

## 환경변수 이름

값을 저장소에 넣지 않습니다. 배포(Vercel)와 `.env.local`에만 둡니다.

- `SITE_ACCESS_PASSWORD` — 사이트 전체 입장. 관리자 권한 없음. 없으면 입장 화면을 건너뜁니다.
- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용
- `EVAL_LOCAL_DATABASE_URL` — 로컬 Postgres가 있을 때만
- `EVAL_AI_API_KEY` — 없으면 AI 미연결, 실제 호출 없음
- `EVAL_AI_BASE_URL` / `EVAL_AI_MODEL` / `EVAL_AI_MAX_RUNS_PER_HOUR` — AI를 쓸 때만

직원·관리자 로그인은 기존 인증을 유지합니다. 연결 업무 파일 저장은 Vercel에서 차단됩니다.
