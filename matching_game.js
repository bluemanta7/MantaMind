// Matching game with timer and highscore tracking
let matchTimer = null;
let matchStart = null;
let matchElapsed = 0; // ms
let matchPairs = [];
let userPairs = {};
let selectedLeft = null;

document.addEventListener('DOMContentLoaded', () => {
  // Ensure user is logged in
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) {
    alert('Please log in to play the Matching game.');
    window.location.href = 'login.html';
    return;
  }
  const startBtn = document.getElementById('start-matching');
  const resetBtn = document.getElementById('reset-matching');
  const submitBtn = document.getElementById('submit-matching');

  if (startBtn) startBtn.addEventListener('click', startMatchingGame);
  if (resetBtn) resetBtn.addEventListener('click', renderMatchingGame);
  if (submitBtn) submitBtn.addEventListener('click', submitMatching);

  // load best
  loadBestTime();
  renderMatchingGame();
});

function loadBestTime() {
  const bestEl = document.getElementById('match-best');
  const currentUser = localStorage.getItem('currentUser');
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  if (!currentUser || !userData[currentUser] || !userData[currentUser].matchingHighscore) {
    if (bestEl) bestEl.textContent = '—';
    return;
  }
  const ms = userData[currentUser].matchingHighscore;
  if (bestEl) bestEl.textContent = (ms/1000).toFixed(3) + ' s';
}

function startMatchingGame() {
  // start timer
  if (matchTimer) return; // already running
  matchStart = performance.now() - matchElapsed;
  matchTimer = setInterval(() => {
    matchElapsed = performance.now() - matchStart;
    document.getElementById('match-timer').textContent = (matchElapsed / 1000).toFixed(3);
  }, 50);
}

function stopMatchingGame() {
  if (matchTimer) {
    clearInterval(matchTimer);
    matchTimer = null;
  }
}

function resetTimer() {
  stopMatchingGame();
  matchElapsed = 0;
  document.getElementById('match-timer').textContent = (matchElapsed/1000).toFixed(3);
}

