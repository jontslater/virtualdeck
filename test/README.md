# Drag and Drop Tests

This directory contains tests for the drag and drop functionality, specifically testing the fix for the bug where drag and drop would stop working after adding the first app.

## Test Files

### 1. `drag-drop.test.js` - Automated Unit Tests

Jest-based unit tests that verify the drag and drop functionality works correctly.

**To run:**
```bash
npm test
```

**To run in watch mode:**
```bash
npm test:watch
```

**What it tests:**
- Form state reset when modal is already open
- Proper cleanup of all form state between drops
- Multiple consecutive drops work correctly
- File type detection (app vs audio)
- Hotkey enable/disable calls
- Dataset property cleanup

### 2. `manual-drag-drop-test.js` - Manual Browser Test

A manual test script that can be run in the browser console to verify the fix works in the actual application.

**To run:**
1. Start the app: `npm start`
2. Open DevTools (F12)
3. Go to the Console tab
4. Copy the entire contents of `test/manual-drag-drop-test.js`
5. Paste into the console and press Enter

**What it tests:**
- First app drop works
- Second app drop works (the critical bug fix)
- Third app drop still works
- Form state cleanup between drops
- Handling drops when modal is already open

## The Bug That Was Fixed

Previously, after adding the first app via drag and drop:
- The modal would close
- Form state wasn't fully reset
- Subsequent drag and drop attempts would fail or behave incorrectly

**The fix:**
- Ensures modal is closed before processing new drops
- Fully resets all form state (including dataset properties)
- Replaces file inputs to clear stale references
- Properly handles the case when modal is already open

## Running Tests

### Prerequisites

Install dependencies:
```bash
npm install
```

### Run Automated Tests
```bash
npm test
```

### Run Manual Test
1. Start the app: `npm start`
2. Open DevTools console
3. Run the manual test script (see instructions above)

## Expected Results

All tests should pass, confirming that:
- ✅ Drag and drop works for the first app
- ✅ Drag and drop continues to work for subsequent apps
- ✅ Form state is properly reset between drops
- ✅ Modal opens and closes correctly
- ✅ No errors occur during multiple consecutive drops
