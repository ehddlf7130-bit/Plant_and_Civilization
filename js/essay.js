(function () {
  'use strict';

  var titleEl = document.getElementById('essay-title');
  var statusEl = document.getElementById('essay-status');
  var listEl = document.getElementById('essay-list');
  var actionsEl = document.getElementById('essay-actions');
  var resetBtn = document.getElementById('reset-btn');

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

  function showStatus(msg, isError) {
    statusEl.hidden = false;
    statusEl.innerHTML = '';
    statusEl.appendChild(el('p', isError ? 'error' : 'loading', msg));
  }

  // \n 은 줄바꿈, 빈 줄은 문단 구분으로 렌더
  function renderMultiline(container, text) {
    var blocks = String(text == null ? '' : text).split(/\n\s*\n/);
    blocks.forEach(function (block) {
      var p = el('p', 'ma-para');
      // 문단 내부 단일 \n 은 줄바꿈 (white-space: pre-wrap)
      p.appendChild(document.createTextNode(block));
      container.appendChild(p);
    });
  }

  function render(questions) {
    listEl.innerHTML = '';
    var shuffled = shuffle(questions);

    shuffled.forEach(function (q, idx) {
      var card = el('div', 'essay-q');

      var head = el('div', 'question-head');
      head.appendChild(el('span', 'q-number', (idx + 1) + '.'));
      head.appendChild(el('span', 'q-text', q.question || ''));
      card.appendChild(head);

      var ta = document.createElement('textarea');
      ta.className = 'essay-textarea';
      ta.placeholder = '답안을 작성하세요';
      card.appendChild(ta);

      // 문항 전용 "모범답안 보기" 토글 버튼
      var actions = el('div', 'q-actions');
      var toggleBtn = el('button', 'btn btn-primary btn-model', '모범답안 보기');
      toggleBtn.type = 'button';
      actions.appendChild(toggleBtn);
      card.appendChild(actions);

      var ma = el('div', 'model-answer');
      ma.hidden = true;
      ma.appendChild(el('span', 'ma-label', '모범답안'));
      renderMultiline(ma, q.modelAnswer || '');
      card.appendChild(ma);

      toggleBtn.addEventListener('click', function () {
        if (ma.hidden) {
          ma.hidden = false;
          toggleBtn.textContent = '모범답안 숨기기';
        } else {
          ma.hidden = true;
          toggleBtn.textContent = '모범답안 보기';
        }
      });

      listEl.appendChild(card);
    });

    statusEl.hidden = true;
    actionsEl.hidden = false;
  }

  resetBtn.addEventListener('click', function () {
    var areas = listEl.querySelectorAll('.essay-textarea');
    Array.prototype.forEach.call(areas, function (n) { n.value = ''; });
    var answers = listEl.querySelectorAll('.model-answer');
    Array.prototype.forEach.call(answers, function (n) { n.hidden = true; });
    var toggles = listEl.querySelectorAll('.btn-model');
    Array.prototype.forEach.call(toggles, function (n) { n.textContent = '모범답안 보기'; });
    window.scrollTo(0, 0);
  });

  fetch('data/essay.json')
    .then(function (res) {
      if (!res.ok) throw new Error('essay.json 로드 실패: ' + res.status);
      return res.json();
    })
    .then(function (data) {
      titleEl.textContent = (data && data.title) ? data.title : '서술형 문제';
      var questions = (data && Array.isArray(data.questions)) ? data.questions : [];
      if (questions.length === 0) {
        showStatus('표시할 문제가 없습니다.', true);
        return;
      }
      render(questions);
    })
    .catch(function (err) {
      console.error(err);
      showStatus('문제를 불러오지 못했습니다. (로컬은 python3 -m http.server 로 실행하세요)', true);
    });
})();
