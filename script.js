// Global state
let challengeStarted = false;
let stepIndex = 0;
let wordIndex = 0;
let currentUser = null;
let userData = {};
let wordData = [];
let currentWord = null;

const challengeSteps = ['definition-match', 'choose-sentence'];

// ============================================
// INITIALIZATION
// ============================================
function revealAnswer() {
  if (!currentWord) return;

  const feedback = document.getElementById('feedback');
  if (feedback) {
    feedback.textContent = `❌ The correct word was "${currentWord.word}".`;
  }

  const giveUpBtn = document.getElementById('give-up-btn');
  if (giveUpBtn) giveUpBtn.style.display = 'none';

  const hintBtn = document.getElementById('hint-btn');
  if (hintBtn) hintBtn.style.display = 'none';

  const nextBtn = document.getElementById('next-task');
  if (nextBtn) nextBtn.textContent = 'Next Task';

  updateProgress(false, currentWord.word);

  disableTypingChallenge();
  disableMultipleChoice();
}

document.addEventListener('DOMContentLoaded', () => {
  loadUserData();
  setupAuthToggle();
  if (window.location.pathname.includes('challenge.html')) {
    redirectIfNotLoggedIn();
  }

  const giveUpButton = document.getElementById('give-up-btn');
  if (giveUpButton) {
    giveUpButton.addEventListener('click', revealAnswer);
  }

  loadWordData();
  syncChallengeStatus();
  setupChallengeButtons();

  const hintBtn = document.getElementById('hint-btn');
  if (hintBtn) {
    hintBtn.addEventListener('click', () => {
      const feedbackEl = document.getElementById('feedback');
      if (!feedbackEl) return;

      if (currentWord && Array.isArray(currentWord.synonyms) && currentWord.synonyms.length) {
        feedbackEl.textContent = `💡 Synonyms: ${currentWord.synonyms.join(', ')}`;
      } else {
        feedbackEl.textContent = '💡 No synonyms available for this word.';
      }
    });
  }
});

// ============================================
// DATA LOADING
// ============================================
function loadWordData() {
  const relativePaths = ['./data.json', './data/data.json', '/data.json'];

  const tryFetch = (index) => {
    if (index >= relativePaths.length) {
      const errMsg = 'Could not fetch data.json from any relative path. Make sure data.json is in your project and you are running a local server.';
      console.error(errMsg);
      const container = document.getElementById('task-container');
      if (container) container.innerHTML = `<p>⚠️ ${errMsg}</p>`;
      const wordListEl = document.getElementById('word-list');
      if (wordListEl) wordListEl.innerHTML = '<li>⚠️ Failed to load words.</li>';
      return;
    }

    const path = relativePaths[index];
    fetch(path)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
        return response.json();
      })
      .then(data => {
        wordData = Array.isArray(data) ? data : data.words || [];
        if (!Array.isArray(wordData)) wordData = [];
        shuffleArray(wordData);
        console.log('✅ Loaded', wordData.length, 'words from', path);

        if (challengeStarted) {
          loadTask(challengeSteps[stepIndex]);
        }

        if (challengeStarted && (!currentWord || !document.getElementById('task-container')?.innerHTML.trim())) {
          startChallenge();
        }
      })
      .catch(err => {
        console.warn(`Failed to load ${path}:`, err);
        tryFetch(index + 1);
      });
  };

  tryFetch(0);
}

function loadUserData() {
  const savedUser = localStorage.getItem('currentUser');
  const savedUserData = localStorage.getItem('userData');

  if (savedUser && savedUserData) {
    currentUser = savedUser;
    userData = JSON.parse(savedUserData);
    
    // Initialize wordStreaks if it doesn't exist
    if (userData[currentUser] && !userData[currentUser].wordStreaks) {
      userData[currentUser].wordStreaks = {};
      localStorage.setItem('userData', JSON.stringify(userData));
    }
    
    loadUserStreaks();
  }
}

function loadUserStreaks() {
  if (!currentUser || !userData[currentUser]) return;

  const user = userData[currentUser];
  const currentStreakEl = document.getElementById('current-streak');
  const bestStreakEl = document.getElementById('best-streak');
  
  if (currentStreakEl) currentStreakEl.textContent = user.currentStreak || 0;
  if (bestStreakEl) bestStreakEl.textContent = user.bestStreak || 0;
  
  // Update progress bar on load
  updateProgressBar();
}

