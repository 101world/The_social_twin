# QUICK DEPLOYMENT CHECKLIST

## When Vercel Fails:
1. **Check**: App is in `my-ai-saas/` subdirectory
2. **Verify**: Root `vercel.json` has subdirectory build commands
3. **Test**: `cd my-ai-saas && npm run build` works locally
4. **Dashboard**: Vercel Root Directory = `my-ai-saas`

## File Locations:
- Git Root: `101World/`
- Next.js App: `101World/my-ai-saas/`
- Main Page: `my-ai-saas/app/social-twin/page.tsx`

## Working vercel.json (in root):
```json
{
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "cd my-ai-saas && npm install && npm run build",
  "installCommand": "cd my-ai-saas && npm install",
  "outputDirectory": "my-ai-saas/.next"
}
```

## Emergency Reset:
```bash
cd my-ai-saas
rm -rf node_modules .next
npm install && npm run build
cd .. && git add -A && git commit -m "DEPLOY FIX" && git push
```

Last Working: eb25187f
