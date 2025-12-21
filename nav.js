// ============================================
// SHARED NAVIGATION SCRIPT FOR ALL PAGES
// ============================================
// This script handles burger menu and logout for ALL pages
// No need to duplicate code in each script

// Run setup either immediately (if DOM already ready) or on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupNav();
  });
} else {
  setupNav();
}

function setupNav() {
  setupBurgerMenu();
  setupLogout();
  setupUserIndicator();
}

function setupBurgerMenu() {
  const burger = document.getElementById('burger-btn');
  const sidebar = document.getElementById('sidebar-menu');
  if (burger && sidebar) {
    // remove existing to avoid duplicate handlers
    burger.replaceWith(burger.cloneNode(true));
    const newBurger = document.getElementById('burger-btn');
    newBurger.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
    });
  }
}

function setupLogout() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('userData');
      localStorage.removeItem('challengeStarted');
      window.location.href = 'login.html';
    });
  }
}

function setupUserIndicator() {
  const topNav = document.getElementById('top-nav');
  if (!topNav) return;
  // remove old indicator if present
  const existing = document.getElementById('user-indicator');
  if (existing) existing.remove();

  const username = localStorage.getItem('currentUser');
  if (username) {
    const indicator = document.createElement('div');
    indicator.id = 'user-indicator';
    indicator.textContent = `👤 ${username}`;
    indicator.style.marginLeft = '12px';
    indicator.style.cursor = 'pointer';
    indicator.addEventListener('click', () => { window.location.href = 'profile.html'; });
    topNav.appendChild(indicator);
  }
}
