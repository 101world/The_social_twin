-- Enable uuid-ossp extension for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CHAT TOPICS: Each user can create multiple chat topics
CREATE TABLE IF NOT EXISTS public.chat_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL, -- Clerk user ID (string, not UUID)
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CHAT MESSAGES: Messages belong to topics, sent by user or AI
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID NOT NULL REFERENCES public.chat_topics(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- Clerk user ID
    role TEXT NOT NULL, -- 'user' or 'ai'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MEDIA GENERATIONS: Images or videos generated per topic
CREATE TABLE IF NOT EXISTS public.media_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    topic_id UUID NOT NULL REFERENCES public.chat_topics(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- Clerk user ID
    type TEXT NOT NULL, -- 'image' or 'video'
    prompt TEXT,
    result_url TEXT,
    credits_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- USER CREDITS: Track credits per user
CREATE TABLE IF NOT EXISTS public.user_credits (
    user_id TEXT PRIMARY KEY, -- Clerk user ID
    credits INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ROW LEVEL SECURITY POLICIES --

-- Enable RLS on tables
ALTER TABLE public.chat_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can select/insert/update/delete only their own chat topics
-- Note: We'll use a function to get the current user ID from Clerk JWT
CREATE POLICY "Users can manage their own chat topics" ON public.chat_topics
    FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub') 
    WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policy: Users can manage only messages in their own topics
CREATE POLICY "Users can manage their own chat messages" ON public.chat_messages
    FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub') 
    WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policy: Users can manage only media generations belonging to their topics
CREATE POLICY "Users can manage their own media generations" ON public.media_generations
    FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub') 
    WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Policy: Users can view and update only their own credits
CREATE POLICY "Users can manage their own credits" ON public.user_credits
    FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub') 
    WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_generations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_credits TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_topics_user_id ON public.chat_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_topic_id ON public.chat_messages(topic_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_media_generations_topic_id ON public.media_generations(topic_id);
CREATE INDEX IF NOT EXISTS idx_media_generations_user_id ON public.media_generations(user_id);
