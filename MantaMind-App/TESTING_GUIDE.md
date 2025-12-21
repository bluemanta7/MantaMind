# MantaMind Application - Quick Testing Guide

## 🚀 Quick Start

### Step 1: Login/Create Account
1. Open `login.html`
2. Enter username: `testuser`
3. Enter password: `password123`
4. Click "Sign up" to create account OR "Login" if already exists
5. You'll be redirected to the Challenge page

---

## 📋 Test Scenarios

### Test 1: Profile Page Display
**Steps:**
1. After login, click sidebar menu (☰)
2. Select "👤 Profile"
3. **Expected Results:**
   - ✅ Username displays correctly
   - ✅ Shows "🌱 Beginner" rank (0% learned initially)
   - ✅ All stats show 0 (no words learned yet)
   - ✅ Achievements section shows 7 locked achievements

### Test 2: Challenge → Profile Update
**Steps:**
1. Go to Challenge page (challenge.html)
2. Click "Start Challenge"
3. Answer a question correctly
4. Go back to Profile page
5. **Expected Results:**
   - ✅ Stats update in real-time
   - ✅ Progress bar shows movement
   - ✅ Streak updates (current streak = 1)

### Test 3: Review Words
**Steps:**
1. Complete 3 correct challenges on a single word (e.g., "expeditiously")
2. Go to Review page via sidebar
3. Click word name
4. Click "Show Definition"
5. **Expected Results:**
   - ✅ Word appears in review list
   - ✅ Shows definition, example, and synonyms
   - ✅ "Next Word" button works

### Test 4: Word List Tracking
**Steps:**
1. Go to "📖 Word List" page
2. Find "expeditiously" (if you learned it)
3. **Expected Results:**
   - ✅ Shows "✅ Learned" badge (if 3+ correct answers)
   - ✅ Green border on word item
   - ✅ Other words show "📝 Not Started" in blue

### Test 5: Logout
**Steps:**
1. From any page, click sidebar menu (☰)
2. Click "🚪 Logout"
3. **Expected Results:**
   - ✅ Redirected to login.html
   - ✅ localStorage.currentUser is cleared
   - ✅ Login page shows fresh form

### Test 6: Authentication Check
**Steps:**
1. Open Developer Tools (F12)
2. Go to Console tab
3. Run: `localStorage.removeItem('currentUser')`
4. Try to navigate to `profile.html` directly
5. **Expected Results:**
   - ✅ Redirected to login.html
   - ✅ Alert shows: "Please log in first!"

### Test 7: Achievement Unlock
**Steps:**
1. Complete 10 different words correctly (3 times each = 30 challenges)
2. Go to Profile page
3. Scroll to achievements
4. **Expected Results:**
   - ✅ "Scholar" achievement (🎓) shows unlocked
   - ✅ Shows orange/gold styling instead of gray
   - ✅ Other achievements remain locked

### Test 8: Rank Progression
**Steps:**
1. Learn words progressively
2. Check rank at different completion levels:
   - 0-24% = 🌱 Beginner
   - 25-49% = 📚 Intermediate
   - 50-74% = 🎓 Advanced
   - 75-100% = 👑 Master
3. **Expected Results:**
   - ✅ Rank badge color changes
   - ✅ Rank text updates

---

## 🔍 Debug Checklist

### Check localStorage Contents
```javascript
// In browser console:
console.log(localStorage.getItem('currentUser'));
console.log(JSON.parse(localStorage.getItem('userData')));
console.log(localStorage.getItem('challengeStarted'));
```

### Expected Output:
```javascript
// currentUser
"testuser"

// userData
{
  "testuser": {
    password: "password123",
    learnedWords: ["expeditiously"],
    inProgressWords: ["deterrence"],
    wordProgress: {
      "expeditiously": 3,
      "deterrence": 1
    },
    currentStreak: 1,
    bestStreak: 3
  }
}

// challengeStarted
"true"
```

---

## 🐛 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Profile redirects to login | `currentUser` not set | Login again via login.html |
| Stats show 0 on profile | No challenges completed | Complete at least 1 challenge |
| Word status badges missing | CSS not loaded | Hard refresh (Ctrl+Shift+R) |
| Achievements not updating | Cache issue | Clear localStorage: `localStorage.clear()` |
| Streak not counting | Challenge not saved | Check data.json is accessible |
| Review page is blank | No words learned yet | Complete 3 challenges on same word |

---

## 📊 Test Data Setup (Optional)

### To test with pre-loaded data:
1. Open Developer Console (F12)
2. Run this script:

```javascript
// Create test user with pre-loaded data
const testData = {
  "testuser": {
    password: "password123",
    learnedWords: ["expeditiously", "deterrence", "providence"],
    inProgressWords: ["altruism", "negligible"],
    wordProgress: {
      "expeditiously": 3,
      "deterrence": 3,
      "providence": 3,
      "altruism": 1,
      "negligible": 2
    },
    currentStreak: 2,
    bestStreak: 5
  }
};

localStorage.setItem('currentUser', 'testuser');
localStorage.setItem('userData', JSON.stringify(testData));
```

3. Now test the profile page - should show:
   - 21% completion (3/14 learned)
   - 3 learned words
   - 2 in-progress words
   - Current streak: 2
   - Best streak: 5
   - Rank: 🌱 Beginner

---

## 📱 Cross-Page Navigation Test

### All pages should have consistent sidebar with these links:
- [x] 👋 Home → index.html
- [x] 🎮 Challenge → challenge.html
- [x] 👤 Profile → profile.html
- [x] 📊 Dashboard → dashboard.html
- [x] 📚 Review Words → review.html
- [x] 📖 Word List → wordlist.html
- [x] ⚙️ Settings → setting.html
- [x] 🚪 Logout → login.html

### Test each link:
1. From profile.html, click each sidebar link
2. Verify page loads and sidebar menu closes
3. Verify data persists (currentUser still set)

---

## ✅ Final Integration Verification

Before deploying, verify:

```javascript
// In Console, after login:

// 1. User is set
localStorage.getItem('currentUser') !== null ✓

// 2. User data exists
localStorage.getItem('userData') !== null ✓

// 3. Can parse userData
JSON.parse(localStorage.getItem('userData'))[localStorage.getItem('currentUser')] ✓

// 4. Profile page loads without redirect
// Navigate to profile.html → No redirect ✓

// 5. Words display on list
fetch('./data.json').then(r => r.json()).then(d => console.log(d.words.length))
// Should log: 14 ✓

// 6. Logout works
document.getElementById('logout-btn').click()
// Should redirect to login.html and clear currentUser ✓
```

---

## 📈 Performance Metrics

### Page Load Times (Expected):
- login.html: < 500ms
- challenge.html (Challenge): < 1s (includes data.json)
- profile.html: < 800ms (includes data.json + calculations)
- review.html: < 800ms
- wordlist.html: < 1s

### localStorage Size:
- Empty user data: ~200 bytes
- With 5 learned words: ~500 bytes
- Typical user (10 words): ~800 bytes

---

## 🎯 Success Criteria

✅ All 8 test scenarios pass
✅ No console errors
✅ localStorage persists across page refreshes
✅ Achievements unlock correctly
✅ Profile shows accurate statistics
✅ Navigation is consistent
✅ Logout clears user data
✅ Review and Word List show correct statuses

---

**You're all set to test! 🚀**

For any issues, check:
1. Browser console for errors (F12)
2. localStorage contents
3. File paths in network tab
4. data.json is loading properly
