# Claude Code 빌드 프롬프트

> 아래 `---` 사이 전체를 복사해서 Claude Code에 붙여넣으세요.

---

GitHub Pages에 그대로 올릴 수 있는 **정적 시험 사이트**를 만들어줘.

## 기술 제약 (중요)
- 빌드 도구·프레임워크·npm·번들러 없이 **순수 HTML + CSS + 바닐라 JS**만 사용.
- 외부 CDN/라이브러리 없이 동작하게 (오프라인에서도 열리게).
- **모든 경로는 상대경로**로 (`/`로 시작하지 말 것). 프로젝트 페이지 `https://아이디.github.io/저장소/` 하위에서도 작동해야 함.
- 데이터는 `fetch()`로 JSON을 읽음. `file://`로 직접 열면 fetch가 막히니, 로컬 테스트는 `python3 -m http.server`로 한다는 점을 README에 적어줘.
- localStorage 등 저장 기능은 쓰지 말 것 (점수 기록·시간제한 기능 없음).

## 폴더 구조 (정확히 이대로)
```
repo/
├── index.html          # 메인 메뉴
├── quiz.html           # 객관식+단답형 풀이 엔진 (모든 주차 공용)
├── essay.html          # 서술형 풀이 엔진
├── css/style.css
├── js/
│   ├── quiz.js
│   └── essay.js
├── data/
│   ├── index.json
│   ├── week09.json
│   └── essay.json
└── README.md
```

## 데이터 계약 (엔진은 반드시 이 형식을 읽어야 함)

### data/index.json — 주차 목록 (메뉴 자동 생성 / 합본 로드용)
```json
{
  "weeks": [
    { "week": "09", "title": "9주차", "file": "week09.json" }
  ],
  "essay": { "title": "서술형 문제", "file": "essay.json" }
}
```

### data/weekXX.json — 채점되는 시험 (객관식 + 단답형)
- 최상위: `{ "week": "...", "title": "...", "questions": [ ... ] }`
- 문제는 세 가지 `type`을 가질 수 있음:
  - `"single"` (단일정답): `choices: [{ "text": "...", "correct": true/false }]`, 정답 1개
  - `"multiple"` (복수정답): `choices` 동일, 정답 2개 이상
  - `"short"` (단답형): `choices` 대신 `answers: ["정답", "허용표기2", ...]`
- 공통 선택 필드: `showCount`(single·multiple 전용, 숫자), `explanation`(해설, 문자열)
```json
{
  "week": "09",
  "title": "9주차 · 예시",
  "questions": [
    {
      "id": "w09-1",
      "type": "single",
      "question": "단일 정답 예시 문제",
      "choices": [
        { "text": "보기 A", "correct": false },
        { "text": "보기 B", "correct": true },
        { "text": "보기 C", "correct": false },
        { "text": "보기 D", "correct": false }
      ],
      "explanation": "정답이 B인 이유."
    },
    {
      "id": "w09-2",
      "type": "multiple",
      "question": "복수 정답 예시 문제 (모두 고르시오)",
      "choices": [
        { "text": "보기 1", "correct": true },
        { "text": "보기 2", "correct": false },
        { "text": "보기 3", "correct": true },
        { "text": "보기 4", "correct": false }
      ],
      "explanation": "1번과 3번이 정답."
    },
    {
      "id": "w09-3",
      "type": "single",
      "showCount": 5,
      "question": "선지 7개 중 5개만 무작위로 보여주는 예시",
      "choices": [
        { "text": "정답", "correct": true },
        { "text": "오답1", "correct": false },
        { "text": "오답2", "correct": false },
        { "text": "오답3", "correct": false },
        { "text": "오답4", "correct": false },
        { "text": "오답5", "correct": false },
        { "text": "오답6", "correct": false }
      ],
      "explanation": "정답 1개 + 무작위 오답 4개 = 5개 표시."
    },
    {
      "id": "w09-4",
      "type": "short",
      "question": "단답형 예시 문제",
      "answers": ["메소포타미아", "메소포타미아 문명"],
      "explanation": "answers 중 하나만 맞아도 정답."
    }
  ]
}
```

### data/essay.json — 서술형 (자동 채점 없음)
```json
{
  "title": "서술형 문제",
  "questions": [
    { "id": "e-1", "question": "서술형 예시 문제", "modelAnswer": "모범답안.\n줄바꿈은 \\n." },
    { "id": "e-2", "question": "두 번째 서술형 예시", "modelAnswer": "모범답안." }
  ]
}
```

