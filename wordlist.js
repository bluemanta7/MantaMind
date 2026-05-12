// ============================================
// WORDLIST FUNCTIONALITY
// ============================================
// Burger menu & logout are now handled by nav.js

// TTS helper utilities
function playTTS(text) {
  if (!text) return;
  const utter = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.speak(utter);
}

function getTTSButton(text) {
  if (!text) return '';
  const esc = String(text).replace(/'/g, "\\'").replace(/\"/g, '&quot;');
  return `<button class="tts-btn" onclick="playTTS('${esc}')">🔊</button>`;
}

// 🚪 Logout Button - Also in nav.js but re-added for safety
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn && !logoutBtn.hasListener) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('userData');
      localStorage.removeItem('challengeStarted');
      window.location.href = 'login.html';
    });
    logoutBtn.hasListener = true;
  }

  // 📦 Load and Display Word List with Progress
  const currentUser = localStorage.getItem('currentUser');
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  if (!currentUser || !userData[currentUser]) {
    const wordList = document.getElementById('word-list');
    wordList.innerHTML = "<li><strong>Please log in first to view the word list.</strong></li>";
    return;
  }

  fetch('./data.json')
    .then(res => res.json())
    .then(data => {
      const wordList = Array.isArray(data) ? data : data.words;
      const listEl = document.getElementById('word-list');
      const user = userData[currentUser];
      listEl.innerHTML = '';

      wordList.forEach(entry => {
        const wordStreaks = user.wordStreaks || {};
        const streak = wordStreaks[entry.word] || 0;
        const isLearned = (user.learnedWords || []).includes(entry.word);
        const isInProgress = (user.inProgressWords || []).includes(entry.word) || streak > 0;

        let statusBadge = '';
        let streakDisplay = '';
        let statusClass = '';

        if (isLearned) {
          statusBadge = '<span class="status-badge learned">✅ Learned</span>';
          statusClass = 'learned';
        } else if (isInProgress) {
          statusBadge = '<span class="status-badge in-progress">🔄 In Progress</span>';
          const userSettings = (user && user.settings) || {};
          const thresh = parseInt(userSettings.progressTarget || 3, 10);
          streakDisplay = `<span class="word-streak">🔥 Streak: ${streak}/${thresh}</span>`;
          statusClass = 'in-progress';
        } else {
          statusBadge = '<span class="status-badge not-started">📝 Not Started</span>';
          statusClass = 'not-started';
        }

        const li = document.createElement('li');
        li.className = `word-item ${statusClass}`;
        li.innerHTML = `
          <div class="word-header">
            <strong class="word-title">${entry.word}</strong> ${getTTSButton(entry.word)}
            ${statusBadge}
            ${streakDisplay}
          </div>
          <div class="word-definition"><strong>Definition:</strong> ${entry.definition}</div>
          <div class="word-example"><strong>Example:</strong> ${entry.examples[0]}</div>
        `;
        listEl.appendChild(li);
      });
    })
    .catch(err => {
      console.error('❌ Failed to load data.json:', err);
      document.getElementById('word-list').innerHTML = '<li>⚠️ Could not load word list.</li>';
    });
});