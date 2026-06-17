(function () {
  'use strict';

  var titleEl = document.getElementById('quiz-title');
  var statusEl = document.getElementById('quiz-status');
  var progressEl = document.getElementById('quiz-progress');
  var formEl = document.getElementById('quiz-form');
  var resultEl = document.getElementById('result');
  var resultActions = document.getElementById('result-actions');
  var retryBtn = document.getElementById('retry-btn');

  // 현재 화면에 표출된(준비된) 문제 목록을 보관
  var preparedQuestions = [];
  // "다시 풀기"를 위해 원본 문제 목록을 보관
  var originalQuestions = [];
  // 문항별 채점 상태: { graded: bool, correct: bool }
  var states = [];

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
    states = preparedQuestions.map(function () {
      return { graded: false, correct: false };
    });

    formEl.innerHTML = '';
    resultEl.hidden = true;
    resultEl.innerHTML = '';
    resultActions.hidden = true;
    progressEl.hidden = false;
    window.scrollTo(0, 0);

    preparedQuestions.forEach(function (q, idx) {
      var card = el('div', 'question');
      card.id = 'card-' + idx;

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

      // 문항 전용 "확인" 버튼 + 결과 영역
      var actions = el('div', 'q-actions');
      var confirmBtn = el('button', 'btn btn-primary btn-confirm', '확인');
      confirmBtn.type = 'button';
      confirmBtn.addEventListener('click', function () {
        confirmQuestion(idx);
      });
      actions.appendChild(confirmBtn);
      card.appendChild(actions);

      var feedback = el('div', 'q-feedback');
      feedback.hidden = true;
      card.appendChild(feedback);

      formEl.appendChild(card);
    });

    updateProgress();
  }

  // ---------- 채점 ----------
  // 답을 했는지 검사 (빈 입력/미선택 판별)
  function hasAnswer(q, idx) {
    if (q.type === 'single' || q.type === 'multiple') {
      return !!formEl.querySelector('input[name="q' + idx + '"]:checked');
    }
    if (q.type === 'short') {
      var field = formEl.querySelector('input[name="q' + idx + '"]');
      return normalize(field ? field.value : '') !== '';
    }
    return false;
  }

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

  // 카드 안의 입력을 잠근다
  function lockInputs(idx) {
    var inputs = formEl.querySelectorAll('[name="q' + idx + '"]');
    Array.prototype.forEach.call(inputs, function (n) {
      n.disabled = true;
    });
    var card = document.getElementById('card-' + idx);
    if (card) {
      var labels = card.querySelectorAll('.choice');
      Array.prototype.forEach.call(labels, function (l) {
        l.classList.add('locked');
      });
    }
  }

  // ---------- 문항별 확인 ----------
  function confirmQuestion(idx) {
    if (states[idx].graded) return;

    var q = preparedQuestions[idx];
    var card = document.getElementById('card-' + idx);
    var feedback = card.querySelector('.q-feedback');

    // 미응답이면 안내만, 채점/잠금 안 함
    if (!hasAnswer(q, idx)) {
      feedback.hidden = false;
      feedback.className = 'q-feedback hint-only';
      feedback.innerHTML = '';
      var msg = (q.type === 'short') ? '답을 입력하세요.' : '답을 선택하세요.';
      feedback.appendChild(el('p', 'feedback-msg', msg));
      return;
    }

    var g = gradeQuestion(q, idx);
    states[idx] = { graded: true, correct: g.correct };

    // 입력 잠금
    lockInputs(idx);

    // 확인 버튼 비활성화
    var confirmBtn = card.querySelector('.btn-confirm');
    if (confirmBtn) confirmBtn.disabled = true;

    // 카드 정/오답 색상
    card.classList.remove('is-correct', 'is-wrong');
    card.classList.add(g.correct ? 'is-correct' : 'is-wrong');

    // 선지 강조 (single/multiple)
    if (q.type === 'single' || q.type === 'multiple') {
      var labels = card.querySelectorAll('.choice');
      q.choices.forEach(function (c, ci) {
        var label = labels[ci];
        if (!label) return;
        var isPicked = (q.type === 'single')
          ? (g.pickedIdx === ci)
          : !!(g.pickedSet && g.pickedSet[ci]);
        if (c.correct) {
          label.classList.add('choice-correct');
        } else if (isPicked) {
          label.classList.add('choice-wrong');
        }
      });
    }

    // 피드백 영역 구성
    feedback.hidden = false;
    feedback.className = 'q-feedback ' + (g.correct ? 'is-correct' : 'is-wrong');
    feedback.innerHTML = '';

    var verdict = el('div', 'verdict ' + (g.correct ? 'ok' : 'no'), g.correct ? '정답' : '오답');
    feedback.appendChild(verdict);

    if (q.type === 'short') {
      var ansLine = el('div', 'answer-line');
      ansLine.appendChild(el('strong', null, '허용 정답: '));
      var answers = Array.isArray(q.answers) ? q.answers : [];
      ansLine.appendChild(document.createTextNode(answers.join(', ')));
      feedback.appendChild(ansLine);
    }

    if (q.explanation) {
      var exp = el('div', 'explanation');
      exp.appendChild(el('strong', null, '해설  '));
      exp.appendChild(document.createTextNode(q.explanation));
      feedback.appendChild(exp);
    }

    updateProgress();
    maybeShowSummary();
  }

  // ---------- 진행 표시 ----------
  function countSolved() {
    var solved = 0;
    var correct = 0;
    states.forEach(function (s) {
      if (s.graded) {
        solved++;
        if (s.correct) correct++;
      }
    });
    return { solved: solved, correct: correct };
  }

  function updateProgress() {
    var total = preparedQuestions.length;
    var c = countSolved();
    progressEl.textContent = '푼 문제 ' + c.solved + '/' + total + ' · 맞음 ' + c.correct;
  }

  // ---------- 최종 요약 ----------
  function maybeShowSummary() {
    var total = preparedQuestions.length;
    var c = countSolved();
    if (c.solved < total) return;

    resultEl.innerHTML = '';
    var scoreCard = el('div', 'score-card');
    scoreCard.appendChild(el('div', 'score', c.correct + ' / ' + total));
    scoreCard.appendChild(el('div', 'score-label', '맞은 수 / 전체 수'));
    resultEl.appendChild(scoreCard);

    resultEl.hidden = false;
    resultActions.hidden = false;
  }

  // ---------- 이벤트 ----------
  retryBtn.addEventListener('click', function () {
    // 보관해 둔 원본으로 문제·선지를 새로 셔플해서 처음부터 다시.
    renderQuiz(originalQuestions);
  });

  start();
})();
