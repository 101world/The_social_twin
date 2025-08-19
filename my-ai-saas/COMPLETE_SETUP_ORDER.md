# 🚀 COMPLETE SUPABASE SETUP - EXECUTION ORDER

## 📋 **RUN THESE FILES IN EXACT ORDER:**

### **STEP 1: Foundation Setup**
```
COMPLETE_SUPABASE_SETUP.sql
```
**Purpose:** Creates ALL core tables, RPC functions, and billing system

### **STEP 2: Update Credit Limits** 
```
FIXED_CREDIT_SYSTEM_UPDATE.sql
```
**Purpose:** Updates to your exact requirements (200 images/12 videos etc.)

### **STEP 3: Add Hourly System**
```
HOURLY_USAGE_SETUP.sql
```
**Purpose:** Adds $15/hour ONE MAX billing system

### **STEP 4: Verify Everything**
```
BILLING_VERIFICATION_SCRIPT.sql
```
**Purpose:** Tests and validates entire system

---

## 🔄 **COMPLETE FLOW VERIFICATION:**

**User Flow:**
1. User signs up → **Clerk** handles auth
2. User subscribes → **Razorpay** processes payment  
3. Webhook hits → **Supabase** updates credits/billing
4. User generates → **Credits deducted** seamlessly
5. User enjoys → **Chat history stored** in Supabase

**Database Flow:**
- `user_credits` → Current credit balance
- `user_billing` → Plan status (One T/Z/Pro/MAX)
- `user_payments` → Payment history
- `chat_topics` & `chat_messages` → Chat history
- `media_generations` → Generated content

---

## ✅ **AFTER RUNNING ALL 4 FILES, YOUR SYSTEM WILL HAVE:**

### Core Tables:
- ✅ `user_credits` - Credit balances
- ✅ `user_billing` - Subscription plans  
- ✅ `user_payments` - Payment history
- ✅ `plan_pricing` - Plan details with exact limits
- ✅ `processed_webhooks` - Webhook tracking

### RPC Functions:
- ✅ `deduct_credits_simple()` - For generations
- ✅ `add_credits_simple()` - For top-ups
- ✅ `set_monthly_credits()` - For renewals

### Plan Limits:
- ✅ **One T:** 200 images + 12 videos = 1,120 credits
- ✅ **One Z:** 700 images + 55 videos = 4,050 credits
- ✅ **One Pro:** 1,500 images + 120 videos = 8,700 credits
- ✅ **ONE MAX:** Unlimited during $15/hour session

### Security:
- ✅ Row Level Security (RLS) enabled
- ✅ Clerk auth integration
- ✅ Proper permissions for users/service

---

## 🎯 **EXECUTION CHECKLIST:**

1. ✅ Open Supabase SQL Editor
2. ✅ Run `COMPLETE_SUPABASE_SETUP.sql` → Creates foundation
3. ✅ Run `FIXED_CREDIT_SYSTEM_UPDATE.sql` → Updates credit limits  
4. ✅ Run `HOURLY_USAGE_SETUP.sql` → Adds hourly billing
5. ✅ Run `BILLING_VERIFICATION_SCRIPT.sql` → Verifies everything
6. ✅ Test with your app → Generate content, check credits
7. ✅ Go live with confidence! 🚀

**Total Setup Time:** ~5 minutes
**Result:** Complete, seamless billing system ready for production!
