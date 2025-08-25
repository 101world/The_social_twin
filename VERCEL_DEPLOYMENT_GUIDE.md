# VERCEL DEPLOYMENT GUIDE - 101World Social Twin App

## 🚨 CRITICAL INFO - READ FIRST
- **Repository Structure**: `101World` (root) → `my-ai-saas` (Next.js app)
- **Main Branch**: `main`
- **Repository**: `101world/The_social_twin`
- **App Location**: ALL Next.js files are in `/my-ai-saas/` subdirectory
- **⚠️ WARNING**: DO NOT CHANGE THIS PROCESS WITHOUT USER PERMISSION

## ⚡ EXACT DEPLOYMENT STEPS (DO NOT MODIFY)

### Step 1: Test Build Locally (MANDATORY)
```bash
cd "C:\Users\welco\OneDrive\Desktop\101World\my-ai-saas"
npm run build    # MUST succeed before deploying
```

### Step 2: Commit and Push (EXACT COMMANDS)
```bash
cd "C:\Users\welco\OneDrive\Desktop\101World"
git add -A
git commit -m "DEPLOY: [your message]"
git push origin main
```

### Step 3: Vercel Auto-Deploys
- Vercel detects push to main branch
- Builds from my-ai-saas subdirectory  
- Uses configuration in root vercel.json

## 📁 EXACT FILE STRUCTURE (DO NOT CHANGE)
```
101World/                    ← Git root directory
├── vercel.json             ← Deployment config (DO NOT MODIFY)
├── .env.local              ← PROTECTED FILE - ASK BEFORE TOUCHING
├── my-ai-saas/             ← ACTUAL NEXT.JS APP
│   ├── package.json        ← Dependencies
│   ├── .env.local          ← PROTECTED - NEVER MODIFY WITHOUT PERMISSION
│   ├── app/
│   │   ├── api/            ← API routes
│   │   ├── social-twin/    ← Main app
│   └── components/
```

## � PROTECTED FILES - NEVER TOUCH WITHOUT PERMISSION
- `.env.local` (any location)
- `vercel.json` 
- `package.json`
- Any file in `.gitignore`

## ⚠️ AGENT RULES FOR THIS GUIDE
1. **DO NOT** suggest changing directory structure
2. **DO NOT** modify deployment process without explicit permission
3. **DO NOT** touch .env files without asking first
4. **ASK FIRST** before changing any configuration
5. **EXPLAIN RISKS** before suggesting alternatives

## �️ TROUBLESHOOTING (SAFE METHODS ONLY)

### Build Fails Locally
1. Check .env.local has all required variables
2. Run `npm install` in my-ai-saas directory
3. Check for TypeScript/syntax errors
4. **DO NOT** modify deployment config to "fix" build

### Vercel Deployment Fails
1. Verify local build works first
2. Check Vercel dashboard for error details
3. Confirm root vercel.json is correct (but don't change it)
4. **ASK USER** before modifying any configuration

## ✅ CURRENT WORKING CONFIGURATION

### Root vercel.json (WORKING - DO NOT CHANGE)
```json
{
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "cd my-ai-saas && npm install && npm run build",
  "installCommand": "cd my-ai-saas && npm install",
  "outputDirectory": "my-ai-saas/.next"
}
```

### Vercel Dashboard Settings (WORKING - DO NOT CHANGE)
- Root Directory: `my-ai-saas`
- Framework: Next.js
- Build & Output: Use defaults

## � NEVER DO THESE WITHOUT PERMISSION
- Change root directory configuration
- Modify vercel.json files
- Touch .env.local files
- Change package.json
- Suggest "better" deployment methods
- Force push without explanation
- Delete or move files in .gitignore

---
**Last Updated**: August 25, 2025
**Working Commit**: 32ff5699 (Environment variables restored)
**Status**: PRODUCTION READY - DO NOT MODIFY WITHOUT USER APPROVAL
