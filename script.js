// Global state
let challengeStarted = false;
let stepIndex = 0;
let wordIndex = 0;
let currentUser = null;
let userData = {};
let wordData = [];
let currentWord = null;

const challengeSteps = ['definition-match', 'choose-sentence', 'form-match'];

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

  // Ensure the progress label/bar reflects any saved settings immediately
  try { updateProgressBar(); } catch (e) { /* ignore if page doesn't show progress */ }
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

        // Ensure each word has up to 4 conservative form variants for form-match questions
        try { augmentWordForms(); } catch (e) { console.warn('augmentWordForms failed', e); }

        // Update progress UI now that we have word data (so partial progress can be computed)
        try { updateProgressBar(); } catch (e) { /* ignore on pages that don't show progress */ }

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
      // Highlight the correct choice if it exists
      const correctBtn = document.querySelector('.choice-btn[data-correct="true"]');
      if (correctBtn) {
        correctBtn.classList.add('correct-choice');
        if (!/✅/.test(correctBtn.innerHTML)) correctBtn.innerHTML += ' ✅';
      }
      document.querySelectorAll('.choice-btn').forEach(el => el.disabled = true);
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
    if (userSettings.formMatch) enabledFormats.push('form-match');
    if (userSettings.matching) enabledFormats.push('matching');
  } catch (e) {
    // fallback: if something goes wrong, enable all
    enabledFormats.push('multiple-definition', 'multiple-word', 'choose-sentence');
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
  else if (format === 'matching') showMatchingQuestion();
  else if (format === 'form-match') showFormMatchQuestion(currentWord);
  else showMultipleChoiceDefinition(currentWord);
}