// ============================================
// UI & NAVIGATION SETUP
// ============================================
function setupChallengeButtons() {
  const nextBtn = document.getElementById('next-task');
  const giveUpBtn = document.getElementById('give-up-btn');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (!challengeStarted) {
        startChallenge();
      } else {
        advanceToNextTask();
      }
    });
  }

  if (giveUpBtn) {
    giveUpBtn.addEventListener('click', () => {
      const cw = currentWord || wordData[wordIndex];
      if (!cw) return;
      showCorrectAnswer(cw.word, cw.definition);
      updateProgress(false, cw.word);
      const nextBtnEl = document.getElementById('next-task');
      if (nextBtnEl) nextBtnEl.style.display = 'inline-block';

      document.querySelectorAll('.choice-btn, #blank-input').forEach(el => el.disabled = true);
    });
  }
}

function redirectIfNotLoggedIn() {
  const currentUserCheck = localStorage.getItem('currentUser');
  if (!currentUserCheck) {
    window.location.href = 'login.html';
  }
}

// ============================================
// CHALLENGE CONTROL
// ============================================
function syncChallengeStatus() {
  challengeStarted = localStorage.getItem('challengeStarted') === 'true';
  stepIndex = parseInt(localStorage.getItem('stepIndex') || '0', 10);
  wordIndex = parseInt(localStorage.getItem('wordIndex') || '0', 10);
  updateButtonsUI();
}

function updateButtonsUI() {
  const nextBtn = document.getElementById('next-task');
  const giveUpBtn = document.getElementById('give-up-btn');

  if (!nextBtn || !giveUpBtn) return;

  if (challengeStarted) {
    nextBtn.textContent = "Continue Challenge";
    giveUpBtn.style.display = 'inline-block';
  } else {
    nextBtn.textContent = "Start Challenge";
    giveUpBtn.style.display = 'none';
  }
}

function startChallenge() {
  if (!wordData || wordData.length === 0) {
    const taskContainer = document.getElementById('task-container');
    if (taskContainer) taskContainer.innerHTML = '<p>⚠️ Word data not loaded. Cannot start challenge.</p>';
    const hintEl = document.getElementById('hint-btn');
    if (hintEl) hintEl.style.display = 'none';
    return;
  }

  challengeStarted = true;
  localStorage.setItem('challengeStarted', 'true');

  currentWord = wordData[Math.floor(Math.random() * wordData.length)];

  // Determine enabled formats based on per-user settings
  const enabledFormats = [];
  try {
    const userSettings = getUserSettings();
    if (userSettings.multipleChoice) {
      enabledFormats.push('multiple-definition', 'multiple-word', 'choose-sentence');
    }
    if (userSettings.fillBlank) enabledFormats.push('fill');
    if (userSettings.matching) enabledFormats.push('matching');
  } catch (e) {
    // fallback: if something goes wrong, enable all
    enabledFormats.push('multiple-definition', 'multiple-word', 'fill', 'choose-sentence');
  }

  if (!enabledFormats || enabledFormats.length === 0) {
    alert('No question types enabled in settings. Please enable at least one type in Settings.');
    return;
  }

  const format = enabledFormats[Math.floor(Math.random() * enabledFormats.length)];

  const giveUpBtn = document.getElementById('give-up-btn');
  if (giveUpBtn) giveUpBtn.style.display = 'inline-block';

  const nextTaskBtn = document.getElementById('next-task');
  if (nextTaskBtn) nextTaskBtn.textContent = 'Next Task';

  const feedbackEl = document.getElementById('feedback');
  if (feedbackEl) feedbackEl.textContent = '';

  const hintBtnEl = document.getElementById('hint-btn');
  if (hintBtnEl) hintBtnEl.style.display = 'inline-block';

  if (format === 'multiple-definition') showMultipleChoiceDefinition(currentWord);
  else if (format === 'multiple-word') showMultipleChoiceWord(currentWord);
  else if (format === 'fill') showFillInBlank(currentWord);
  else if (format === 'matching') showMatchingQuestion();
  else showTypingChallenge(currentWord);
}

// Return current user settings (with defaults)
function getUserSettings() {
  const currentUser = localStorage.getItem('currentUser');
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const defaults = { multipleChoice: true, fillBlank: false, matching: false };
  if (!currentUser || !userData[currentUser] || !userData[currentUser].settings) return defaults;
  return Object.assign({}, defaults, userData[currentUser].settings);
}

