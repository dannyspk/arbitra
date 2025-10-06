# Hardcoded Localhost URLs Fix

## Problem
Multiple components had hardcoded `http://127.0.0.1:8000` or `http://localhost:8000` URLs instead of using the `NEXT_PUBLIC_API_URL` environment variable.

## Fixed Files (Committed)
- ✅ `components/ui/Topbar.tsx` - Changed to use `process.env.NEXT_PUBLIC_API_URL`
- ✅ `components/ui/OpportunityCard.tsx` - Fixed both execute functions

## Files That Still Need Fixing
These files have localhost detection logic that should also check for Railway URL:

1. `components/VaultHistoryChart.tsx` (line 32-33)
2. `components/VaultAlertManager.tsx` (line 39-40)
3. `components/SocialSentiment.tsx` (line 54-55)
4. `components/PositionTracker.tsx` (line 43-44)
5. `components/LiveDashboard.tsx` (line 94-95)
6. `components/HotCoinsPanel.tsx` (line 16, 99)
7. `components/OpportunitiesTable.tsx` (lines 150, 178, 216, 293, 382)

All of these use a pattern like:
```typescript
if ((hn === 'localhost' || hn === '127.0.0.1') && p === '3000') {
  return 'http://127.0.0.1:8000'
}
```

## Solution
Should be changed to use the environment variable consistently or import from `lib/config.ts`:
```typescript
import { API_URL } from '@/lib/config'
```

## Current Deployment Status
- Vercel will rebuild automatically with the latest commit
- Wait ~1-2 minutes for deployment to complete
- Then test again at: https://arbitra-six.vercel.app/
