# 🛡️ ROLLBACK EMERGENCY PLAN - Free Credits System

## 📍 **Current Safe Point:**
- **Safe Commit**: `b8aa433` - "feat: update to Razorpay production keys for live payments"
- **Safe Branch**: `main`
- **Production Status**: ✅ Working with live keys

## 🚨 **EMERGENCY ROLLBACK COMMANDS:**

### **Option 1: Revert Feature Branch (Quick Fix)**
```bash
# If feature branch has issues
git checkout main
git branch -D feature/free-credits-system
```

### **Option 2: Revert Specific Changes**
```bash
# Remove specific files if they cause issues
git rm app/api/users/free-credits/route.ts
git rm app/api/users/free-credits/status/route.ts
git rm components/FreeCreditsButton.tsx
git checkout HEAD -- app/one/page.tsx
git commit -m "Revert free credits system"
```

### **Option 3: Complete Reset to Safe Point**
```bash
# Nuclear option - reset everything
git reset --hard b8aa433
git push --force-with-lease origin feature/free-credits-system
```

### **Option 4: Vercel Rollback**
- Go to Vercel dashboard
- Find previous deployment
- Click "Promote to Production"

## 📋 **Pre-Deployment Checklist:**

### **Before Pushing to Production:**
1. ✅ Test locally with production database
2. ✅ Verify no compilation errors
3. ✅ Check Supabase table exists
4. ✅ Test button functionality
5. ✅ Confirm existing features still work

### **Safe Deployment Strategy:**
1. **Deploy to Preview**: Push feature branch → Test on Vercel preview URL
2. **Merge if Safe**: Only merge to main if preview works
3. **Monitor**: Watch for errors after deployment

## 🔍 **Files Changed:**
- `app/one/page.tsx` - Added FreeCreditsButton import + component
- `app/api/users/free-credits/route.ts` - New API endpoint
- `app/api/users/free-credits/status/route.ts` - New status check endpoint  
- `components/FreeCreditsButton.tsx` - New React component
- Database: `free_credit_claims` table (manual Supabase setup)

## 📞 **If Everything Breaks:**
1. Run Option 3 (Complete Reset)
2. Push to revert Vercel deployment
3. Check Supabase - no database changes were automated
4. Your production site returns to last working state

**Last Working State**: All payments, auth, and features working with live keys
