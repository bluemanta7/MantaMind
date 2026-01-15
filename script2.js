
// Global state
let challengeStarted = false;
let stepIndex = 0;
let wordIndex = 0;
let currentUser = null;
let userData = {};
let wordData = [];
let currentWord = null; // added global so multiple parts of the app can reference it

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

  updateStreak(false);

  disableTypingChallenge();
  disableMultipleChoice(); // Optional: if using multiple choice
}

document.addEventListener('DOMContentLoaded', () => {
  // Authentication & User Data
  loadUserData();
  setupAuthToggle();
  if (window.location.pathname.includes('challenge.html')) {
    redirectIfNotLoggedIn();
  }

  document.getElementById('give-up-btn').addEventListener('click', revealAnswer);

  // UI Setup
  setupBurgerMenu();
  setupLogout();

  // Challenge Logic
  loadWordData();
  syncChallengeStatus();
  setupChallengeButtons();

  // Hint listener
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
// consolidated loadWordData: tries relative paths, populates word-list, shuffles, and optionally starts challenge
function loadWordData() {
  // Try relative paths so browsers can fetch the file when served by a local server / hosted
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
        // support both formats: array or { words: [...] }
        wordData = Array.isArray(data) ? data : data.words || [];
        if (!Array.isArray(wordData)) wordData = [];
        shuffleArray(wordData);
        console.log('✅ Loaded', wordData.length, 'words from', path);

        // Ensure conservative forms are present for form-match
        try { augmentWordForms(); } catch (e) { console.warn('augmentWordForms failed', e); }

        // Display all words in the list (if exists)
        const wordListEl = document.getElementById('word-list');
        if (wordListEl) {
          wordListEl.innerHTML = ''; // Clear existing content
          wordData.forEach(entry => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${entry.word}</strong>: ${entry.definition}`;
            wordListEl.appendChild(li);
          });
        }

        // If the page is reloaded mid-challenge, load the current task
        if (challengeStarted) {
          loadTask(challengeSteps[stepIndex]);
        }

        // Optional: start challenge automatically if challengeStarted flag is true
        if (challengeStarted && (!currentWord || !document.getElementById('task-container').innerHTML.trim())) {
          startChallenge();
        }
      })
      .catch(err => {
        console.warn(`Failed to load ${path}:`, err);
        // try next candidate
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
    loadUserStreaks();
  }
}

function loadUserStreaks() {
  if (!currentUser || !userData[currentUser]) return;

  const user = userData[currentUser];
  document.getElementById('current-streak').textContent = user.currentStreak || 0;
  document.getElementById('best-streak').textContent = user.bestStreak || 0;
}


// ============================================
// UI & NAVIGATION SETUP
// ============================================
function setupBurgerMenu() {
  const burger = document.getElementById('burger-btn');
  const sidebar = document.getElementById('sidebar-menu');
  if (burger && sidebar) {
    burger.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
    });
  }
}

function setupLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('challengeStarted'); // Clear challenge state on logout
      window.location.href = 'login.html';
    });
  }
}

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

    if(giveUpBtn) {
        giveUpBtn.addEventListener('click', () => {
            const cw = currentWord || wordData[wordIndex];
            if (!cw) return;
            showCorrectAnswer(cw.word, cw.definition);
            updateProgress(false, cw.word);
            const nextBtnEl = document.getElementById('next-task');
            if (nextBtnEl) nextBtnEl.style.display = 'inline-block';
            
            // Disable any interactive elements
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
  // Retrieve step and word indices if they exist
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

  // choose a random word for the first (or current) task
  currentWord = wordData[Math.floor(Math.random() * wordData.length)];
  const format = ['multiple-definition', 'multiple-word', 'choose-sentence', 'form-match'][Math.floor(Math.random() * 4)];

  document.getElementById('give-up-btn').style.display = 'inline-block';
  const nextTaskBtn = document.getElementById('next-task');
  if (nextTaskBtn) nextTaskBtn.textContent = 'Next Task';
  const feedbackEl = document.getElementById('feedback');
  if (feedbackEl) feedbackEl.textContent = '';
  const hintBtnEl = document.getElementById('hint-btn');
  if (hintBtnEl) hintBtnEl.style.display = 'inline-block'; // ✅ Always show hint when challenge starts

  if (format === 'multiple-definition') showMultipleChoiceDefinition(currentWord);
  else if (format === 'multiple-word') showMultipleChoiceWord(currentWord);
  else if (format === 'choose-sentence') loadTask('choose-sentence');
  else if (format === 'form-match') showFormMatchQuestion(currentWord);
  else showMultipleChoiceDefinition(currentWord);
}


function advanceToNextTask() {
    stepIndex++;

    if (stepIndex >= challengeSteps.length) {
        // Move to the next word and reset steps
        stepIndex = 0;
        wordIndex = (wordIndex + 1) % wordData.length;
    }
    
    // Save progress
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
  
  // Basic safety check
  if (!cw) {
      console.error(`Invalid wordIndex: ${wordIndex}`);
      container.innerHTML = '<p>⚠️ Error: Could not find the current word.</p>';
      return;
  }

  // ensure global currentWord is in sync if using loadTask alone
  currentWord = cw;

  const synonymHint = cw.synonyms ? cw.synonyms[Math.floor(Math.random() * cw.synonyms.length)] : 'No synonym available';

  if (type === 'definition-match') {
    // Get a random wrong definition from a *different* word
    let randomWord;
    do {
      randomWord = wordData[Math.floor(Math.random() * wordData.length)];
    } while (randomWord.word === cw.word);
    
    const options = [
        { text: cw.definition, correct: true },
        { text: randomWord.definition, correct: false }
    ];
    shuffleArray(options); // Randomize button order

    container.innerHTML = `
      <p>What does "<strong>${cw.word}</strong>" mean?</p>
      <button class="choice-btn" data-correct="${options[0].correct}" onclick="handleMultipleChoice(${options[0].correct}, this, '${cw.word}', '${cw.definition}')">${options[0].text}</button>
      <button class="choice-btn" data-correct="${options[1].correct}" onclick="handleMultipleChoice(${options[1].correct}, this, '${cw.word}', '${cw.definition}')">${options[1].text}</button>
    `;

  } else if (type === 'choose-sentence') {
    // Use another word's example as a distractor (keep it blank) for more variety
    // Keep correct example blank in UI (do NOT reveal target). If it lacks '____', blank the target word or a long word as fallback.
    let correctExample = cw.examples && cw.examples[0] ? cw.examples[0] : '';
    if (!/____/.test(correctExample)) {
      const esc = cw.word.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
      const replaced = correctExample.replace(new RegExp('\\b' + esc + '\\b', 'i'), '____');
      if (replaced === correctExample) {
        correctExample = correctExample.replace(/\b([A-Za-z]{4,})\b/, '____');
      } else {
        correctExample = replaced;
      }
    }

    // Ensure the correct example is non-empty
    if (!correctExample || !correctExample.trim()) correctExample = 'This sentence contains ____.';

    // pick one distractor from other words' examples
    const pool = wordData.filter(w => w.word !== cw.word && w.examples && w.examples.length);
    shuffleArray(pool);
    let wrongSentence = pool.length ? pool[0].examples[0] : '____';
    // Blank any vocabulary word found in the wrong sentence to avoid accidental reveals
    const allWordsPattern = wordData.map(w => w.word.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|');
    const allWordsRegex = new RegExp('\\b(' + allWordsPattern + ')\\b', 'gi');
    wrongSentence = wrongSentence.replace(allWordsRegex, '____');
    // Ensure at least one blank exists (fallback: blank a longish word)
    if (!/____/.test(wrongSentence)) {
      wrongSentence = wrongSentence.replace(/\b([A-Za-z]{4,})\b/, '____');
    }
    // Final fallback if the wrong sentence is empty
    if (!wrongSentence || !wrongSentence.trim()) wrongSentence = 'This sentence contains ____.';
    
    let options = [
        { text: correctExample, correct: true },
        { text: wrongSentence, correct: false }
    ];
    shuffleArray(options); // Randomize button order

    // Harden distractors: blank target or any vocab words and ensure uniqueness
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

    // Ensure unique option texts
    const seen = new Set();
    options = options.map(opt => {
      let text = opt.text;
      const key = text.toLowerCase();
      if (seen.has(key)) {
        text = 'This sentence contains ____.';
      }
      seen.add(text.toLowerCase());
      return { text, correct: opt.correct };
    });

    container.innerHTML = `
      <p>Which sentence uses "<strong>${cw.word}</strong>" correctly?</p>
      <button class="choice-btn" data-correct="${options[0].correct}" onclick="handleMultipleChoice(${options[0].correct}, this, '${cw.word}', '${cw.definition}')">${options[0].text}</button>
      <button class="choice-btn" data-correct="${options[1].correct}" onclick="handleMultipleChoice(${options[1].correct}, this, '${cw.word}', '${cw.definition}')">${options[1].text}</button>
    `;
  } else if (type === 'form-match') {
    showFormMatchQuestion(cw);
  } else {
    // fallback: show a simple definition match if type is unexpected
    container.innerHTML = `<p>Unknown task type. Showing definition for <strong>${cw.word}</strong>:</p><p>${cw.definition}</p>`;
  }
}

function handleMultipleChoice(isCorrect, button, word, definition) {
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
  });

  if (button) button.classList.add(isCorrect ? 'correct-choice' : 'incorrect-choice');
  if (button) button.innerHTML += isCorrect ? " ✅" : " ❌";

  if (!isCorrect) {
    // Highlight correct button if present
    const correctBtn = document.querySelector('.choice-btn[data-correct="true"]');
    if (correctBtn) {
      correctBtn.classList.add('correct-choice');
      if (!/✅/.test(correctBtn.innerHTML)) correctBtn.innerHTML += ' ✅';
      correctBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

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

  let exampleHTML = '';
  if (currentWord && Array.isArray(currentWord.examples) && currentWord.examples.length) {
    const ex = currentWord.examples[0];
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
// PROGRESS TRACKING
// ============================================
function updateProgress(isCorrect, word) {
  if (!currentUser || !userData[currentUser]) return;

  const user = userData[currentUser];

  // Initialize structures if they don't exist
  user.learnedWords = user.learnedWords || [];
  user.inProgressWords = user.inProgressWords || [];
  user.wordProgress = user.wordProgress || {};
  user.currentStreak = user.currentStreak || 0;
  user.bestStreak = user.bestStreak || 0;
  user.wordProgress[word] = user.wordProgress[word] || 0;

  if (isCorrect) {
    user.wordProgress[word]++;
    user.currentStreak++;
    if (user.currentStreak > user.bestStreak) {
      user.bestStreak = user.currentStreak;
    }

    if (user.wordProgress[word] >= 3 && !user.learnedWords.includes(word)) {
      user.learnedWords.push(word);
      user.inProgressWords = user.inProgressWords.filter(w => w !== word);
    } else if (!user.inProgressWords.includes(word) && !user.learnedWords.includes(word)) {
      user.inProgressWords.push(word);
    }
  } else {
    user.currentStreak = 0;
    user.wordProgress[word] = 0;

    if (user.learnedWords.includes(word)) {
      user.learnedWords = user.learnedWords.filter(w => w !== word);
      user.inProgressWords.push(word);
    } else if (!user.inProgressWords.includes(word)) {
      user.inProgressWords.push(word);
    }
  }

  const currentStreakEl = document.getElementById('current-streak');
  const bestStreakEl = document.getElementById('best-streak');
  if (currentStreakEl) currentStreakEl.textContent = user.currentStreak;
  if (bestStreakEl) bestStreakEl.textContent = user.bestStreak;

  localStorage.setItem('userData', JSON.stringify(userData));
}


// ============================================
// AUTH SYSTEM (for login.html)
// ============================================
function setupAuthToggle() {
    const authForm = document.getElementById('auth-form');
    const switchLink = document.getElementById('switch-mode');
    if (!authForm) return; // Only run on login page

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
        // Re-attach listener after innerHTML is changed
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
                    password: password, // In a real app, hash this!
                    learnedWords: [], inProgressWords: [], wordProgress: {},
                    currentStreak: 0, bestStreak: 0
                };
                loginUser(username);
            }
        } else { // Login
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

// New: Form-match question type (mirrors implementation in script.js)
function showFormMatchQuestion(wordObj) {
  const cw = wordObj || wordData[wordIndex];
  const container = document.getElementById('task-container');
  if (!container || !cw || !Array.isArray(cw.forms) || cw.forms.length === 0) {
    loadTask('choose-sentence');
    return;
  }

  const form = cw.forms[Math.floor(Math.random() * cw.forms.length)];
  let sentence = form.sentence || '';
  // safety fallback for empty form sentences
  if (!sentence || !String(sentence).trim()) sentence = 'This sentence contains ____.';
  if (!/____/.test(sentence)) {
    const esc = form.variant ? form.variant.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') : '';
    if (esc) sentence = sentence.replace(new RegExp('\\b' + esc + '\\b', 'i'), '____');
    if (!/____/.test(sentence)) sentence = sentence.replace(/\b([A-Za-z]{4,})\b/, '____');
  }

  // Build variants list
  let variants = cw.forms.map(f => f.variant).filter(Boolean);
  variants = Array.from(new Set(variants));
  const correctVariant = form.variant;
  if (!variants.includes(correctVariant)) variants.unshift(correctVariant);

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

  while (variants.length < 4) variants.push('None of the above');

  variants = variants.slice(0, 4);
  shuffleArray(variants);

  container.innerHTML = `
    <p>Which <strong>variant</strong> of "<strong>${cw.word}</strong>" fits the sentence?</p>
    <p>${sentence}</p>
    <div class="choices-row">
      ${variants.map(opt => `<div class="choice-wrapper"><button class="choice-btn" data-variant="${opt.replace(/"/g, '&quot;')}" onclick="handleFormChoiceByVariant(this.dataset.variant, '${correctVariant.replace(/'/g, "\\'")}', this, '${cw.word.replace(/'/g, "\\'")}')">${opt}</button></div>`).join('\n')}
    </div>
  `;
}

// Legacy handler - convert to variant-based handler
function handleFormChoice(isCorrect, button, word, correctType, variant) {
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

/* 
Note: functions referenced below like showMultipleChoiceDefinition, showMultipleChoiceWord, showFillInBlank,
showTypingChallenge must exist elsewhere in your codebase. I intentionally didn't change them to avoid
"crazy" edits. If they don't exist, you'll get reference errors — let me know and I can unify them with
the existing loadTask/handleMultipleChoice implementation.
*/

function renderMultipleChoice(promptText, choices, correctAnswer, feedbackFormatter) {
  document.getElementById('task-container').innerHTML = `
    <p>${promptText}</p>
    ${choices.map(choice => `<button class="choice-btn">${choice}</button>`).join('')}
    <hr class="divider" />
  `;

  document.querySelectorAll('.choice-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const correct = btn.textContent === wordObj.word;
    if (correct) {
      document.getElementById('feedback').textContent = '✅ Correct!';
      updateStreak(true);
      disableMultipleChoice(); // Optional: disables buttons
    } else {
      document.getElementById('feedback').textContent = '❌ Try again.';
      updateStreak(false);
    }
  });
});

}

renderMultipleChoice(
  `❓ Which word matches this definition: "<em>${wordObj.definition}</em>"`,
  shuffledChoices,
  wordObj.word,
  correct => correct ? '✅ Correct!' : `❌ Incorrect. The correct word was "${wordObj.word}".`
);

function disableMultipleChoice() {
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
  });
  document.getElementById('hint-btn').style.display = 'none';
}