// Return current user settings (with defaults)
function getUserSettings() {
  const currentUser = localStorage.getItem('currentUser');
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  const appSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  const defaults = { multipleChoice: true, matching: false, formMatch: false, theme: 'blue', wordThreshold: 3, progressTargetWords: 10 };

  // prefer per-user settings
  let s = null;
  if (currentUser && userData[currentUser] && userData[currentUser].settings) s = Object.assign({}, defaults, userData[currentUser].settings);
  else if (appSettings && Object.keys(appSettings).length > 0) s = Object.assign({}, defaults, appSettings);
  else s = Object.assign({}, defaults);

  // Migration: old key `progressTarget` used to mean per-word threshold; if present and newer keys missing, map it
  if (s.progressTarget && !s.wordThreshold && !('wordThreshold' in s)) {
    const maybe = parseInt(s.progressTarget, 10);
    if (!isNaN(maybe)) s.wordThreshold = maybe;
  }

  // Ensure numeric types
  s.wordThreshold = parseInt(s.wordThreshold || defaults.wordThreshold, 10);
  s.progressTargetWords = parseInt(s.progressTargetWords || defaults.progressTargetWords, 10);

  return s;
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
      ${options.map((opt) => `<button class="choice-btn" data-correct="${opt.correct}" onclick="handleMultipleChoice(${opt.correct}, this, '${cw.word}', '${cw.definition.replace(/'/g, "\\'")}')">${opt.text}</button>`).join('')}
    `;

  } else if (type === 'choose-sentence') {
    // 1 correct example (filled) + up to 3 distractor examples (blanked) from other words for variety
    const example = cw.examples && cw.examples[0] ? cw.examples[0] : '';
    // Keep the correct example blank in the UI (do NOT reveal the target word).
    // If the example already contains '____' keep as-is; otherwise blank the target word if present or blank a longish word as fallback.
    let correctSentence = example || '';
    if (!/____/.test(correctSentence)) {
      const esc = cw.word.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
      const replaced = correctSentence.replace(new RegExp('\\b' + esc + '\\b', 'i'), '____');
      if (replaced === correctSentence) {
        // target word wasn't present; blank a long word as fallback to indicate missing word
        correctSentence = correctSentence.replace(/\b([A-Za-z]{4,})\b/, '____');
      } else {
        correctSentence = replaced;
      }
    }

    // Ensure the correct sentence is non-empty
    if (!correctSentence || !correctSentence.trim()) correctSentence = 'This sentence contains ____.';

    // Build distractors from other words' examples (keep them blank)
    const pool = wordData.filter(w => w.word !== cw.word && w.examples && w.examples.length);
    shuffleArray(pool);
    // Prepare regex to blank any known vocabulary word to avoid revealing answers
    const allWordsPattern = wordData.map(w => w.word.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|');
    const allWordsRegex = new RegExp('\\b(' + allWordsPattern + ')\\b', 'gi');

    const distractSentences = pool.slice(0, 3).map(w => {
      let s = w.examples[0] || '';
      s = String(s);
      // Blank any vocabulary word found in the sentence to avoid leaks
      s = s.replace(allWordsRegex, '____');
      // Ensure at least one blank exists (fallback: blank a longish word)
      if (!/____/.test(s)) {
        s = s.replace(/\b([A-Za-z]{4,})\b/, '____');
      }
      // Final fallback if the sentence ended up empty
      if (!s || !s.trim()) s = 'This sentence contains ____.';
      return s;
    });

    let options = [{ text: correctSentence, correct: true }, ...distractSentences.map(s => ({ text: s, correct: false }))];
    shuffleArray(options);

    // Ensure incorrect options don't accidentally reveal any vocabulary words (including the target)
    const cwEsc = cw.word.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const cwRegex = new RegExp('\\b' + cwEsc + '\\b', 'gi');

    options = options.map(opt => {
      if (opt.correct) return opt;
      // allWordsRegex is already computed above in this scope; reuse it
      let txt = opt.text ? String(opt.text) : '';
      txt = txt.replace(allWordsRegex, '____');
      txt = txt.replace(cwRegex, '____');
      if (!/____/.test(txt)) txt = txt.replace(/\b([A-Za-z]{4,})\b/, '____');
      if (!txt || !txt.trim()) txt = 'This sentence contains ____.';
      return { text: txt, correct: false };
    });

    // Ensure no duplicate text options (unique by text); replace duplicates with blank fallback
    const seen = new Set();
    options = options.map(opt => {
      let text = opt.text;
      const key = text.toLowerCase();
      if (seen.has(key)) {
        // replace with a generic blanked sentence to preserve choice count
        text = 'This sentence contains ____.';
      }
      seen.add(text.toLowerCase());
      return { text, correct: opt.correct };
    });

    container.innerHTML = `
      <p>Which sentence uses "<strong>${cw.word}</strong>" correctly?</p>
      ${options.map(opt => `<button class="choice-btn" data-correct="${opt.correct}" onclick="handleMultipleChoice(${opt.correct}, this, '${cw.word}', '${cw.definition}')">${opt.text}</button>`).join('')}
    `;
  } else if (type === 'form-match') {
    // Delegate to the form-match renderer
    showFormMatchQuestion(cw);
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
    // Highlight the correct choice button if present
    const correctBtn = document.querySelector('.choice-btn[data-correct="true"]');
    if (correctBtn) {
      correctBtn.classList.add('correct-choice');
      if (!/✅/.test(correctBtn.innerHTML)) correctBtn.innerHTML += ' ✅';
      // scroll into view for clarity
      correctBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Preserve existing reveal behavior
    showCorrectAnswer(word, definition);
  }

  showFeedback(isCorrect);
  updateProgress(isCorrect, word);
  const nextBtn = document.getElementById('next-task');
  if (nextBtn) nextBtn.style.display = 'inline-block';
}



function showCorrectAnswer(word, definition) {
  const container = document.getElementById('task-container');
  if (!container) return;
  const revealBox = document.createElement('div');
  revealBox.className = 'reveal-box';

  // Show definition and a helpful example (blanked) so users see context without the explicit answer
  let exampleHTML = '';
  if (currentWord && Array.isArray(currentWord.examples) && currentWord.examples.length) {
    const ex = currentWord.examples[0];
    // blank any appearance of the target word to avoid revealing the answer
    const esc = String(currentWord.word).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const exBlanked = ex.replace(new RegExp('\\b' + esc + '\\b', 'gi'), '____');
    exampleHTML = `<p><strong>Example:</strong> ${exBlanked}</p>`;
  }

  revealBox.innerHTML = `
    <p><strong>Definition:</strong> ${definition}</p>
    ${exampleHTML}
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

    // Mark as learned if word streak reaches configured per-word threshold
    const settings = getUserSettings();
    const threshold = parseInt(settings.wordThreshold || 3, 10);
    if (user.wordStreaks[word] >= threshold && !user.learnedWords.includes(word)) {
      user.learnedWords.push(word);
      user.inProgressWords = user.inProgressWords.filter(w => w !== word);
      console.log(`🎉 "${word}" marked as learned! (Streak: ${user.wordStreaks[word]}) (threshold ${threshold})`);
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

  const settings = getUserSettings();
  const thresh = parseInt(settings.wordThreshold || 3, 10);
  console.log(`Word "${word}" streak: ${user.wordStreaks[word]}/${thresh}`);
}

function updateProgressTargetLabel(wordThreshold, progressGoal) {
  // show a small label under the main completion bar explaining both thresholds
  try {
    const container = document.getElementById('completion-bar-container');
    if (!container) return;
    let el = document.getElementById('completion-target');
    if (!el) {
      el = document.createElement('div');
      el.id = 'completion-target';
      el.className = 'completion-target';
      el.style.fontSize = '0.85rem';
      el.style.marginTop = '6px';
      el.style.textAlign = 'center';
      container.appendChild(el);
    }
    el.textContent = `Per-word: ${wordThreshold} • Questions goal: ${progressGoal}`;
  } catch (e) {
    // silent fail if DOM structure differs on some pages
  }
}

function updateProgressBar() {
  // allow showing progress for app-wide settings even when no explicit user is set
  const settings = getUserSettings();
  if (!currentUser || !userData[currentUser]) {
    // show the target label based on settings (app or defaults)
    updateProgressTargetLabel(settings.wordThreshold, settings.progressTargetWords);
    return;
  }

  const user = userData[currentUser];
  const settingsLocal = getUserSettings();
  const progressGoal = parseInt(settingsLocal.progressTargetWords || 10, 10);
  let percentage = 0;

  // We want the completion bar to reflect partial progress across words:
  // Sum min(streak / wordThreshold, 1) across known words and compare to progressGoal.
  const wordThreshold = parseInt(settingsLocal.wordThreshold || 3, 10);
  let progressSum = 0;

  if (Array.isArray(wordData) && wordData.length) {
    wordData.forEach(w => {
      const s = (user.wordStreaks && user.wordStreaks[w.word]) ? (user.wordStreaks[w.word] || 0) : 0;
      progressSum += Math.min(s / Math.max(1, wordThreshold), 1);
    });
    percentage = Math.min(Math.round((progressSum / progressGoal) * 100), 100);
  } else {
    // Fallback: if we don't have wordData yet, use learned count as 1 point each
    const learned = Array.isArray(user.learnedWords) ? user.learnedWords.length : 0;
    percentage = Math.min(Math.round((learned / progressGoal) * 100), 100);
  }

  // Update visible label that explains both targets
  updateProgressTargetLabel(wordThreshold, progressGoal);

  const progressBar = document.getElementById('completion-bar');
  // read previous percentage for victory detection
  const prevPercentage = progressBar && progressBar.dataset ? parseInt(progressBar.dataset.lastPercent || '0', 10) : 0;

  if (progressBar) {
    progressBar.style.width = percentage + '%';
    progressBar.textContent = percentage + '%';
    progressBar.dataset.lastPercent = String(percentage);
  }

  // helper to compute raw progress state (exposed for diagnostics)
  function getProgressState() {
    const settingsLocal = getUserSettings();
    const wordThreshold = parseInt(settingsLocal.wordThreshold || 3, 10);
    const progressGoal = parseInt(settingsLocal.progressTargetWords || 10, 10);
    let progressSum = 0;
    if (Array.isArray(wordData) && wordData.length) {
      wordData.forEach(w => {
        const s = (user.wordStreaks && user.wordStreaks[w.word]) ? (user.wordStreaks[w.word] || 0) : 0;
        progressSum += Math.min(s / Math.max(1, wordThreshold), 1);
      });
    }
    const percentage = progressGoal > 0 ? Math.min(100, Math.round((progressSum / progressGoal) * 100)) : 0;
    return { progressSum, progressGoal, wordThreshold, percentage };
  }

  // setup help tooltip behavior once (if present)
  try {
    const helpBtn = document.getElementById('completion-help');
    const helpTip = document.getElementById('completion-help-tooltip');
    if (helpBtn && helpTip && !helpBtn.dataset.hasListener) {
      const showTip = (ev) => {
        helpTip.classList.add('show');
        helpTip.setAttribute('aria-hidden', 'false');
        // position to the left of the button when space allows
        const rect = helpBtn.getBoundingClientRect();
        helpTip.style.left = Math.max(8, rect.left - helpTip.offsetWidth + rect.width + 6) + 'px';
        helpTip.style.top = (rect.bottom + 8) + 'px';
      };
      const hideTip = () => { helpTip.classList.remove('show'); helpTip.setAttribute('aria-hidden', 'true'); };
      helpBtn.addEventListener('mouseenter', showTip);
      helpBtn.addEventListener('focus', showTip);
      helpBtn.addEventListener('mouseleave', hideTip);
      helpBtn.addEventListener('blur', hideTip);
      helpBtn.addEventListener('click', (e) => { e.preventDefault(); showTip(); setTimeout(hideTip, 6000); });
      helpBtn.dataset.hasListener = '1';
    }
  } catch (e) { /* ignore */ }

  // add debug buttons handlers for preview and details (if present)
  try {
    const previewBtn = document.getElementById('preview-victory');
    if (previewBtn && !previewBtn.dataset.listener) {
      previewBtn.addEventListener('click', (e) => { e.preventDefault(); showVictory(); });
      previewBtn.dataset.listener = '1';
    }

    const detailsBtn = document.getElementById('progress-details');
    if (detailsBtn && !detailsBtn.dataset.listener) {
      detailsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const state = getProgressState();
        alert(`Progress details:\n- Word threshold: ${state.wordThreshold}\n- Progress goal (questions): ${state.progressGoal}\n- Progress sum (points): ${state.progressSum.toFixed(2)}\n- Percentage: ${state.percentage}%`);
      });
      detailsBtn.dataset.listener = '1';
    }
  } catch (e) { /* ignore */ }
  const profileBar = document.getElementById('progress-bar');
  if (profileBar) {
    profileBar.style.width = percentage + '%';
    profileBar.textContent = percentage + '%';
    profileBar.dataset.lastPercent = String(percentage);
  }

  // If we just reached 100% (enough learned words), trigger victory animation once
  if (percentage === 100 && prevPercentage < 100) {
    showVictory();
  }
}

