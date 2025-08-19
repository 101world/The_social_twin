# Updated Billing Plans - Final Specifications

## 📊 **Plan Overview**

| Plan | Price (USD) | Price (INR) | Images/Month | Videos/Month | Total Credits | Credits Calculation |
|------|-------------|-------------|--------------|--------------|---------------|-------------------|
| **One T** | $19 | ₹1,577 | 200 | 12 | 1,120 | (200×5) + (12×10) |
| **One Z** | $79 | ₹6,557 | 700 | 55 | 4,050 | (700×5) + (55×10) |
| **One Pro** | $149 | ₹12,367 | 1,500 | 120 | 8,700 | (1500×5) + (120×10) |
| **ONE MAX** | $15/hour | ₹1,245/hour | Unlimited* | Unlimited* | Balance-based | Pay per usage |

*Unlimited during active hourly session

## 🎯 **Credit System Details**

### Generation Costs:
- **Text Generation:** 1 credit
- **Image Generation:** 5 credits  
- **Image Modification:** 3 credits
- **Video Generation:** 10 credits

### Performance Tiers:
- **Monthly Plans:** 30s per image, 450s per video
- **ONE MAX:** 7s per image, 150s per video (4x faster images, 3x faster videos)

## 📈 **Capacity Analysis**

### One T Plan ($19/month):
- **200 images** + **12 videos** = **1,120 credits**
- If only images: 224 possible (1120 ÷ 5)
- If only videos: 112 possible (1120 ÷ 10)
- **Value:** $0.095 per image, $1.58 per video

### One Z Plan ($79/month):
- **700 images** + **55 videos** = **4,050 credits**  
- If only images: 810 possible (4050 ÷ 5)
- If only videos: 405 possible (4050 ÷ 10)
- **Value:** $0.113 per image, $1.44 per video

### One Pro Plan ($149/month):
- **1,500 images** + **120 videos** = **8,700 credits**
- If only images: 1,740 possible (8700 ÷ 5) 
- If only videos: 870 possible (8700 ÷ 10)
- **Value:** $0.099 per image, $1.24 per video

### ONE MAX Plan ($15/hour):
- **Unlimited generations** during active session
- **Minimum purchase:** $100 (6.67 hours)
- **Ultra-fast processing:** 7s images, 150s videos
- **Pause/resume:** Full session control

## 🛠 **Technical Implementation**

### Database Changes Required:

1. **Update plan_pricing table:**
   ```sql
   -- One T: 1,120 credits (200 images, 12 videos)
   -- One Z: 4,050 credits (700 images, 55 videos)  
   -- One Pro: 8,700 credits (1,500 images, 120 videos)
   ```

2. **Update existing user credits:**
   ```sql
   -- Adjust all active subscribers to new credit amounts
   ```

3. **Maintain existing RPC functions:**
   ```sql
   -- deduct_credits_simple() - 5 credits per image, 10 per video
   -- add_credits_simple() - for top-ups and renewals
   ```

## 📋 **Deployment Files**

### Essential SQL Files:
1. **`UPDATED_CREDIT_SYSTEM_FINAL.sql`** - Complete credit system update
2. **`COMPLETE_SUPABASE_SETUP.sql`** - Updated with new credit amounts  
3. **`BILLING_VERIFICATION_SCRIPT.sql`** - Comprehensive testing and validation
4. **`HOURLY_USAGE_SETUP.sql`** - ONE MAX hourly billing system

### Execution Order:
1. Run `UPDATED_CREDIT_SYSTEM_FINAL.sql` - Updates credits and validates
2. Run `BILLING_VERIFICATION_SCRIPT.sql` - Verifies everything works
3. Test with existing users to ensure smooth transition
4. Deploy to production

## ✅ **Migration Strategy**

### For Existing Users:
- **One T users:** Credits adjusted from 10,000 → 1,120 
- **One Z users:** Credits adjusted from 50,000 → 4,050
- **One Pro users:** Credits adjusted from 100,000 → 8,700

### Communication Plan:
- **Benefit:** More targeted, affordable plans with exact generation limits
- **Value:** Clear understanding of monthly generation capacity
- **Upgrade path:** ONE MAX for unlimited ultra-fast generations

## 🎊 **Key Benefits**

1. **Predictable Usage:** Exact image/video limits per plan
2. **Fair Pricing:** Credits perfectly match generation capacity  
3. **Clear Value:** Users know exactly what they get
4. **Scalable:** Easy to add new plans or adjust limits
5. **Efficient:** No wasted credits or confusing calculations

## 🚀 **Ready for Production**

Your billing system is now optimized for:
- ✅ Exact generation limits per plan
- ✅ Fair credit allocation 
- ✅ Clear pricing structure
- ✅ Seamless webhook processing
- ✅ Ultra-fast ONE MAX option
- ✅ Complete testing and validation

**Next Step:** Execute the SQL files in Supabase to deploy your updated billing system!
