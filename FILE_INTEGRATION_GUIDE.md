# MantaMind Application - File Integration Diagram

## Navigation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    LOGIN.HTML                              │
│                (Authenticates User)                         │
│                                                             │
│  Creates: currentUser + userData in localStorage          │
│  Structure: {username: {password, learnedWords, ...}}     │
└────────────┬────────────────────────────────────────────────┘
             │ (Sets localStorage)
             │
    ┌────────▼──────────────────────────────────────────────┐
    │              CHALLENGE PAGE (CHALLENGE.HTML)              │
    │                                                        │
    │  • Loads currentUser from localStorage               │
    │  • Loads userData for statistics                     │
    │  • UPDATES userData:                                 │
    │    - learnedWords array                             │
    │    - inProgressWords array                          │
    │    - wordProgress tracking                          │
    │    - currentStreak / bestStreak                     │
    │  • Uses script.js for challenge logic               │
    └────────┬────────────────────────┬────────────────────┘
             │                        │
    ┌────────▼──────────┐   ┌────────▼──────────────────┐
    │  PROFILE.HTML     │   │    REVIEW.HTML            │
    │ & PROFILE.JS      │   │                            │
    │                   │   │  • Reads learnedWords     │
    │ • Reads userData  │   │  • Reads inProgressWords  │
    │ • Shows stats     │   │  • Fetches word details   │
    │ • Ranks & Badges  │   │  • Shows definitions      │
    │ • Achievements    │   │  • Shows examples         │
    │ • Streaks         │   │  • Shows synonyms         │
    └───────────────────┘   └───────────────────────────┘
             │                        │
             │  ┌─────────────────────┴────────┐
             │  │                               │
    ┌────────▼──────────────────────┐   ┌──────▼─────────────┐
    │     WORDLIST.HTML             │   │   DATA.JSON        │
    │                                │   │                    │
    │ • Shows ALL words             │   │ Contains:          │
    │ • Labels status:              │   │ • word             │
    │   - ✅ Learned                │   │ • definition       │
    │   - 📖 In Progress            │   │ • examples         │
    │   - 📝 Not Started            │   │ • synonyms         │
    │ • Color-coded by status       │   │ (14 total words)   │
    │ • CSS styling in wordlist.css │   └────────────────────┘
    └───────────────────────────────┘
             │
             └─────────────────┬─────────────────┐
                              │                 │
                   ┌──────────▼──────┐  ┌───────▼─────┐
                   │ NAVIGATION BAR  │  │  SIDEBAR    │
                   │  (Top)          │  │  MENU       │
                   │                 │  │  (Right)    │
                   │  Logo + Burger  │  │  Links to   │
                   │  Button         │  │  all pages  │
                   └─────────────────┘  └─────────────┘
```

---

## Data Flow Diagram

```
localStorage (Browser)
│
├─ currentUser: "john_doe"
│
└─ userData: {
     "john_doe": {
       password: "pass123",
       
       ┌──────────────────────────────────────────────┐
       │ Profile Page Reads This Data                 │
       │ ✓ learnedWords: ["word1", "word2"]          │
       │ ✓ inProgressWords: ["word3"]                │
       │ ✓ wordProgress: {word1: 3, word2: 2}       │
       │ ✓ currentStreak: 5                          │
       │ ✓ bestStreak: 12                            │
       └──────────────────────────────────────────────┘
              │
              │ Calculates:
              ├─ Total words from data.json
              ├─ Completion %
              ├─ Rank badge
              ├─ Achievement status
              └─ Progress visualization
     }
   }
```

---

## CSS File Structure

```
Styles/
│
├─ style.css (Global styles)
├─ nav.css (Navigation styling)
│
├─ auth.css (Login page styling)
├─ dashboard.css (Challenge page styling)
├─ profiles.css (Profile page styling)
│          └─ .rank-badge {beginner|intermediate|advanced|master}
│          └─ .achievement {locked|unlocked}
│          └─ .stat-card, .progress-bar-fill
│
├─ review.css (Review page styling - ENHANCED)
│          └─ New: #definition-box, button styling
│          └─ Nav + sidebar included
│
├─ wordlist.css (Word list styling - ENHANCED)
│          └─ New: .word-item {learned|in-progress|not-started}
│          └─ New: .status-badge styling
│          └─ Nav + sidebar included
│
├─ welcome.css (Welcome page)
├─ settings.css (Settings page)
└─ (other page styles)
```

---

## User Progress Tracking Example

```
SCENARIO: User learns "expeditiously"

1. User logs in
   localStorage.currentUser = "alice"
   localStorage.userData.alice = {
     learnedWords: [],
     inProgressWords: [],
     wordProgress: {},
     currentStreak: 0,
     bestStreak: 0
   }

2. User takes challenge
   Sees: "expeditiously" definition challenge
   User answers correctly

3. script.js updateProgress() called
   userData.alice.wordProgress["expeditiously"]++  // 1
   userData.alice.inProgressWords.push("expeditiously")
   userData.alice.currentStreak++  // 1

4. User answers 3 times correct
   wordProgress["expeditiously"] = 3
   → Moved to learnedWords
   → Removed from inProgressWords

5. Profile page shows:
   ✓ Total Words: 14
   ✓ Learned: 1
   ✓ In Progress: 0
   ✓ Completion: 7%
   ✓ Current Streak: 3
   ✓ Best Streak: 3
   ✓ Rank: 🌱 Beginner

6. Word List page shows:
   expeditiously - ✅ Learned
   (other words) - 📝 Not Started

7. Review page shows:
   expeditiously available for review
```

---

## File Dependencies

```
LOGIN.HTML
    ↓ (creates userData)
    ↓
SCRIPT.JS (main logic)
    ├─ Updates userData in localStorage
    ├─ Reads from data.json
    └─ Syncs with all pages
    
CHALLENGE.HTML (Challenge)
    ├─ Uses script.js
    └─ Updates userData

PROFILE.HTML
    ├─ Links to profile.js
    └─ Reads userData

PROFILE.JS
    ├─ Reads userData
    ├─ Reads data.json
    └─ Calculates achievements

REVIEW.HTML
    ├─ Reads userData
    └─ Reads data.json

WORDLIST.HTML
    ├─ Reads userData
    └─ Reads data.json

DATA.JSON
    └─ Contains all 14 word definitions
```

---

## localStorage Keys Reference

```
Key: "currentUser"
Type: String
Value: "username"
Updated: After login/signup
Cleared: On logout

Key: "userData"
Type: JSON String (stored)
Value: Object containing all user profiles
Format: {
  "user1": {...},
  "user2": {...}
}
Updated: After every challenge completion
Cleared: On logout (in some scenarios)

Key: "challengeStarted"
Type: Boolean String ("true"/"false")
Updated: When challenge starts/ends
Purpose: Persist challenge state
```

---

## Integration Points Summary

| Page | Reads | Updates | Redirects |
|------|-------|---------|-----------|
| login.html | - | userData | challenge.html |
| challenge.html (Challenge) | userData | userData | - |
| profile.html | userData | - | login.html |
| profile.js | userData | - | - |
| review.html | userData | - | login.html |
| wordlist.html | userData | - | - |
| dashboard.html | - | - | - |

---

**All files are now properly integrated and synchronized! ✅**
