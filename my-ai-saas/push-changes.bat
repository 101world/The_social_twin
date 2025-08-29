@echo off
cd /d "c:\Users\welco\101World\my-ai-saas"
echo Current directory: %CD%
echo.
echo === Git Status ===
git status
echo.
echo === Adding files ===
git add .
echo.
echo === Committing ===
git commit -m "Enhanced library modal with R2 Cloudflare, Supabase support and delete functionality"
echo.
echo === Pushing ===
git push origin main
echo.
echo === Final Status ===
git status
pause
