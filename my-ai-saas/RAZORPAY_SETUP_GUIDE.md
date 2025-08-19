# Razorpay Monthly Subscriptions Setup Guide

## 🚀 Quick Setup Instructions

### 1. Database Setup
1. **Open your Supabase project dashboard**
2. **Go to SQL Editor**
3. **Copy and paste the entire content from `supabase_monthly_subscriptions.sql`**
4. **Click "Run" to execute the SQL**

This will:
- ✅ Add subscription fields to existing tables
- ✅ Create monthly credit management functions
- ✅ Add INR pricing data for all plans
- ✅ Set up proper indexes and permissions

### 2. Webhook Configuration
1. **Open your Razorpay Dashboard** (https://dashboard.razorpay.com/)
2. **Go to Settings → Webhooks**
3. **Create new webhook with:**
   - **URL:** `https://yourdomain.com/api/webhooks/razorpay`
   - **Secret:** `Patnibillions09!` (already configured in .env.local)
   - **Events to subscribe:**
     - `subscription.activated`
     - `subscription.charged`
     - `subscription.cancelled`
     - `subscription.paused`
     - `invoice.paid`

### 3. Test the System
1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Visit the test page:**
   ```
   http://localhost:3000/test-razorpay-subscriptions
   ```

3. **Test subscription flow:**
   - Click "Test Subscribe" on any plan
   - Use test card: `4111 1111 1111 1111`
   - Any future expiry date, CVV: `123`
   - Complete the payment

### 4. Verify Integration
After successful test payment, check:
- ✅ User credits are updated correctly
- ✅ Subscription status shows as "Active"
- ✅ Razorpay dashboard shows the subscription
- ✅ Webhook events are received and processed

## 🔧 Environment Variables (Already Configured)
```env
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_R7CcdMXFPJJh8H
RAZORPAY_KEY_SECRET=0czg7fn69muH32FseXEy97F6
RAZORPAY_WEBHOOK_SECRET=Patnibillions09!
```

## 💰 Pricing Structure (USD → INR)
- **ONE T:** $19/month → ₹1,577/month (10,000 credits)
- **ONE Z:** $79/month → ₹6,557/month (50,000 credits) *MOST POPULAR*
- **ONE PRO:** $149/month → ₹12,367/month (100,000 credits)

## 📝 System Architecture
1. **Clerk** handles user authentication and management
2. **Supabase** stores user data, credits, and subscription info
3. **Razorpay** processes monthly payments in INR
4. **Webhooks** automatically allocate credits each billing cycle

## 🎯 Production Deployment Checklist
- [ ] Execute database setup SQL in production Supabase
- [ ] Configure production Razorpay webhook endpoint
- [ ] Update environment variables with production keys
- [ ] Test complete subscription flow in production
- [ ] Monitor webhook delivery and credit allocation

## 🆘 Troubleshooting
- **"Plan not found" error:** Run the database setup SQL first
- **Webhook not working:** Check the webhook URL and secret match
- **Credits not updating:** Verify webhook events are being received
- **Payment fails:** Ensure Razorpay keys are correct for your environment

Your system is now ready for testing! 🎉
