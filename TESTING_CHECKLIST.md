# GRC Learning Platform - Manual Testing Checklist

**Test Date:** _____________
**Tester:** _____________
**App URL:** http://127.0.0.1:5199/
**Environment:** Tauri Desktop App (Dev Mode)

---

## ⚠️ Known Limitations
- This is a Tauri desktop app running in dev mode
- Database features require Tauri backend
- Some features may show errors or empty states in browser-only mode
- Focus on what DOES render

---

## Test 1: Dashboard / Home Page

**URL:** http://127.0.0.1:5199/

### Checklist:
- [ ] Page loads successfully (no blank screen)
- [ ] Sidebar is visible on the left
- [ ] Main content area renders
- [ ] No JavaScript errors in console (F12)

### Visual Checks:
- [ ] Layout is not broken
- [ ] No overlapping elements
- [ ] Styles are applied correctly
- [ ] Text is readable
- [ ] Spacing/padding looks correct

### Expected Content:
- [ ] Dashboard heading or welcome message
- [ ] Content cards or widgets (if any)
- [ ] Error boundary message (if backend unavailable)

### Issues Found:
```
[Write any issues here]
```

### Screenshot:
- [ ] Screenshot taken and saved

---

## Test 2: Library Page

**URL:** http://127.0.0.1:5199/library

### Checklist:
- [ ] Page loads successfully
- [ ] Page renders without crashing
- [ ] Domain cards are visible (if data available)
- [ ] Module listings are visible (if data available)
- [ ] Empty state message (if no data)

### Visual Checks:
- [ ] Layout is not broken
- [ ] Cards are properly aligned
- [ ] Grid/flex layout works correctly
- [ ] Images/icons load properly
- [ ] Hover states work (if applicable)

### Issues Found:
```
[Write any issues here]
```

### Screenshot:
- [ ] Screenshot taken and saved

---

## Test 3: Sidebar Navigation

### Navigation Items Check:
- [ ] "Dashboard" is present
- [ ] "Library" is present
- [ ] "Guided Paths" is present with Compass icon
- [ ] "Progress" is present
- [ ] "History" is present
- [ ] "News" is present

### Active State Check:
- [ ] Current page is highlighted in sidebar
- [ ] Active indicator (color/background) is visible
- [ ] Inactive items have different styling

### Navigation Functionality:
- [ ] Click "Dashboard" - navigates correctly
- [ ] Click "Library" - navigates correctly
- [ ] Click "Guided Paths" - navigates correctly
- [ ] Click "Progress" - navigates correctly
- [ ] Click "History" - navigates correctly
- [ ] Click "News" - navigates correctly

### Visual Checks:
- [ ] Icons are properly aligned
- [ ] Text labels are readable
- [ ] Spacing between items is consistent
- [ ] Sidebar width is appropriate
- [ ] No overlapping text/icons

### Issues Found:
```
[Write any issues here]
```

### Screenshot:
- [ ] Screenshot of sidebar taken

---

## Test 4: Dark Mode Toggle

### Location Check:
- [ ] Theme toggle button is visible
- [ ] Toggle is easily accessible
- [ ] Toggle has clear icon (sun/moon)

### Functionality:
- [ ] Click toggle - theme switches
- [ ] Background color changes
- [ ] Text color changes for readability
- [ ] Sidebar theme updates
- [ ] Main content theme updates
- [ ] All components respect theme

### Visual Checks (Light Mode):
- [ ] Background is light
- [ ] Text is dark/readable
- [ ] Contrast is sufficient
- [ ] No white text on white background

### Visual Checks (Dark Mode):
- [ ] Background is dark
- [ ] Text is light/readable
- [ ] Contrast is sufficient
- [ ] No dark text on dark background

### Issues Found:
```
[Write any issues here]
```

### Screenshots:
- [ ] Light mode screenshot taken
- [ ] Dark mode screenshot taken

---

## Test 5: Additional Pages (Quick Check)

### Guided Paths
**URL:** http://127.0.0.1:5199/guided-paths
- [ ] Page loads
- [ ] Compass icon visible in sidebar
- [ ] Content renders or shows appropriate message
- **Issues:** ___________________________

### Progress
**URL:** http://127.0.0.1:5199/progress
- [ ] Page loads
- [ ] Content renders or shows appropriate message
- **Issues:** ___________________________

### History
**URL:** http://127.0.0.1:5199/history
- [ ] Page loads
- [ ] Content renders or shows appropriate message
- **Issues:** ___________________________

### News
**URL:** http://127.0.0.1:5199/news
- [ ] Page loads
- [ ] Content renders or shows appropriate message
- **Issues:** ___________________________

---

## Browser Console Errors

**Instructions:** Open browser DevTools (F12) and check Console tab

### Errors Found:
```
[Paste any console errors here]
```

### Warnings Found:
```
[Paste any console warnings here]
```

---

## Responsive Design (Bonus)

### Desktop (1920x1080):
- [ ] Layout looks good
- [ ] No horizontal scrolling
- [ ] Sidebar is appropriate width

### Laptop (1366x768):
- [ ] Layout adapts properly
- [ ] Content is not cut off

### Tablet (768px width):
- [ ] Sidebar collapses or adapts
- [ ] Content remains readable

---

## Overall Assessment

### What Works Well:
```
[List everything that works correctly]
```

### What's Broken:
```
[List all broken features or functionality]
```

### Visual Issues:
```
[List layout problems, styling issues, spacing problems]
```

### Critical Issues (Must Fix):
```
[List any critical bugs that prevent usage]
```

### Minor Issues (Nice to Fix):
```
[List cosmetic or minor usability issues]
```

---

## Summary

**Overall Status:** [ ] Pass  [ ] Pass with Issues  [ ] Fail

**Recommendation:**
```
[Your overall assessment and recommendations]
```

---

## Screenshots Folder

Save all screenshots to: `/screenshots/test-[date]/`

Naming convention:
- `01-dashboard.png`
- `02-library.png`
- `03-sidebar.png`
- `04-light-mode.png`
- `05-dark-mode.png`
- `06-guided-paths.png`
- etc.
