-- Razorpay Payment Integration Tables

-- USER PAYMENTS: Track all payment transactions
CREATE TABLE IF NOT EXISTS public.user_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL, -- Clerk user ID
    payment_id TEXT NOT NULL UNIQUE, -- Razorpay payment ID
    order_id TEXT NOT NULL, -- Razorpay order ID  
    amount DECIMAL(10,2) NOT NULL, -- Amount in rupees
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
    provider TEXT NOT NULL DEFAULT 'razorpay', -- Payment provider
    plan_id TEXT, -- Plan identifier (basic, pro, premium)
    credits_added INTEGER DEFAULT 0, -- Credits added for this payment
    metadata JSONB, -- Store full payment data from Razorpay
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_payments_user_id ON public.user_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_payments_payment_id ON public.user_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_user_payments_status ON public.user_payments(status);
CREATE INDEX IF NOT EXISTS idx_user_payments_created_at ON public.user_payments(created_at);

-- Enable RLS
ALTER TABLE public.user_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view only their own payments
CREATE POLICY "Users can view their own payments" ON public.user_payments
FOR SELECT USING (
    user_id = (
        SELECT COALESCE(
            auth.jwt() ->> 'sub',
            auth.jwt() ->> 'user_id'
        )
    )
);

-- Policy: Service role can manage all payments (for webhooks)
CREATE POLICY "Service role can manage all payments" ON public.user_payments
FOR ALL USING (auth.role() = 'service_role');

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_payments_updated_at 
    BEFORE UPDATE ON public.user_payments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON TABLE public.user_payments TO authenticated;
GRANT ALL ON TABLE public.user_payments TO service_role;
