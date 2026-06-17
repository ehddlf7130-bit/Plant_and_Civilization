(function () {
  'use strict';

  var titleEl = document.getElementById('quiz-title');
  var statusEl = document.getElementById('quiz-status');
  var formEl = document.getElementById('quiz-form');
  var quizActions = document.getElementById('quiz-actions');
  var submitBtn = document.getElementById('submit-btn');
  var resultEl = document.getElementById('result');
  var resultActions = document.getElementById('result-actions');
  var retryBtn = document.getElementById('retry-btn');

  // 현재 화면에 표출된(준비된) 문제 목록을 보관
  var preparedQuestions = [];
  // "다시 풀기"를 위해 원본 문제 목록을 보관
  var originalQuestions = [];

  // ---------- 유틸 ----------
  function getParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function normalize(s) {
    return String(s == null ? '' : s).trim().toLowerCase();
  }

  function showStatus(html, isError) {
    statusEl.hidden = false;
    statusEl.innerHTML = '';
    var p = el('p', isError ? 'error' : 'loading', html);
    statusEl.appendChild(p);
  }

  // ---------- 데이터 로드 ----------
  function loadWeek(file) {
    return fetch('data/' + file)
      .then(function (res) {
        if (!res.ok) throw new Error(file + ' 로드 실패: ' + res.status);
        return res.json();
      });
  }

  function loadIndex() {
    return fetch('data/index.json').then(function (res) {
      if (!res.ok) throw new Error('index.json 로드 실패: ' + res.status);
      return res.json();
    });
  }

  function start() {
    var week = getParam('week');
    if (!week) {
      showStatus('주차가 지정되지 않았습니다. 메뉴에서 선택해 주세요.', true);
      return;
    }

    loadIndex()
      .then(function (index) {
        var weeks = (index && Array.isArray(index.weeks)) ? index.weeks : [];

        if (week === 'all') {
          titleEl.textContent = '전체 합본';
          // 모든 주차 파일을 개별 로드 — 404는 건너뛰고 계속
          var loads = weeks.map(function (w) {
            return loadWeek(w.file)
              .then(function (data) {
                return (data && Array.isArray(data.questions)) ? data.questions : [];
              })
              .catch(function (err) {
                console.warn('합본: ' + w.file + ' 건너뜀 -', err.message);
                return [];
              });
          });
          return Promise.all(loads).then(function (groups) {
            var merged = [];
            groups.forEach(function (g) { merged = merged.concat(g); });
            return { title: '전체 합본', questions: merged };
          });
        }

        // 단일 주차
        var entry = weeks.filter(function (w) { return String(w.week) === String(week); })[0];
        if (!entry) {
          throw new Error('NOT_LISTED');
        }
        return loadWeek(entry.file).then(function (data) {
          return {
            title: data.title || (entry.title || (week + '주차')),
            questions: (data && Array.isArray(data.questions)) ? data.questions : []
          };
        });
      })
      .then(function (bundle) {
        titleEl.textContent = bundle.title || '시험';
        if (!bundle.questions || bundle.questions.length === 0) {
          showStatus('표시할 문제가 없습니다.', true);
          return;
        }
        statusEl.hidden = true;
        renderQuiz(bundle.questions);
      })
      .catch(function (err) {
        console.error(err);
        if (err.message === 'NOT_LISTED') {
          showStatus('해당 주차를 찾을 수 없습니다. 메뉴에서 다시 선택해 주세요.', true);
        } else {
          showStatus('문제를 불러오지 못했습니다. (로컬은 python3 -m http.server 로 실행하세요)', true);
        }
      });
  }

  // ---------- 문제 준비(셔플 + showCount 부분표출) ----------
  function prepareQuestions(rawQuestions) {
    var questions = shuffle(rawQuestions);

    return questions.map(function (q) {
      var prepared = {
        id: q.id,
        type: q.type,
        question: q.question,
        explanation: q.explanation,
        answers: q.answers,
        choices: null
      };

      if (q.type === 'single' || q.type === 'multiple') {
        var choices = Array.isArray(q.choices) ? q.choices.slice() : [];
        var correctOnes = choices.filter(function (c) { return c.correct; });
        var wrongOnes = choices.filter(function (c) { return !c.correct; });

        var shown = choices;
        var showCount = q.showCount;
        if (typeof showCount === 'number' && showCount < choices.length) {
          if (correctOnes.length > showCount) {
            console.warn('문제 "' + (q.id || q.question) +
              '": 정답 개수(' + correctOnes.length + ')가 showCount(' + showCount +
              ')보다 큼 → showCount 무시하고 전체 표시.');
            shown = choices;
          } else {
            var need = showCount - correctOnes.length;
            var pickedWrong = shuffle(wrongOnes).slice(0, need);
            shown = correctOnes.concat(pickedWrong);
          }
        }
        prepared.choices = shuffle(shown);
      }

      return prepared;
    });
  }

  // ---------- 렌더 ----------
  function renderQuiz(rawQuestions) {
    originalQuestions = rawQuestions;
    preparedQuestions = prepareQuestions(rawQuestions);

    formEl.innerHTML = '';
    resultEl.hidden = true;
    resultEl.innerHTML = '';
    resultActions.hidden = true;
    quizActions.hidden = false;
    window.scrollTo(0, 0);

    preparedQuestions.forEach(function (q, idx) {
      var card = el('div', 'question');
      var head = el('div', 'question-head');
      head.appendChild(el('span', 'q-number', (idx + 1) + '.'));
      head.appendChild(el('span', 'q-text', q.question || ''));
      card.appendChild(head);

      if (q.type === 'single' || q.type === 'multiple') {
        if (q.type === 'multiple') {
          card.appendChild(el('div', 'q-hint', '정답을 모두 고르세요'));
        }
        var choicesWrap = el('div', 'choices');
        q.choices.forEach(function (c, ci) {
          var label = el('label', 'choice');
          var input = document.createElement('input');
          input.type = (q.type === 'single') ? 'radio' : 'checkbox';
          input.name = 'q' + idx;
          input.value = String(ci);
          label.appendChild(input);
          label.appendChild(el('span', null, c.text));
          choicesWrap.appendChild(label);
        });
        card.appendChild(choicesWrap);
      } else if (q.type === 'short') {
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'short-input';
        inp.name = 'q' + idx;
        inp.autocomplete = 'off';
        inp.placeholder = '답을 입력하세요';
        card.appendChild(inp);
      }

      formEl.appendChild(card);
    });
  }

  // ---------- 채점 ----------
  function gradeQuestion(q, idx) {
    var result = { correct: false, type: q.type };

    if (q.type === 'single') {
      var picked = formEl.querySelector('input[name="q' + idx + '"]:checked');
      var pickedIdx = picked ? parseInt(picked.value, 10) : -1;
      result.pickedIdx = pickedIdx;
      result.correct = (pickedIdx >= 0 && q.choices[pickedIdx] && q.choices[pickedIdx].correct === true);
    } else if (q.type === 'multiple') {
      var nodes = formEl.querySelectorAll('input[name="q' + idx + '"]:checked');
      var pickedSet = {};
      Array.prototype.forEach.call(nodes, function (n) {
        pickedSet[parseInt(n.value, 10)] = true;
      });
      result.pickedSet = pickedSet;
      // 표출된 선지 기준: 정답은 모두 선택 + 오답은 하나도 선택 안 함
      var allMatch = true;
      q.choices.forEach(function (c, ci) {
        var isPicked = !!pickedSet[ci];
        if (c.correct && !isPicked) allMatch = false;
        if (!c.correct && isPicked) allMatch = false;
      });
      // 최소 한 개의 정답이 존재한다고 가정. 아무것도 안 골랐고 정답이 있으면 오답.
      result.correct = allMatch;
    } else if (q.type === 'short') {
      var field = formEl.querySelector('input[name="q' + idx + '"]');
      var val = field ? field.value : '';
      result.input = val;
      var nv = normalize(val);
      if (nv === '') {
        result.correct = false;
      } else {
        var answers = Array.isArray(q.answers) ? q.answers : [];
        result.correct = answers.some(function (a) { return normalize(a) === nv; });
      }
    }

    return result;
  }

  function renderResult() {
    var total = preparedQuestions.length;
    var correctCount = 0;
    var graded = preparedQuestions.map(function (q, idx) {
      var g = gradeQuestion(q, idx);
      if (g.correct) correctCount++;
      return g;
    });

    resultEl.innerHTML = '';

    // 점수 카드
    var scoreCard = el('div', 'score-card');
    var score = el('div', 'score', correctCount + ' / ' + total);
    scoreCard.appendChild(score);
    scoreCard.appendChild(el('div', 'score-label', '맞은 수 / 전체 수'));
    resultEl.appendChild(scoreCard);

    // 문제별 결과
    preparedQuestions.forEach(function (q, idx) {
      var g = graded[idx];
      var card = el('div', 'result-q ' + (g.correct ? 'is-correct' : 'is-wrong'));

      var head = el('div', 'question-head');
      var num = el('span', 'q-number', (idx + 1) + '.');
      head.appendChild(num);
      var qtext = el('span', 'q-text', q.question || '');
      head.appendChild(qtext);
      var verdict = el('span', 'verdict ' + (g.correct ? 'ok' : 'no'), g.correct ? '정답' : '오답');
      head.appendChild(verdict);
      card.appendChild(head);

      if (q.type === 'single' || q.type === 'multiple') {
        var ul = el('ul', 'result-choices');
        q.choices.forEach(function (c, ci) {
          var li = el('li', null);
          var isPicked = (q.type === 'single')
            ? (g.pickedIdx === ci)
            : !!(g.pickedSet && g.pickedSet[ci]);

          li.appendChild(document.createTextNode(c.text));

          if (c.correct) {
            li.className = 'c-correct';
            var t1 = el('span', 'tag', '  ✓ 정답');
            li.appendChild(t1);
            if (isPicked) {
              var t2 = el('span', 'tag', ' (내 선택)');
              li.appendChild(t2);
            }
          } else if (isPicked) {
            li.className = 'c-wrong-pick';
            var t3 = el('span', 'tag', '  ✗ 내 선택');
            li.appendChild(t3);
          }
          ul.appendChild(li);
        });
        card.appendChild(ul);
      } else if (q.type === 'short') {
        var myLine = el('div', 'answer-line');
        myLine.innerHTML = '';
        var myStrong = el('strong', null, '내 답: ');
        myLine.appendChild(myStrong);
        myLine.appendChild(document.createTextNode(g.input && g.input.trim() ? g.input : '(빈칸)'));
        card.appendChild(myLine);

        var ansLine = el('div', 'answer-line');
        var ansStrong = el('strong', null, '허용 정답: ');
        ansLine.appendChild(ansStrong);
        var answers = Array.isArray(q.answers) ? q.answers : [];
        ansLine.appendChild(document.createTextNode(answers.join(', ')));
        card.appendChild(ansLine);
      }

      if (q.explanation) {
        var exp = el('div', 'explanation');
        var es = el('strong', null, '해설  ');
        exp.appendChild(es);
        exp.appendChild(document.createTextNode(q.explanation));
        card.appendChild(exp);
      }

      resultEl.appendChild(card);
    });

    // 화면 전환
    formEl.innerHTML = '';
    quizActions.hidden = true;
    resultEl.hidden = false;
    resultActions.hidden = false;
    window.scrollTo(0, 0);
  }

  // ---------- 이벤트 ----------
  submitBtn.addEventListener('click', function () {
    renderResult();
  });

  retryBtn.addEventListener('click', function () {
    // 보관해 둔 원본으로 문제·선지를 새로 셔플해서 처음부터 다시.
    renderQuiz(originalQuestions);
  });

  start();
})();
