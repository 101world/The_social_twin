#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

async function main(){
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const userId = process.env.TEST_USER_ID || process.env.CLERK_USER_ID || process.env.USER_ID;
  if(!userId){
    console.error('Set TEST_USER_ID (a Clerk user id) in env to associate the test generation.');
    process.exit(1);
  }

  // create a topic for the test
  const title = `Worker Test - ${new Date().toISOString()}`;
  const { data: topic, error: topicErr } = await supabase.from('chat_topics').insert({ user_id: userId, title }).select('id').single();
  if(topicErr){ console.error('Failed to create topic:', topicErr); process.exit(1); }

  const job = {
    topic_id: topic.id,
    user_id: userId,
    type: 'image',
    prompt: 'Test: worker enqueue',
    // For simple schemas that don't have a status/generation_params column, use a sentinel
    // so the worker can find and claim the job.
    result_url: 'PENDING_FOR_WORKER'
  };

  const { data: inserted, error: insertErr } = await supabase.from('media_generations').insert(job).select('id').single();
  if(insertErr){ console.error('Failed to insert test job:', insertErr); process.exit(1); }
  console.log('Inserted test job id:', inserted.id, 'topic_id:', topic.id);
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(1); });