## 화면별 동작 명세

### index.html (메인 메뉴)
- `data/index.json`을 읽어 메뉴를 동적으로 생성.
- 각 주차 → `quiz.html?week=09` 형태 링크.
- "전체 합본" 항목 → `quiz.html?week=all`.
- "서술형" 항목 → `essay.html`.
- index.json에 없는 주차는 표시하지 않음(죽은 링크 금지).

### quiz.html + js/quiz.js (객관식 + 단답형 엔진)
1. URL 쿼리에서 `week` 읽기 (`?week=09` 또는 `?week=all`).
2. `week=all`이면 index.json의 모든 주차 파일을 불러와 questions를 **병합**. 특정 파일이 404여도 그 주차만 건너뛰고 콘솔 경고 후 진행(전체가 멈추면 안 됨). 단일 주차인데 파일이 없으면 사용자에게 안내 메시지 표시.
3. **문제 순서 셔플**(랜덤).
4. 각 문제 렌더링:
   - `single` → 라디오 버튼, `multiple` → 체크박스(“정답을 모두 고르세요” 안내 표시), `short` → 텍스트 입력칸.
   - **선지 순서도 셔플**.
   - `showCount`가 있고 그 문제 선지 수보다 작으면 **부분 표출**: 정답(correct:true) 선지는 **항상 전부 포함**하고, 나머지는 오답 중에서 무작위로 뽑아 총 showCount개가 되게 채운 뒤 셔플. (정답 개수 > showCount면 그 문제는 showCount 무시하고 전체 표시 + 콘솔 경고.)
5. 하단에 **“제출”** 버튼 1개. 풀이 중에는 정답/오답을 보여주지 않음(제출 후 일괄 채점).
6. 제출하면 채점 후 **결과 화면**: 총점(`맞은 수 / 전체 수`)과 문제별로 정오 표시 + 정답 + 해설(있으면). short는 허용 정답(answers)을 함께 표시.
7. **“다시 풀기”** 버튼: 문제·선지를 새로 셔플해서 처음부터. **“메뉴로”** 링크 제공.

### essay.html + js/essay.js (서술형 엔진)
- `data/essay.json`을 읽어 문제별 textarea 제공. 문제 순서 셔플.
- **“정답 확인”** 버튼 → 각 문제 아래에 모범답안(`modelAnswer`)을 펼쳐 보여줌(채점·점수 없음). `\n`은 줄바꿈으로 렌더.
- **“다시”**(입력 비우고 모범답안 숨김), **“메뉴로”** 링크 제공.

## 채점 규칙 (정확히)
- `single`: 선택한 1개가 정답 선지면 정답.
- `multiple`: **표출된 선지 중** 정답인 것을 전부 선택하고 오답은 하나도 선택하지 않아야 정답. **부분점수 없음(전부 일치만).**
- `short`: 입력값과 `answers` 각 항목을 **정규화 후 비교**해서 하나라도 같으면 정답. 정규화 = `값.trim().toLowerCase()` (앞뒤 공백 제거 + 영문 대소문자 무시). 한글 띄어쓰기는 보정하지 않음(표기 변형은 answers로 대응). 빈 입력은 오답.
- 정답 판정은 항상 **화면에 표출된 선지 기준**으로 계산.

## UI/스타일 (css/style.css)
- 한국어 UI. 모바일에서도 잘 보이게 반응형.
- 시스템 폰트 스택, 깔끔하고 읽기 쉬운 카드형 레이아웃. 정답=초록, 오답=빨강 정도의 명확한 표시.
- 과한 장식 없이 가독성 우선.

## 그 외
- 샘플 데이터(week09.json, essay.json, index.json)를 위 예시대로 생성해서 사이트가 **바로 실행**되게 할 것.
- `README.md`에: (1) 로컬 실행법(`python3 -m http.server` 후 브라우저로 접속), (2) 새 주차 추가법(weekXX.json 복사 → `week` 값 수정 → index.json에 한 줄 추가), (3) GitHub Pages 배포법(Settings → Pages → 브랜치 선택) 적기.
- 다 만든 뒤 로컬 서버로 직접 띄워서 메인 메뉴 → 주차 시험 → 제출/채점 → 다시 풀기, 합본, 서술형이 동작하는지 확인하고 결과를 알려줘.
- 참고: 정적 사이트라 정답이 JSON에 노출되어 개발자도구로 볼 수 있음. 친구들끼리 학습용이므로 보안은 요구하지 않음.

---