function renderMatchingGame() {
  resetTimer();
  selectedLeft = null;
  userPairs = {};
  const container = document.getElementById('matching-area');
  if (!container) return;

  // pick between 3 and 5 pairs depending on available words
  fetch('./data.json').then(r => r.json()).then(data => {
    const words = Array.isArray(data) ? data : (data.words || []);
    // Always use 5 pairs when possible so highscore comparisons are fair.
    const desiredPairs = 5;
    const pairCount = Math.min(desiredPairs, words.length);
    const feedbackEl = document.getElementById('matching-feedback');
    if (feedbackEl) {
      if (pairCount < desiredPairs) {
        feedbackEl.innerHTML = `<p class="feedback warning">⚠️ Only ${pairCount} words available — using ${pairCount} pairs for this round.</p>`;
      } else {
        feedbackEl.innerHTML = '';
      }
    }

    const pool = words.slice();
    shuffleArray(pool);
    matchPairs = pool.slice(0, pairCount).map(w => ({ word: w.word, definition: w.definition }));

    const left = matchPairs.map((p, i) => ({ text: p.word, idx: i }));
    const right = matchPairs.map((p, i) => ({ text: p.definition, idx: i }));
    shuffleArray(right);

    container.innerHTML = `
      <div class="matching-container" style="position:relative;">
        <svg class="matching-lines" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></svg>
        <div class="matching-col left" id="matching-left"></div>
        <div class="matching-col right" id="matching-right"></div>
      </div>
    `;

    const leftEl = document.getElementById('matching-left');
    const rightEl = document.getElementById('matching-right');

    left.forEach(item => {
      const div = document.createElement('div');
      div.className = 'match-item left-item';
      div.textContent = item.text;
      div.dataset.idx = item.idx;
      const label = document.createElement('div');
      label.className = 'paired-label';
      div.appendChild(label);

      // enable drag from left item
      div.draggable = true;
      div.addEventListener('dragstart', (e) => {
        selectedLeft = parseInt(div.dataset.idx, 10);
        e.dataTransfer.setData('text/plain', selectedLeft);
        div.classList.add('dragging');
        // create a temporary line following cursor
        startTempLineForLeft(div);
        if (!matchTimer) startMatchingGame();
      });
      div.addEventListener('dragend', (e) => {
        selectedLeft = null;
        div.classList.remove('dragging');
        stopTempLine();
        updatePairUI();
      });

      // click behavior remains (toggle unpair/selection)
      div.addEventListener('click', () => {
        const leftIdx = parseInt(div.dataset.idx, 10);
        if (userPairs[leftIdx] !== undefined) {
          delete userPairs[leftIdx];
          updatePairUI();
          return;
        }
        selectedLeft = leftIdx;
        document.querySelectorAll('.left-item').forEach(l => l.classList.remove('selected-left'));
        div.classList.add('selected-left');
        if (!matchTimer) startMatchingGame();
      });

      leftEl.appendChild(div);
    });

    right.forEach(item => {
      const div = document.createElement('div');
      div.className = 'match-item right-item';
      div.textContent = item.text;
      div.dataset.idx = item.idx;
      const label = document.createElement('div');
      label.className = 'paired-label';
      div.appendChild(label);

      // allow drop onto right item
      div.addEventListener('dragover', (e) => { e.preventDefault(); });
      div.addEventListener('drop', (e) => {
        e.preventDefault();
        const leftIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const rightIdx = parseInt(div.dataset.idx, 10);
        // ensure uniqueness by removing previous left that owned this right
        const prevLeft = Object.keys(userPairs).find(k => userPairs[k] === rightIdx);
        if (prevLeft !== undefined) delete userPairs[prevLeft];
        userPairs[leftIdx] = rightIdx;
        selectedLeft = null;
        stopTempLine();
        updatePairUI();
      });

      // clicking a right when nothing selected will unpair
      div.addEventListener('click', () => {
        if (selectedLeft === null) {
          const leftAssigned = Object.keys(userPairs).find(k => userPairs[k] === div.dataset.idx);
          if (leftAssigned !== undefined) {
            delete userPairs[leftAssigned];
            updatePairUI();
          }
        } else {
          // assign selectedLeft to this right via click
          const rightIdx = parseInt(div.dataset.idx, 10);
          const prevLeft = Object.keys(userPairs).find(k => userPairs[k] === rightIdx);
          if (prevLeft !== undefined) delete userPairs[prevLeft];
          userPairs[selectedLeft] = rightIdx;
          selectedLeft = null;
          updatePairUI();
        }
      });

      rightEl.appendChild(div);
    });

    // After creating elements, ensure UI reflects any saved pairs
    updatePairUI();

    // timer reset (feedback was set above if needed)
    resetTimer();
  }).catch(err => {
    console.error('Failed to load words for matching:', err);
    document.getElementById('matching-area').innerHTML = '<p>⚠️ Failed to load words.</p>';
  });
}

function submitMatching() {
  const feedback = document.getElementById('matching-feedback');
  feedback.innerHTML = '';
  if (!matchPairs || matchPairs.length === 0) return;

  let allCorrect = true;
  for (let i=0;i<matchPairs.length;i++) {
    if (userPairs[i] === undefined || userPairs[i] !== i) {
      allCorrect = false;
      break;
    }
  }

  if (allCorrect) {
    stopMatchingGame();
    const ms = Math.round(matchElapsed);
    feedback.innerHTML = `<p class="feedback correct">🎉 All matched correctly! Time: ${(ms/1000).toFixed(3)} s</p>`;
    saveMatchHighscore(ms);
  } else {
    feedback.innerHTML = '<p class="feedback incorrect">❌ Some matches are wrong. Correct the pairs and try again — timer continues.</p>';
  }
}

// Update UI for all current pairs (paired classes and labels)
function updatePairUI() {
  // clear all paired/labels
  document.querySelectorAll('.left-item, .right-item').forEach(el => {
    el.classList.remove('paired');
    const lbl = el.querySelector('.paired-label');
    if (lbl) lbl.textContent = '';
  });

  // apply pairs
  Object.keys(userPairs).forEach(leftKey => {
    const leftIdx = parseInt(leftKey, 10);
    const rightIdx = userPairs[leftKey];
    const leftEl = document.querySelector(`.left-item[data-idx="${leftIdx}"]`);
    const rightEl = document.querySelector(`.right-item[data-idx="${rightIdx}"]`);
    if (leftEl) {
      leftEl.classList.add('paired');
      const lbl = leftEl.querySelector('.paired-label');
      if (lbl) lbl.textContent = '→';
    }
    if (rightEl) {
      rightEl.classList.add('paired');
      const lbl = rightEl.querySelector('.paired-label');
      if (lbl) lbl.textContent = '←';
    }
  });
}

