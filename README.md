# 시험 사이트 (정적)

빌드 도구·프레임워크·외부 라이브러리 없이 **순수 HTML + CSS + 바닐라 JS**로 만든 정적 시험 사이트입니다.
GitHub Pages에 그대로 올려서 사용할 수 있습니다. 점수 기록·시간제한 기능은 없습니다.

## 폴더 구조

```
repo/
├── index.html          # 메인 메뉴
├── quiz.html           # 객관식 + 단답형 풀이 엔진 (모든 주차 공용)
├── essay.html          # 서술형 풀이 엔진
├── css/style.css
├── js/
│   ├── quiz.js
│   └── essay.js
├── data/
│   ├── index.json      # 주차 목록 (메뉴 자동 생성 / 합본 로드)
│   ├── week09.json     # 주차별 문제
│   └── essay.json      # 서술형 문제
└── README.md
```

## 1. 로컬에서 실행하기

데이터를 `fetch()`로 읽기 때문에 파일을 브라우저에서 직접(`file://`) 열면 동작하지 않습니다.
반드시 간단한 로컬 서버로 띄워서 접속하세요.

```bash
# 저장소 폴더 안에서
python3 -m http.server
```

그런 다음 브라우저에서 다음 주소로 접속합니다.

```
http://localhost:8000/
```

> Windows에서 `python3`가 없다면 `python -m http.server` 또는 `py -m http.server` 를 사용하세요.

## 2. 새 주차 추가하는 법

1. `data/week09.json` 을 복사해서 `data/week10.json` 처럼 새 파일을 만듭니다.
2. 새 파일 안의 `"week"` 값과 `"title"`, 그리고 `questions` 내용을 수정합니다.
3. `data/index.json` 의 `weeks` 배열에 한 줄을 추가합니다.

```json
{
  "weeks": [
    { "week": "09", "title": "9주차", "file": "week09.json" },
    { "week": "10", "title": "10주차", "file": "week10.json" }
  ],
  "essay": { "title": "서술형 문제", "file": "essay.json" }
}
```

`index.json` 에 등록한 주차만 메뉴에 나타나고, 합본(`?week=all`)에도 자동 포함됩니다.
(등록하지 않은 주차는 표시되지 않아 죽은 링크가 생기지 않습니다.)

### 문제 형식 (data/weekXX.json)

각 문제는 세 가지 `type` 중 하나입니다.

- `"single"` — 단일 정답. `choices: [{ "text": "...", "correct": true/false }]`, 정답 1개.
- `"multiple"` — 복수 정답. `choices` 동일, 정답 2개 이상. (부분점수 없음, 전부 일치만 정답)
- `"short"` — 단답형. `choices` 대신 `answers: ["정답", "허용표기2", ...]`. 하나만 맞아도 정답.

공통 선택 필드:

- `showCount` (single·multiple 전용, 숫자): 선지 중 일부만 표시. 정답 선지는 항상 전부 포함되고, 나머지는 오답에서 무작위로 채워 총 `showCount`개가 됩니다.
- `explanation` (문자열): 채점 결과 화면에 표시되는 해설.

### 채점 규칙

- `single`: 선택한 1개가 정답 선지면 정답.
- `multiple`: **표출된 선지 중** 정답을 전부 선택하고 오답은 하나도 선택하지 않아야 정답.
- `short`: 입력값과 `answers`를 정규화(`trim` + 영문 소문자화) 후 비교해 하나라도 같으면 정답. 빈 입력은 오답. (한글 띄어쓰기는 보정하지 않으므로 표기 변형은 `answers`로 대응)

### 서술형 (data/essay.json)

자동 채점이 없습니다. `modelAnswer`(모범답안)만 "정답 확인" 버튼으로 펼쳐 보여줍니다.
`\n` 은 줄바꿈으로 렌더됩니다.

## 3. GitHub Pages 배포

1. 이 저장소를 GitHub에 푸시합니다.
2. 저장소 **Settings → Pages** 로 이동합니다.
3. **Source** 를 `Deploy from a branch` 로 두고, 브랜치(`main`)와 폴더(`/root`)를 선택해 저장합니다.
4. 잠시 후 `https://<아이디>.github.io/<저장소>/` 에서 사이트가 열립니다.

모든 경로가 상대경로라 프로젝트 페이지(하위 경로) 환경에서도 그대로 동작합니다.

## 참고

정적 사이트라서 정답이 JSON에 들어 있고 개발자도구로 볼 수 있습니다.
친구들끼리 학습용으로 쓰는 용도이며 보안은 고려하지 않았습니다.
