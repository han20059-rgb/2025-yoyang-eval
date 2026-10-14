# 공통 Cursor 규칙·Wayfinder (Git 공유)

공통 원본: 근무표 저장소 `happy-01`. 집에서 clone/pull 하면 아래 파일이 함께 온다. PC 전역 스킬은 필요 없다.

grilling, domain-modeling, research, prototype, 이슈 트래커 문서는 이 저장소에 없다. Wayfinder **전문 절차는 미완성**이다. 공통 원칙(`.cursor/rules/dev-common.mdc`)은 그래도 적용된다. 없는 의존 스킬을 있다고 가정하지 않는다.

## 포함 파일

- `.cursor/rules/dev-common.mdc` — 매번 적용되는 공통 원칙
- `.cursor/skills/wayfinder/` — 큰 설계 절차 (`/wayfinder`). MIT, [mattpocock/skills](https://github.com/mattpocock/skills). `LICENSE`·`NOTICE` 유지
- `docs/cursor-shared-setup.md` — 이 안내

프로젝트 전용 규칙은 각 저장소에 그대로 둔다. 작업별 명세서는 각 `docs/`에 둔다.

## 집에서

```text
git clone <해당-저장소-URL>
git pull
```

1. clone/pull 한 **Git 루트**를 Cursor에서 연다.
2. 새 Agent 채팅을 연다.
3. 공통 원칙: 에이전트에게 `.cursor/rules/dev-common.mdc`를 **읽은 경로와 첫 줄**을 인용하라고 한다.
4. Wayfinder: 채팅에 `/wayfinder` (또는 `/` 검색). **Customize → Skills**에서도 확인한다.
5. 전역과 프로젝트가 둘 다 있으면, 에이전트에게 **실제로 연 SKILL.md의 전체 경로**를 쓰라고 한다.
   - 프로젝트: `<저장소>/.cursor/skills/wayfinder/SKILL.md` (Git 공유본, 상단에 Repo overlay)
   - 전역: `~/.cursor/skills/wayfinder/SKILL.md` (이 PC에만 있을 수 있음. 클론만으로는 생기지 않음)
6. 큰 설계가 아니면 `/wayfinder`를 치지 않아도 공통 원칙은 적용된다. 스킬 전문은 매번 자동 로드되지 않는다.

## 원본에서 다른 저장소로 맞추기

근무표 저장소에서:

```text
node scripts/sync-shared-cursor.mjs
```

대상이 Git 루트가 아니면 건너뛴다. 대상 파일이 원본과 다르면 **덮어쓰지 않고 중단**한다. 의도적으로 맞출 때만 `--force`.

기본 대상은 형제 폴더 `duty-100bill`과 `pg/.deploy-tmp`(평가 Git 루트). 다른 위치:

```text
node scripts/sync-shared-cursor.mjs --to "D:/work/duty-100bill" --to "D:/work/2025-yoyang-eval"
```

평가 앱의 실제 Git 루트는 `2025-yoyang-eval` 클론이다. `pg` 폴더 자체는 Git 루트가 아니다.

커밋·푸시는 승인된 뒤에 각 저장소에서 한다.
