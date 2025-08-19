# Credit System & UI Refresh Mapping

## 🎯 Current Status & Analysis

### Credit-Deducting Functions & UI Refresh Status

| Function | API Endpoint | Cost (Credits) | Backend Deducts | Frontend Calls `refreshCredits()` | Status | Priority |
|----------|-------------|----------------|-----------------|-----------------------------------|--------|----------|
| **Text Generation** | `/api/generate-with-tracking` | 1 | ✅ | ✅ (Line 1183) | ✅ **WORKING** | ✅ |
| **Image Generation** | `/api/generate-with-tracking` | 5 | ✅ | ✅ (Line 1183) | ✅ **WORKING** | ✅ |
| **Video Generation** | `/api/generate-with-tracking` | 10 | ✅ | ✅ (Line 1183) | ✅ **WORKING** | ✅ |
| **Image Modify** | `/api/generate-with-tracking` | 3 | ✅ | ✅ (Line 1183) | ✅ **WORKING** | ✅ |
| **Video Compilation** | `/api/social-twin/compile` | 3 | ✅ | ✅ (Line 859) | ✅ **WORKING** | ✅ |
| **PDF Export (Layout)** | `/api/social-twin/export-pdf-layout` | 1 | ✅ | ✅ (Line 801) | ✅ **WORKING** | ✅ |
| **PDF Export (Canvas)** | `/api/social-twin/export-pdf-from-canvas` | 0 | ❌ | ❌ (Removed) | ✅ **FIXED** | ✅ |
| **PDF Export (Basic)** | `/api/social-twin/export-pdf` | 0 | ❌ | ❌ (Removed) | ✅ **FIXED** | ✅ |
| **Manual Credit Deduct** | `/api/users/credits` (POST) | Variable | ✅ | ❌ | ❌ **MISSING** | � |
| **PPT Export** | `/api/social-twin/export-ppt` | 0 | ❌ | ❌ | ✅ **CORRECT** | ✅ |

### Issues Identified:

1. ✅ **FIXED** - Over-Refreshing: Removed `refreshCredits()` from PDF exports that don't deduct credits
2. ⚠️ **REMAINING** - Missing Refresh: Manual credit deduction API doesn't trigger UI refresh (if used in frontend)
3. ✅ **IMPROVED** - No Centralized System: Added utility function `handleCreditDeductingAPI()` for future use

### ✅ **FIXES IMPLEMENTED**

1. **Added `refreshCredits()` to Video Compilation** (Line 859)
   - Video compilation now properly refreshes UI after deducting 3 credits

2. **Removed unnecessary `refreshCredits()` calls** from non-credit-deducting PDF exports
   - PDF Canvas Export: Removed refresh call (doesn't deduct credits)
   - PDF Basic Export: Removed refresh call (doesn't deduct credits)

3. **Added utility function** `handleCreditDeductingAPI()` for consistent handling
   - Available for future implementations
   - Ensures proper error handling and credit refresh

## 🚀 Suggested Improvements

### Option 1: Centralized Credit Response Handler
```typescript
// In social-twin/page.tsx
const handleCreditDeductingAPI = async (apiCall: () => Promise<Response>) => {
  const response = await apiCall();
  const result = await response.json();
  
  // If the response indicates credits were deducted
  if (result.creditsDeducted || result.remainingCredits !== undefined) {
    refreshCredits();
  }
  
  return { response, result };
};
```

### Option 2: Credit Context Auto-Detection
```typescript
// In credits-context.tsx
const useAutoRefreshCredits = () => {
  const { refreshCredits } = useCredits();
  
  const monitoredFetch = async (url: string, options?: RequestInit) => {
    const response = await fetch(url, options);
    
    // Auto-refresh for known credit-deducting endpoints
    const creditEndpoints = [
      '/api/generate-with-tracking',
      '/api/social-twin/compile',
      '/api/social-twin/export-pdf-layout',
      '/api/users/credits'
    ];
    
    if (creditEndpoints.some(endpoint => url.includes(endpoint))) {
      const result = await response.clone().json();
      if (response.ok && !result.error) {
        refreshCredits();
      }
    }
    
    return response;
  };
  
  return { monitoredFetch };
};
```

### Option 3: API Response Standardization
Modify all credit-deducting APIs to return:
```typescript
{
  success: true,
  data: { ... },
  creditsDeducted: 5,
  remainingCredits: 49995
}
```

Then frontend can auto-detect and refresh based on `creditsDeducted` field.

## 🎯 Recommended Action Plan

### Phase 1: Immediate Fixes (5 mins)
1. ❌ Remove `refreshCredits()` from PDF exports that don't deduct credits
2. ✅ Add `refreshCredits()` to manual credit deduction endpoint

### Phase 2: Standardization (15 mins)
1. Create a utility function for credit-deducting API calls
2. Standardize all API responses to include credit info
3. Replace individual `refreshCredits()` calls with the utility

### Phase 3: Advanced (30 mins)
1. Implement auto-detection system in credit context
2. Add visual feedback for credit deductions
3. Add error handling for insufficient credits

## 🔧 Quick Fix Implementation

### 1. Remove Unnecessary refreshCredits() Calls
- `exportPdfFromCanvas()` - Remove refresh call (no credits deducted)
- `runExportPDF()` - Remove refresh call (no credits deducted)

### 2. Add Missing refreshCredits() Call
- Manual credit deduction API usage (if any frontend calls it)

### 3. Create Unified Handler
```typescript
const handleApiWithCredits = async (apiCall: () => Promise<any>) => {
  try {
    const result = await apiCall();
    // Always refresh after successful API calls that might affect credits
    refreshCredits();
    return result;
  } catch (error) {
    throw error;
  }
};
```

Would you like me to implement any of these suggestions?
