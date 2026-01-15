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
  applyThemeFromSettings();
}

function applyThemeFromSettings() {
  try {
    const currentUser = localStorage.getItem('currentUser');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const appSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const settings = (currentUser && userData[currentUser] && userData[currentUser].settings) || (appSettings && Object.keys(appSettings).length ? appSettings : { theme: 'blue' });
    const theme = settings.theme || 'blue';

    // Ensure a theme stylesheet is present and points to the selected theme file (e.g. Styles/theme-red.css)
    let link = document.getElementById('theme-stylesheet');
    const href = `Styles/theme-${theme}.css`;
    if (!link) {
      link = document.createElement('link');
      link.id = 'theme-stylesheet';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    // update href so theme can be switched without reload
    if (link.href.indexOf(href) === -1) link.href = href;

    // Update body theme class for scoped selectors
    // remove any existing theme- classes (supporting multiple theme names)
    document.body.classList.remove('theme-red','theme-blue','theme-purple','theme-dark');
    document.body.classList.add(`theme-${theme}`);
  } catch (e) {
    console.warn('applyThemeFromSettings failed', e);
  }
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
    // position in the visual center of the top nav
    indicator.style.position = 'absolute';
    indicator.style.left = '50%';
    indicator.style.transform = 'translateX(-50%)';
    indicator.style.cursor = 'pointer';
    indicator.style.zIndex = '101';
    indicator.addEventListener('click', () => { window.location.href = 'profile.html'; });
    topNav.appendChild(indicator);
  }
}
