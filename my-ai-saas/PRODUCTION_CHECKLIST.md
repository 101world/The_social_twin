# 🚀 PRODUCTION DEPLOYMENT CHECKLIST

## ✅ Tasks to Complete

### 1. Clerk Production Setup
- [ ] Go to https://dashboard.clerk.com
- [ ] Create new production application OR switch existing to production
- [ ] Add your live domain (e.g., yourdomain.com) to allowed domains
- [ ] Configure redirect URLs for production:
  - Sign-in URL: `https://yourdomain.com/sign-in`
  - Sign-up URL: `https://yourdomain.com/sign-up`
  - After sign-in: `https://yourdomain.com/`
  - After sign-up: `https://yourdomain.com/`
- [ ] Copy production keys:
  - [ ] Publishable Key (pk_live_...)
  - [ ] Secret Key (sk_live_...)
- [ ] Set up production webhook:
  - URL: `https://yourdomain.com/api/webhooks/clerk`
  - Events: `user.created`, `user.updated`, `user.deleted`
  - [ ] Copy webhook secret

### 2. Razorpay Production Setup
- [ ] Go to https://dashboard.razorpay.com
- [ ] Complete KYC verification (required for live mode)
- [ ] Switch to "Live Mode" in dashboard
- [ ] Copy live keys:
  - [ ] Key ID (rzp_live_...)
  - [ ] Key Secret
- [ ] Set up production webhooks:
  - URL: `https://yourdomain.com/api/webhooks/razorpay-hourly`
  - Events: `payment.captured`, `subscription.charged`
  - [ ] Copy webhook secret

### 3. Vercel Environment Variables
- [ ] Go to Vercel Dashboard > Your Project > Settings > Environment Variables
- [ ] Add all production environment variables (see PRODUCTION_SETUP_GUIDE.md)
- [ ] Set environment to "Production"
- [ ] Redeploy your application

### 4. Testing Checklist
- [ ] Test user registration/login with Clerk
- [ ] Test small payment with Razorpay (₹1)
- [ ] Test credit system functionality
- [ ] Test webhook delivery
- [ ] Test generation features
- [ ] Verify all API endpoints work

### 5. Security Checklist
- [ ] Ensure .env.local is in .gitignore
- [ ] Never commit production keys to git
- [ ] Use strong webhook secrets
- [ ] Enable HTTPS only
- [ ] Set up monitoring/logging

## 🔧 Commands to Run After Setup

```bash
# Redeploy to Vercel after env vars are set
vercel --prod

# Or push to main branch to trigger auto-deployment
git add .
git commit -m "Configure production environment"
git push origin main
```

## 📞 Support Contacts
- Clerk Support: https://clerk.com/support
- Razorpay Support: https://razorpay.com/support/

## ⚠️ Important Notes
1. Keep test environment for development
2. Start with small amounts for Razorpay testing
3. Monitor webhooks closely in first 24 hours
4. Have rollback plan ready