function advanceToNextTask() {
  stepIndex++;

  if (stepIndex >= challengeSteps.length) {
    stepIndex = 0;
    wordIndex = (wordIndex + 1) % wordData.length;
  }

  localStorage.setItem('stepIndex', stepIndex);
  localStorage.setItem('wordIndex', wordIndex);

  loadTask(challengeSteps[stepIndex]);
  const nextBtn = document.getElementById('next-task');
  if (nextBtn) nextBtn.style.display = 'none';
}

// ============================================
// TASK LOADING & ANSWER HANDLING
// ============================================
function loadTask(type) {
  const container = document.getElementById('task-container');
  if (!container) return;
  container.innerHTML = '';

  if (!wordData || wordData.length === 0) {
    container.innerHTML = '<p>Loading words...</p>';
    return;
  }

  const cw = wordData[wordIndex];

  if (!cw) {
    console.error(`Invalid wordIndex: ${wordIndex}`);
    container.innerHTML = '<p>⚠️ Error: Could not find the current word.</p>';
    return;
  }

  currentWord = cw;

  const synonymHint = cw.synonyms ? cw.synonyms[Math.floor(Math.random() * cw.synonyms.length)] : 'No synonym available';

  if (type === 'definition-match') {
    let randomWord;
    do {
      randomWord = wordData[Math.floor(Math.random() * wordData.length)];
    } while (randomWord.word === cw.word);

    // Build up to 4 choices (1 correct + up to 3 distractors)
    const pool = wordData.filter(w => w.word !== cw.word && w.definition);
    shuffleArray(pool);
    const distractors = pool.slice(0, 3).map(w => w.definition);
    const options = [{ text: cw.definition, correct: true }, ...distractors.map(d => ({ text: d, correct: false }))];
    shuffleArray(options);

    container.innerHTML = `
      <p>What does "<strong>${cw.word}</strong>" mean?</p>
      ${options.map((opt) => `<button class="choice-btn" onclick="handleMultipleChoice(${opt.correct}, this, '${cw.word}', '${cw.definition.replace(/'/g, "\\'")}')">${opt.text}</button>`).join('')}
    `;

  } else if (type === 'fill-blank') {
    const exampleSentence = cw.examples && cw.examples[0] ? cw.examples[0] : '';
    const blankedSentence = exampleSentence ? exampleSentence.replace(new RegExp(cw.word, 'i'), '_____') : '';

    container.innerHTML = `
      <p>Complete the sentence:</p>
      <p>${blankedSentence}</p>
      <p><em>Hint: A synonym is "<strong>${synonymHint}</strong>"</em></p>
      <input type="text" id="blank-input" placeholder="Your answer" />
      <button onclick="checkFillBlank()">Submit</button>
    `;

  } else if (type === 'choose-sentence') {
    // 4 sentence options: 1 correct example + up to 3 distractor sentences
    const correctSentence = cw.examples && cw.examples[0] ? cw.examples[0] : '';
    const pool = wordData.filter(w => w.word !== cw.word);
    shuffleArray(pool);
    const distractSentences = pool.slice(0, 3).map(w => `The delicious pizza was very ${w.word}.`);
    const options = [{ text: correctSentence, correct: true }, ...distractSentences.map(s => ({ text: s, correct: false }))];
    shuffleArray(options);

    container.innerHTML = `
      <p>Which sentence uses "<strong>${cw.word}</strong>" correctly?</p>
      ${options.map(opt => `<button class="choice-btn" onclick="handleMultipleChoice(${opt.correct}, this, '${cw.word}', '${cw.definition}')">${opt.text}</button>`).join('')}
    `;
  } else {
    container.innerHTML = `<p>Unknown task type. Showing definition for <strong>${cw.word}</strong>:</p><p>${cw.definition}</p>`;
  }

  // ENSURE BUTTONS ARE ALWAYS SHOWN
  const hintBtn = document.getElementById('hint-btn');
  const giveUpBtn = document.getElementById('give-up-btn');
  const nextBtn = document.getElementById('next-task');
  
  if (hintBtn) hintBtn.style.display = 'inline-block';
  if (giveUpBtn) giveUpBtn.style.display = 'inline-block';
  if (nextBtn) nextBtn.style.display = 'none';
}

function handleMultipleChoice(isCorrect, button, word, definition) {
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
  });

  if (button) button.classList.add(isCorrect ? 'correct-choice' : 'incorrect-choice');
  if (button) button.innerHTML += isCorrect ? " ✅" : " ❌";

  if (!isCorrect) {
    showCorrectAnswer(word, definition);
  }

  showFeedback(isCorrect);
  updateProgress(isCorrect, word);
  const nextBtn = document.getElementById('next-task');
  if (nextBtn) nextBtn.style.display = 'inline-block';
}

function checkFillBlank() {
  const input = document.getElementById('blank-input');
  const cw = currentWord || wordData[wordIndex];
  if (!input || !cw) return;
  const isCorrect = input.value.trim().toLowerCase() === cw.word.toLowerCase();

  input.disabled = true;
  input.classList.add(isCorrect ? 'correct-choice' : 'incorrect-choice');

  if (!isCorrect) {
    showCorrectAnswer(cw.word, cw.definition);
  }

  showFeedback(isCorrect);
  updateProgress(isCorrect, cw.word);
  const nextBtn = document.getElementById('next-task');
  if (nextBtn) nextBtn.style.display = 'inline-block';
}

function showCorrectAnswer(word, definition) {
  const container = document.getElementById('task-container');
  if (!container) return;
  const revealBox = document.createElement('div');
  revealBox.className = 'reveal-box';
  revealBox.innerHTML = `
    <p><strong>Correct Answer:</strong> ${word}</p>
    <p><strong>Definition:</strong> ${definition}</p>
  `;
  container.appendChild(revealBox);
}

function showFeedback(isCorrect) {
  const feedback = document.getElementById('feedback');
  if (!feedback) return;
  feedback.textContent = isCorrect ? "🎉 Correct!" : "Review the answer below.";
  feedback.className = 'feedback show ' + (isCorrect ? 'correct' : 'incorrect');

  setTimeout(() => {
    if (feedback) feedback.classList.remove('show');
  }, 3000);
}

// ============================================
// PROGRESS TRACKING WITH WORD-LEVEL STREAKS
// ============================================
function updateProgress(isCorrect, word) {
  if (!currentUser || !userData[currentUser]) return;

  const user = userData[currentUser];

  // Initialize structures
  user.learnedWords = user.learnedWords || [];
  user.inProgressWords = user.inProgressWords || [];
  user.wordStreaks = user.wordStreaks || {};
  user.currentStreak = user.currentStreak || 0;
  user.bestStreak = user.bestStreak || 0;

  if (!user.wordStreaks[word]) {
    user.wordStreaks[word] = 0;
  }

  if (isCorrect) {
    // Increment word-specific streak
    user.wordStreaks[word]++;

    // Increment global streak
    user.currentStreak++;
    if (user.currentStreak > user.bestStreak) {
      user.bestStreak = user.currentStreak;
    }

    // Mark as learned if word streak reaches 3
    if (user.wordStreaks[word] >= 3 && !user.learnedWords.includes(word)) {
      user.learnedWords.push(word);
      user.inProgressWords = user.inProgressWords.filter(w => w !== word);
      console.log(`🎉 "${word}" marked as learned! (Streak: ${user.wordStreaks[word]})`);
    } else if (!user.inProgressWords.includes(word) && !user.learnedWords.includes(word)) {
      user.inProgressWords.push(word);
    }

  } else {
    // Reset word-specific streak on incorrect answer
    user.wordStreaks[word] = 0;

    // Reset global streak
    user.currentStreak = 0;

    // If word was learned, move it back to in-progress
    if (user.learnedWords.includes(word)) {
      user.learnedWords = user.learnedWords.filter(w => w !== word);
      if (!user.inProgressWords.includes(word)) {
        user.inProgressWords.push(word);
      }
      console.log(`⚠️ "${word}" moved back to in-progress (streak reset)`);
    } else if (!user.inProgressWords.includes(word)) {
      user.inProgressWords.push(word);
    }
  }

  // Update UI
  const currentStreakEl = document.getElementById('current-streak');
  const bestStreakEl = document.getElementById('best-streak');
  if (currentStreakEl) currentStreakEl.textContent = user.currentStreak;
  if (bestStreakEl) bestStreakEl.textContent = user.bestStreak;

  // Update progress bar
  updateProgressBar();

  // Save to localStorage
  localStorage.setItem('userData', JSON.stringify(userData));

  console.log(`Word "${word}" streak: ${user.wordStreaks[word]}/3`);
}

function updateProgressBar() {
  if (!currentUser || !userData[currentUser]) return;

  const user = userData[currentUser];
  const streak = user.currentStreak || 0;
  const maxStreak = 10; // fill bar at 10 in a row
  const percentage = Math.min(Math.round((streak / maxStreak) * 100), 100);

  const progressBar = document.getElementById('completion-bar');
  if (progressBar) {
    progressBar.style.width = percentage + '%';
    progressBar.textContent = percentage + '%';
  }

  const profileBar = document.getElementById('progress-bar');
  if (profileBar) {
    profileBar.style.width = percentage + '%';
    profileBar.textContent = percentage + '%';
  }
}


// ============================================
// AUTH SYSTEM
// ============================================
function setupAuthToggle() {
  const authForm = document.getElementById('auth-form');
  const switchLink = document.getElementById('switch-mode');
  if (!authForm) return;

  const toggle = (isSigningUp) => {
    const submitBtn = document.getElementById('auth-submit');
    const title = document.getElementById('auth-title');
    const toggleText = document.getElementById('toggle-auth');
    if (isSigningUp) {
      submitBtn.textContent = "Sign up";
      title.textContent = "Create a MantaMind Account";
      toggleText.innerHTML = 'Already have an account? <a href="#" id="switch-mode">Login</a>';
    } else {
      submitBtn.textContent = "Login";
      title.textContent = "Login to MantaMind";
      toggleText.innerHTML = 'Don\'t have an account? <a href="#" id="switch-mode">Sign up</a>';
    }
    const newSwitch = document.getElementById('switch-mode');
    if (newSwitch) {
      newSwitch.addEventListener('click', (e) => {
        e.preventDefault();
        toggle(submitBtn.textContent === "Login");
      });
    }
  };

  if (switchLink) {
    switchLink.addEventListener('click', (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('auth-submit');
      toggle(submitBtn.textContent === "Login");
    });
  }

  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const isSignup = document.getElementById('auth-submit').textContent === "Sign up";

    if (!username || !password) {
      showAuthFeedback("Please fill in both fields.");
      return;
    }

    if (isSignup) {
      if (userData[username]) {
        showAuthFeedback("Username already taken.");
      } else {
        userData[username] = {
          password: password,
          learnedWords: [],
          inProgressWords: [],
          wordStreaks: {},
          currentStreak: 0,
          bestStreak: 0
        };
        loginUser(username);
      }
    } else {
      if (!userData[username] || userData[username].password !== password) {
        showAuthFeedback("Invalid username or password.");
      } else {
        loginUser(username);
      }
    }
  });
}

function loginUser(username) {
  currentUser = username;
  localStorage.setItem('currentUser', currentUser);
  localStorage.setItem('userData', JSON.stringify(userData));
  window.location.href = 'challenge.html';
}

function showAuthFeedback(msg) {
  const feedback = document.getElementById('auth-feedback');
  if (feedback) {
    feedback.textContent = msg;
    feedback.style.display = 'block';
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function endChallenge() {
  if (!currentWord) {
    const container = document.getElementById('task-container');
    if (container) container.innerHTML = `<p>Challenge ended.</p>`;
  } else {
    document.getElementById('task-container').innerHTML = `<p>Challenge ended. The correct word was "<strong>${currentWord.word}</strong>".</p>`;
  }
  const feedback = document.getElementById('feedback');
  if (feedback) feedback.textContent = '';
  const giveUp = document.getElementById('give-up-btn');
  if (giveUp) giveUp.style.display = 'none';
  const hint = document.getElementById('hint-btn');
  if (hint) hint.style.display = 'none';
  const next = document.getElementById('next-task');
  if (next) next.textContent = 'Start Challenge';

  if (currentWord) updateProgress(false, currentWord.word);
  disableTypingChallenge();
}

function disableTypingChallenge() {
  const input = document.getElementById('type-input');
  const submit = document.getElementById('submit-type');
  if (input) input.disabled = true;
  if (submit) submit.disabled = true;
}

function disableMultipleChoice() {
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
  });
  const hintBtn = document.getElementById('hint-btn');
  if (hintBtn) hintBtn.style.display = 'none';
}

function showMultipleChoiceDefinition(wordObj) {
  loadTask('definition-match');
}

function showMultipleChoiceWord(wordObj) {
  loadTask('definition-match');
}

function showFillInBlank(wordObj) {
  loadTask('fill-blank');
}

function showTypingChallenge(wordObj) {
  loadTask('fill-blank');
}

// --- Matching question type ---
function showMatchingQuestion() {
  const container = document.getElementById('task-container');
  if (!container || !wordData || wordData.length === 0) return;

  // Choose between 2 and up to 5 pairs depending on available words
  const maxPairs = Math.min(5, wordData.length);
  // choose a random count between 2 and maxPairs (inclusive)
  const pairCount = 2 + Math.floor(Math.random() * Math.max(1, (maxPairs - 1)));

  // Pick distinct random words
  const pool = [...wordData];
  shuffleArray(pool);
  const pairs = pool.slice(0, pairCount).map(w => ({ word: w.word, definition: w.definition }));

  // Prepare left (words) and right (definitions shuffled)
  const left = pairs.map((p, i) => ({ text: p.word, idx: i }));
  const right = pairs.map((p, i) => ({ text: p.definition, idx: i }));
  shuffleArray(right);

  // track pairs chosen by user: leftIdx -> rightIdx
  const userPairs = {};
  let selectedLeft = null;

  container.innerHTML = `
    <p>Match each word to its definition:</p>
    <div class="matching-container">
      <div class="matching-col left" id="matching-left"></div>
      <div class="matching-col right" id="matching-right"></div>
    </div>
    <div style="margin-top:12px;"><button id="submit-matching">Submit Matches</button></div>
    <div id="matching-feedback"></div>
  `;

  const leftEl = document.getElementById('matching-left');
  const rightEl = document.getElementById('matching-right');

  left.forEach(item => {
    const div = document.createElement('div');
    div.className = 'match-item left-item';
    div.textContent = item.text;
    div.dataset.idx = item.idx;
    div.addEventListener('click', () => {
      // select left item
      document.querySelectorAll('.left-item').forEach(el => el.classList.remove('selected-left'));
      div.classList.add('selected-left');
      selectedLeft = parseInt(div.dataset.idx, 10);
    });
    leftEl.appendChild(div);
  });

  right.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'match-item right-item';
    div.textContent = item.text;
    div.dataset.idx = item.idx; // correct left idx
    div.dataset.shownIdx = i; // its position
    div.addEventListener('click', () => {
      if (selectedLeft === null) return;
      // pair selectedLeft -> this right idx
      userPairs[selectedLeft] = parseInt(div.dataset.idx, 10);
      // mark UI
      document.querySelectorAll('.right-item').forEach(el => el.classList.remove('paired'));
      document.querySelectorAll('.left-item').forEach(el => el.classList.remove('paired'));
      // highlight pairs
      const matchedRight = Array.from(document.querySelectorAll('.right-item')).find(r => parseInt(r.dataset.idx,10) === userPairs[selectedLeft]);
      const matchedLeft = Array.from(document.querySelectorAll('.left-item')).find(l => parseInt(l.dataset.idx,10) === selectedLeft);
      if (matchedRight) matchedRight.classList.add('paired');
      if (matchedLeft) matchedLeft.classList.add('paired');
      selectedLeft = null;
      document.querySelectorAll('.left-item').forEach(el => el.classList.remove('selected-left'));
    });
    rightEl.appendChild(div);
  });

  document.getElementById('submit-matching').addEventListener('click', () => {
    const feedback = document.getElementById('matching-feedback');
    const leftWords = left.map(l => l.text);
    const correctPairs = {}; left.forEach((l,i) => { correctPairs[i] = i; });

    // Check matches
    let allMatched = true;
    for (let i = 0; i < left.length; i++) {
      if (userPairs[i] === undefined || userPairs[i] !== correctPairs[i]) {
        allMatched = false;
      }
    }

    if (allMatched) {
      feedback.innerHTML = '<p class="feedback show correct">🎉 All matched correctly!</p>';
      // award progress for each matched word
      leftWords.forEach(w => updateProgress(true, w));
      showFeedback(true);
    } else {
      feedback.innerHTML = '<p class="feedback show incorrect">Some matches are incorrect. See correct pairs below.</p>';
      // For incorrect/partial, penalize any incorrect or missing match
      for (let i = 0; i < left.length; i++) {
        if (userPairs[i] === correctPairs[i]) {
          updateProgress(true, leftWords[i]);
        } else {
          updateProgress(false, leftWords[i]);
        }
      }
      // reveal correct answers
      const reveal = document.createElement('div');
      reveal.className = 'reveal-box';
      reveal.innerHTML = '<h4>Correct Matches</h4>' + left.map((l,i) => `<p><strong>${l}</strong> → ${pairs[i].definition}</p>`).join('');
      container.appendChild(reveal);
      showFeedback(false);
    }

    const nextBtn = document.getElementById('next-task');
    if (nextBtn) nextBtn.style.display = 'inline-block';
  });
}

