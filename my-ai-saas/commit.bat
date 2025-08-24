@echo off
cd /d "c:\Users\welco\101World\my-ai-saas"
git add -A
git commit -m "MOBILE: Remove duplicate middle prompt box and fix API endpoints - Removed duplicate textarea in message area that showed middle prompt - Fixed useSafeCredits to use correct API endpoints (/api/user/credits, /api/users/credits) - Single LoRA dropdown now properly behind advanced controls toggle - Mobile generation should work properly with fixed credit system - Cleaner mobile UI without unnecessary prompt boxes"
git push origin main
pause