// Show a temporary victory overlay with confetti
function showVictory() {
  // prevent overlapping or repeated calls within short time
  if (document.getElementById('victory-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'victory-overlay';
  overlay.className = 'show';
  overlay.innerHTML = `<div style="font-size:1.4em;">🎉</div><div>Perfect! Progress complete.</div>`;
  document.body.appendChild(overlay);

  // spawn confetti pieces
  const colors = ['#ff6b6b','#ffdfd6','#a64cd9','#ffd36b','#6de6a3','#2ecc71'];
  for (let i = 0; i < 18; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = (20 + Math.random() * 60) + '%';
    piece.style.top = (Math.random() * 20) + '%';
    piece.style.background = colors[Math.floor(Math.random()*colors.length)];
    piece.style.transform = `translateY(-20vh) rotate(${Math.random()*360}deg)`;
    piece.style.animationDelay = (Math.random()*200)+'ms';
    piece.style.animationDuration = (900 + Math.random()*900)+'ms';
    document.body.appendChild(piece);
    // cleanup after animation
    setTimeout(() => piece.remove(), 2200);
  }

  // remove overlay after a short delay
  setTimeout(() => {
    if (overlay) {
      overlay.classList.remove('show');
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 400);
    }
  }, 2600);
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

// Augment words with conservative form variants (up to 4 total) so form-match always has choices
function augmentWordForms() {
  if (!Array.isArray(wordData)) return;
  let augmented = 0;
  const augmentLog = [];

  wordData.forEach(cw => {
    if (!cw || !cw.word) return;

    // ensure forms exists
    cw.forms = Array.isArray(cw.forms) ? cw.forms.slice() : [];
    const existing = new Set(cw.forms.map(f => String(f.variant).toLowerCase()).filter(Boolean));

    const base = String(cw.word);
    const baseLower = base.toLowerCase();
    const example = cw.examples && cw.examples[0] ? cw.examples[0] : null;

    // Collect POS evidence from explicit forms
    const nounVariants = cw.forms.filter(f => /\bnoun\b/i.test(f.type)).map(f => String(f.variant));
    const verbVariants = cw.forms.filter(f => /\bverb\b/i.test(f.type)).map(f => String(f.variant));

    const candidates = [];

    // prefer adding the base form if missing
    if (!existing.has(baseLower)) {
      candidates.push({ type: 'base', variant: base.toLowerCase(), sentence: example ? example.replace(/____/g, base) : `The ${base} was noted.` });
    }

    // Noun plural: only generate from an explicit noun variant (prefer one matching base)
    if (nounVariants.length) {
      const nounMatchBase = nounVariants.find(v => String(v).toLowerCase() === baseLower);
      const nounToPluralize = nounMatchBase || nounVariants[0];
      if (nounToPluralize) {
        const plural = String(nounToPluralize) + 's';
        if (!existing.has(plural.toLowerCase())) {
          candidates.push({ type: 'noun (plural)', variant: plural, sentence: example ? example.replace(/____/g, plural) : `The ${plural} were noted.` });
        }
      }
    }

    // Verb-derived forms: only derive from an explicit verb variant or if definition starts with "to"
    const verbSources = verbVariants.slice();
    if (!verbSources.length && /^to\s+/i.test(cw.definition || '')) {
      // treat base as a verb source if definition indicates infinitive
      verbSources.push(base.toLowerCase());
    }

    for (const vsrc of verbSources) {
      const vs = String(vsrc);
      // gerund
      const ing = (vs.endsWith('e') && vs.length > 2) ? (vs.slice(0, -1) + 'ing') : (vs + 'ing');
      if (!existing.has(ing.toLowerCase())) candidates.push({ type: 'gerund', variant: ing, sentence: example ? example.replace(/____/g, ing) : `${ing} was observed.` });
      // simple past (naive)
      const ed = vs.endsWith('e') ? (vs + 'd') : (vs + 'ed');
      if (!existing.has(ed.toLowerCase())) candidates.push({ type: 'past', variant: ed, sentence: example ? example.replace(/____/g, ed) : `${ed} occurred.` });
    }

    // Add from candidates until we have 4 unique variants
    for (const c of candidates) {
      if (cw.forms.length >= 4) break;
      const v = String(c.variant);
      if (!v) continue;
      const key = v.toLowerCase();
      if (existing.has(key)) continue;
      cw.forms.push({ type: c.type, variant: v, sentence: c.sentence });
      existing.add(key);
      augmented++;
      augmentLog.push({ word: cw.word, added: v, type: c.type });
    }

    // truncate to 4
    if (cw.forms.length > 4) cw.forms = cw.forms.slice(0, 4);
  });

  if (augmentLog.length) console.log('✨ augmentWordForms added variants:', augmentLog);
  console.log(`✨ augmentWordForms: added/filled variants for ${augmented} entries (or variants).`);
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



// New: Form-match question type
function showFormMatchQuestion(wordObj) {
  const cw = wordObj || wordData[wordIndex];
  const container = document.getElementById('task-container');
  if (!container || !cw || !Array.isArray(cw.forms) || cw.forms.length === 0) {
    // fallback to a sentence choice if no forms available
    loadTask('choose-sentence');
    return;
  }

  // pick a random form from the word's forms
  const form = cw.forms[Math.floor(Math.random() * cw.forms.length)];
  // sentence shown should keep the blank (do not reveal variant)
  let sentence = form.sentence || '';
  // safety fallback for empty form sentences
  if (!sentence || !String(sentence).trim()) sentence = 'This sentence contains ____.';

  if (!/____/.test(sentence)) {
    const esc = form.variant ? form.variant.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') : '';
    if (esc) sentence = sentence.replace(new RegExp('\\b' + esc + '\\b', 'i'), '____');
    if (!/____/.test(sentence)) sentence = sentence.replace(/\b([A-Za-z]{4,})\b/, '____');
  }

  // Build variants list (unique)
  let variants = cw.forms.map(f => f.variant).filter(Boolean);
  variants = Array.from(new Set(variants)); // unique

  // Ensure correct variant is present
  const correctVariant = form.variant;
  if (!variants.includes(correctVariant)) variants.unshift(correctVariant);

  // Pad with variants from other words if needed
  if (variants.length < 4) {
    const otherVariants = [];
    wordData.forEach(w => {
      if (w.forms && w.word !== cw.word) {
        w.forms.forEach(f => { if (f.variant) otherVariants.push(f.variant); });
      }
    });
    shuffleArray(otherVariants);
    for (const v of otherVariants) {
      if (variants.length >= 4) break;
      if (!variants.includes(v)) variants.push(v);
    }
  }

  // If still fewer than 4, add generic distractors to reach 4
  while (variants.length < 4) variants.push('None of the above');

  // Limit to 4 choices and shuffle
  variants = variants.slice(0, 4);
  shuffleArray(variants);

  // Render choices wrapped to avoid concatenated copy and include data-variant
  container.innerHTML = `
    <p>Which <strong>variant</strong> of "<strong>${cw.word}</strong>" fits the sentence?</p>
    <p>${sentence}</p>
    <div class="choices-row">
      ${variants.map(opt => `<div class="choice-wrapper"><button class="choice-btn" data-variant="${opt.replace(/"/g, '&quot;')}" onclick="handleFormChoiceByVariant(this.dataset.variant, '${correctVariant.replace(/'/g, "\\'")}', this, '${cw.word.replace(/'/g, "\\'")}')">${opt}</button></div>`).join('\n')}
    </div>
  `;
}

function handleFormChoice(isCorrect, button, word, correctType, variant) {
  // legacy handler (kept for compatibility) - converts to variant-based display
  const correctVariant = variant;
  handleFormChoiceByVariant(correctVariant, correctVariant, button, word);
}

function handleFormChoiceByVariant(selectedVariant, correctVariant, button, word) {
  // Disable further interaction
  document.querySelectorAll('.choice-btn').forEach(btn => btn.disabled = true);

  const isCorrect = String(selectedVariant) === String(correctVariant);

  // Mark selected button
  if (button) {
    button.classList.add(isCorrect ? 'correct-choice' : 'incorrect-choice');
    button.innerHTML += isCorrect ? ' ✅' : ' ❌';
  }

  // If incorrect, highlight the correct option for closure
  if (!isCorrect) {
    // Find the button with matching data-variant (if available) or matching text
    const allBtns = Array.from(document.querySelectorAll('.choice-btn'));
    let correctBtn = allBtns.find(b => (b.dataset && b.dataset.variant && b.dataset.variant === correctVariant));
    if (!correctBtn) {
      correctBtn = allBtns.find(b => b.textContent && b.textContent.trim() === correctVariant);
    }
    if (correctBtn) {
      correctBtn.classList.add('correct-choice');
      if (!/✅/.test(correctBtn.innerHTML)) correctBtn.innerHTML += ' ✅';
    }

    // Also append a reveal-box to provide explicit feedback
    const container = document.getElementById('task-container');
    const revealBox = document.createElement('div');
    revealBox.className = 'reveal-box';
    revealBox.innerHTML = `<p><strong>Correct Variant:</strong> ${correctVariant}</p>`;
    container.appendChild(revealBox);
    // Scroll reveal into view for clarity
    revealBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  showFeedback(isCorrect);
  updateProgress(isCorrect, word);
  const nextBtn = document.getElementById('next-task');
  if (nextBtn) nextBtn.style.display = 'inline-block';
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