function saveMatchHighscore(ms) {
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) return;
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  userData[currentUser] = userData[currentUser] || {};
  const prev = userData[currentUser].matchingHighscore;
  if (!prev || ms < prev) {
    userData[currentUser].matchingHighscore = ms;
    localStorage.setItem('userData', JSON.stringify(userData));
    document.getElementById('match-best').textContent = (ms/1000).toFixed(3) + ' s';
    // also update profile stat if on profile page
    const pref = document.getElementById('matching-best');
    if (pref) pref.textContent = (ms/1000).toFixed(3) + ' s';
  }
}

// --- SVG line drawing for pairs + temporary dragging line ---
let tempLineEl = null;
function startTempLineForLeft(leftEl) {
  const svg = document.querySelector('.matching-lines');
  if (!svg) return;
  stopTempLine();
  tempLineEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  tempLineEl.setAttribute('stroke', '#00d4ff');
  tempLineEl.setAttribute('stroke-width', '4');
  tempLineEl.setAttribute('stroke-linecap', 'round');
  svg.appendChild(tempLineEl);

  function moveTemp(e) {
    const rect = svg.getBoundingClientRect();
    const leftCenter = getCenter(leftEl, svg.parentElement);
    const x1 = leftCenter.x;
    const y1 = leftCenter.y;
    const x2 = e.clientX - rect.left;
    const y2 = e.clientY - rect.top;
    tempLineEl.setAttribute('x1', x1);
    tempLineEl.setAttribute('y1', y1);
    tempLineEl.setAttribute('x2', x2);
    tempLineEl.setAttribute('y2', y2);
  }

  document.addEventListener('mousemove', moveTemp);
  tempLineEl._moveHandler = moveTemp;
}

function stopTempLine() {
  const svg = document.querySelector('.matching-lines');
  if (!svg || !tempLineEl) return;
  document.removeEventListener('mousemove', tempLineEl._moveHandler);
  svg.removeChild(tempLineEl);
  tempLineEl = null;
}

function getCenter(el, container) {
  const eRect = el.getBoundingClientRect();
  const cRect = container.getBoundingClientRect();
  return { x: (eRect.left + eRect.right) / 2 - cRect.left, y: (eRect.top + eRect.bottom) / 2 - cRect.top };
}

const PALETTE = ['#00d4ff','#00ff88','#ffb86b','#ff6b6b','#a280ff'];

function drawLines() {
  const svg = document.querySelector('.matching-lines');
  const container = svg ? svg.parentElement : null;
  if (!svg || !container) return;
  // clear existing lines
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  Object.keys(userPairs).forEach(leftKey => {
    const leftIdx = parseInt(leftKey, 10);
    const rightIdx = userPairs[leftKey];
    const leftEl = document.querySelector(`.left-item[data-idx="${leftIdx}"]`);
    const rightEl = document.querySelector(`.right-item[data-idx="${rightIdx}"]`);
    if (!leftEl || !rightEl) return;
    const c1 = getCenter(leftEl, container);
    const c2 = getCenter(rightEl, container);
    const color = PALETTE[leftIdx % PALETTE.length];

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', c1.x);
    line.setAttribute('y1', c1.y);
    line.setAttribute('x2', c2.x);
    line.setAttribute('y2', c2.y);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', 6);
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);

    // small circles at ends for clarity
    const cA = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cA.setAttribute('cx', c1.x);
    cA.setAttribute('cy', c1.y);
    cA.setAttribute('r', 6);
    cA.setAttribute('fill', color);
    svg.appendChild(cA);

    const cB = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cB.setAttribute('cx', c2.x);
    cB.setAttribute('cy', c2.y);
    cB.setAttribute('r', 6);
    cB.setAttribute('fill', color);
    svg.appendChild(cB);

    // style left/right matched items with color accent
    if (leftEl) leftEl.style.borderColor = color;
    if (rightEl) rightEl.style.borderColor = color;
  });
}

// Re-draw lines on resize to keep positions correct
window.addEventListener('resize', () => { drawLines(); });

// ensure UI updates lines when pairs change
const originalUpdatePairUI = updatePairUI;
function updatePairUI_wrapper(){ originalUpdatePairUI(); drawLines(); }
updatePairUI = updatePairUI_wrapper;

// helper: shuffleArray
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
