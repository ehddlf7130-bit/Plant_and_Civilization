(function () {
  'use strict';

  var titleEl = document.getElementById('essay-title');
  var statusEl = document.getElementById('essay-status');
  var listEl = document.getElementById('essay-list');
  var actionsEl = document.getElementById('essay-actions');
  var showBtn = document.getElementById('show-answers-btn');
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

      var ma = el('div', 'model-answer');
      ma.hidden = true;
      var label = el('span', 'ma-label', '모범답안');
      ma.appendChild(label);
      // \n 은 줄바꿈으로 렌더 (textContent + white-space: pre-wrap)
      ma.appendChild(document.createTextNode(q.modelAnswer || ''));
      card.appendChild(ma);

      listEl.appendChild(card);
    });

    statusEl.hidden = true;
    actionsEl.hidden = false;
  }

  showBtn.addEventListener('click', function () {
    var answers = listEl.querySelectorAll('.model-answer');
    Array.prototype.forEach.call(answers, function (n) { n.hidden = false; });
  });

  resetBtn.addEventListener('click', function () {
    var areas = listEl.querySelectorAll('.essay-textarea');
    Array.prototype.forEach.call(areas, function (n) { n.value = ''; });
    var answers = listEl.querySelectorAll('.model-answer');
    Array.prototype.forEach.call(answers, function (n) { n.hidden = true; });
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
