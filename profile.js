// 🍔 Burger Menu Toggle
document.getElementById('burger-btn').addEventListener('click', () => {
  document.getElementById('sidebar-menu').classList.toggle('hidden');
});

// 🚪 Logout Button
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('userData');
  localStorage.removeItem('challengeStarted');
  location.href = 'login.html';
});

// 📊 Achievement Definitions
const achievements = [
  { id: 'first-word', icon: '🎉', name: 'First Steps', desc: 'Learn your first word', requirement: 1 },
  { id: 'five-words', icon: '📚', name: 'Word Collector', desc: 'Learn 5 words', requirement: 5 },
  { id: 'ten-words', icon: '🎓', name: 'Scholar', desc: 'Learn 10 words', requirement: 10 },
  { id: 'streak-5', icon: '🔥', name: 'On Fire', desc: 'Get a 5-word streak', requirement: 5, type: 'streak' },
  { id: 'streak-10', icon: '💥', name: 'Unstoppable', desc: 'Get a 10-word streak', requirement: 10, type: 'streak' },
  { id: 'half-complete', icon: '⭐', name: 'Halfway There', desc: 'Reach 50% completion', requirement: 50, type: 'percent' },
  { id: 'master-rank', icon: '👑', name: 'Vocabulary Master', desc: 'Achieve Master rank', requirement: 75, type: 'percent' },
  { id: 'perfect-5-days', icon: '📅', name: 'Consistency King', desc: 'Hit your daily goal 5 times', requirement: 5, type: 'perfectDays' },
  { id: 'deathtrap-win', icon: '⏱️', name: 'Death Trap Champion', desc: 'Win a Death Trap run', type: 'event' }
];

// 📊 Calculate Rank Based on Completion Percentage
function calculateRank(percentage) {
  if (percentage < 25) return { name: 'Beginner', class: 'beginner', icon: '🌱' };
  if (percentage < 50) return { name: 'Intermediate', class: 'intermediate', icon: '📚' };
  if (percentage < 75) return { name: 'Advanced', class: 'advanced', icon: '🎓' };
  return { name: 'Master', class: 'master', icon: '👑' };
}

