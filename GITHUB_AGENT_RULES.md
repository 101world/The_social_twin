# GITHUB COPILOT AGENT RULES - MANDATORY COMPLIANCE

## 🚨 CRITICAL RULES - READ BEFORE EVERY TASK

### 1. PROTECTED FILES - NO CHANGES WITHOUT EXPLICIT PERMISSION
**Files that are NOT tracked in git must NEVER be modified without special user permission:**

- `.env.local` - Contains all API keys and secrets
- `.env` - Environment variables
- `.env.production` - Production environment
- `.env.development` - Development environment
- `node_modules/` - Package dependencies
- `.next/` - Build output
- Any file in `.gitignore`

**BEFORE TOUCHING THESE FILES:**
- ⚠️ Ask: "This will modify [filename] which contains sensitive data. Do you want me to proceed?"
- ⚠️ Suggest: "Should I create a backup first?"
- ⚠️ Wait for explicit "YES" from user

### 2. DEPLOYMENT PROCESS - NEVER CHANGE WITHOUT APPROVAL
**Current Working Deployment Process:**
```
Root Directory: 101World/
App Directory: 101World/my-ai-saas/
Build Command: cd my-ai-saas && npm run build
Deploy Command: git add -A; git commit -m "MESSAGE"; git push origin main
Vercel Config: Root vercel.json points to my-ai-saas subdirectory
```

**NEVER CHANGE:**
- Directory structure (101World/my-ai-saas/)
- Vercel configuration without permission
- Build process without permission
- Git workflow without permission

**BEFORE CHANGING DEPLOYMENT:**
- ⚠️ Ask: "Current deployment works. Change may break it. Proceed?"
- ⚠️ Explain: What will change and potential risks
- ⚠️ Offer: Alternative solutions that don't change core process

### 3. UI/UX CHANGES - ALWAYS GET APPROVAL
**NEVER modify UI/UX without explicit permission:**
- Component layouts
- Styling (CSS/Tailwind)
- User interface elements
- Mobile responsive design
- Button placement or behavior

**BEFORE CHANGING UI:**
- ⚠️ Ask: "This will change how [feature] looks/works. Approve?"
- ⚠️ Explain: Exactly what will change visually
- ⚠️ Warning: "This might affect user experience"

### 4. TASK LIMITATIONS - NO BYPASSES
**When a task CANNOT be completed safely:**

❌ **DON'T:**
- Find workarounds that change core systems
- Modify protected files to "make it work"
- Change deployment process to fix issues
- Assume user wants alternative approaches

✅ **DO:**
- State clearly: "I cannot complete this task safely because..."
- Explain: What would need to change and risks involved
- Offer: Multiple solution options with pros/cons
- Ask: "Which approach would you prefer?"

**Template Response:**
```
I cannot complete [task] because it would require:
1. [Risk/Change 1] - This could break [system]
2. [Risk/Change 2] - This might affect [functionality]

Safe alternatives:
Option A: [Description] - Pros: [...] Cons: [...]
Option B: [Description] - Pros: [...] Cons: [...]

Which would you prefer, or should we skip this task?
```

### 5. MANDATORY CHECKS BEFORE ANY ACTION

**ALWAYS CHECK FIRST:**
1. ❓ Is this file in .gitignore? → Ask permission
2. ❓ Will this change deployment process? → Ask permission  
3. ❓ Will this modify UI/UX? → Ask permission
4. ❓ Could this break existing functionality? → Explain risks
5. ❓ Is there a safer alternative? → Offer options

**NEVER ASSUME:**
- User wants the "best" solution if it changes core systems
- Faster is better if it risks stability
- New approaches are welcome without discussion

### 6. COMMUNICATION REQUIREMENTS

**BEFORE making changes:**
- Explain exactly what will be modified
- State potential risks clearly
- Offer alternatives when possible
- Wait for explicit approval

**DURING changes:**
- Explain each step being taken
- Stop immediately if anything goes wrong
- Keep user informed of progress

**AFTER changes:**
- Confirm what was changed
- Explain any side effects
- Provide rollback instructions if needed

## 🎯 CURRENT WORKING SYSTEMS - DO NOT CHANGE

### Deployment System ✅
- Repository: 101world/The_social_twin
- Structure: 101World (root) / my-ai-saas (app)
- Vercel: Configured for subdirectory builds
- Build: npm run build in my-ai-saas works
- Deploy: git push origin main triggers Vercel

### Environment Setup ✅
- .env.local contains all working credentials
- Supabase, Clerk, RunPod, Razorpay all configured
- Mobile generation with fallback systems
- Cloudflare proxy system implemented

### Mobile Features ✅
- Large Create/Library buttons
- Touch-friendly interface
- Timeout handling for mobile networks
- Auth fallback systems

## 📝 REMEMBER: WHEN IN DOUBT, ASK FIRST!

These rules exist because:
1. The user lost critical .env.local file data
2. Multiple deployment attempts failed due to config changes
3. Trust needs to be rebuilt through careful, permission-based actions

**Last Updated**: August 25, 2025
**Status**: MANDATORY - Must be followed for all tasks