// 📊 Load Profile Data
document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = localStorage.getItem('currentUser');
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');

  if (!currentUser || !userData[currentUser]) {
    alert('Please log in first!');
    window.location.href = 'login.html';
    return;
  }

  const user = userData[currentUser];

  // Load word data to get total count
  let totalWords = 0;
  let allWords = [];
  try {
    const response = await fetch('./data.json');
    const data = await response.json();
    allWords = Array.isArray(data) ? data : data.words || [];
    totalWords = allWords.length;
  } catch (error) {
    console.error('Failed to load word data:', error);
    totalWords = 14;
  }

  // Determine per-word threshold and questions goal from settings
  const settings = (user && user.settings) || ( (userData && userData[currentUser] && userData[currentUser].settings) || {} );
  const wordThreshold = parseInt((settings.wordThreshold || settings.progressTarget || 3), 10);
  const progressGoal = parseInt((settings.progressTargetWords || 10), 10);

  // Calculate stats with progressive completion: each word contributes min(streak/wordThreshold,1)
  const learnedCount = (user.learnedWords || []).length;
  const inProgressCount = (user.inProgressWords || []).length;
  let progressSum = 0;
  const wordStreaks = user.wordStreaks || {};
  allWords.forEach(w => { const s = wordStreaks[w.word] || 0; progressSum += Math.min(s / Math.max(1, wordThreshold), 1); });
  const completionPercent = progressGoal > 0 ? Math.min(100, Math.round((progressSum / progressGoal) * 100)) : 0;
  const rank = calculateRank(completionPercent);

  // Update UI
  document.getElementById('username-display').textContent = currentUser;
  document.getElementById('total-words').textContent = totalWords;
  document.getElementById('learned-words').textContent = learnedCount;
  document.getElementById('progress-words').textContent = inProgressCount;
  document.getElementById('completion-percent').textContent = completionPercent + '%';
  document.getElementById('current-streak').textContent = user.currentStreak || 0;
  document.getElementById('best-streak').textContent = user.bestStreak || 0;

  // additional stats
  const totalCorrect = user.stats?.totalCorrect || 0;
  const totalIncorrect = user.stats?.totalIncorrect || 0;
  const accuracy = totalCorrect + totalIncorrect > 0 ? Math.round((totalCorrect/(totalCorrect+totalIncorrect))*100) : 0;
  document.getElementById('accuracy').textContent = accuracy + '%';
  document.getElementById('missed-words').textContent = (user.missedWords || []).length;
  document.getElementById('perfect-days').textContent = user.stats?.perfectDays || 0;

  // Update rank badge
  const rankBadge = document.getElementById('rank-badge');
  rankBadge.textContent = `${rank.icon} ${rank.name}`;
  rankBadge.className = `rank-badge ${rank.class}`;

  // Update progress bar
  const progressBar = document.getElementById('progress-bar');
  progressBar.style.width = completionPercent + '%';
  progressBar.textContent = completionPercent + '%';

  // Display matching highscore if available
  const matchingBestEl = document.getElementById('matching-best');
  if (matchingBestEl) {
    const bestMs = user.matchingHighscore;
    matchingBestEl.textContent = bestMs ? (bestMs/1000).toFixed(3) + ' s' : '—';
  }
  // Death trap best (questions answered in one run)
  const deathBestEl = document.getElementById('deathtrap-best');
  if (deathBestEl) {
    const db = user.stats?.deathTrapBest;
    deathBestEl.textContent = db ? db : '—';
  }

  // Load achievements
  const achievementsContainer = document.getElementById('achievements-container');
  achievementsContainer.innerHTML = '';

  achievements.forEach(achievement => {
    let isUnlocked = false;

    if (achievement.type === 'streak') {
      isUnlocked = (user.bestStreak || 0) >= achievement.requirement;
    } else if (achievement.type === 'percent') {
      isUnlocked = completionPercent >= achievement.requirement;
    } else if (achievement.type === 'perfectDays') {
      isUnlocked = (user.stats?.perfectDays || 0) >= achievement.requirement;
    } else if (achievement.type === 'event') {
      isUnlocked = !!(user.badges && user.badges[achievement.id]);
    } else {
      // assume simple learned-word count
      isUnlocked = learnedCount >= achievement.requirement;
    }

    const achievementDiv = document.createElement('div');
    achievementDiv.className = `achievement ${isUnlocked ? 'unlocked' : 'locked'}`;
    achievementDiv.innerHTML = `
      <div class="achievement-icon">${achievement.icon}</div>
      <div class="achievement-name">${achievement.name}</div>
      <div class="achievement-desc">${achievement.desc}</div>
    `;
    achievementsContainer.appendChild(achievementDiv);
  });

  // Load word progress
  const wordProgressContainer = document.getElementById('word-progress-container');
  if (wordProgressContainer) {
    wordProgressContainer.innerHTML = '';
    
    const wordStreaks = user.wordStreaks || {};
    const learnedWords = user.learnedWords || [];
    const inProgressWords = user.inProgressWords || [];

    // compute threshold for display (same logic as settings parsing)
    const settings = (user && user.settings) || {};
    const threshold = parseInt((settings.wordThreshold || settings.progressTarget || 3), 10);

    allWords.forEach(wordEntry => {
      const word = wordEntry.word;
      const streak = wordStreaks[word] || 0;
      const isLearned = learnedWords.includes(word);
      const isInProgress = inProgressWords.includes(word);

      let statusClass = '';
      let statusText = '📝 Not Started';

      if (isLearned) {
        statusClass = 'learned';
        statusText = '✅ Learned';
      } else if (isInProgress || streak > 0) {
        statusClass = 'in-progress';
        statusText = `🔄 ${streak}/${threshold}`;
      }

      const wordCard = document.createElement('div');
      wordCard.className = `word-progress-card ${statusClass}`;
      wordCard.innerHTML = `
        <div class="word-progress-title">${word}</div>
        <div class="word-progress-status">${statusText}</div>
      `;
      wordProgressContainer.appendChild(wordCard);
    });
  }
});