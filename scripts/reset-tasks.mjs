import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xscrzflxveljmzfdmmqp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zvqnRdYi18Fz6UFoKqeG1w_EnsDC599';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function resetTasks() {
  console.log('🗑️ Resetting all tasks data (keeping members)...\n');
  
  // Delete in order (respect foreign keys)
  const steps = [
    { name: 'log_entries', table: 'log_entries' },
    { name: 'task_assignees', table: 'task_assignees' },
    { name: 'tags', table: 'tags' },
    { name: 'tasks', table: 'tasks' },
  ];
  
  for (const step of steps) {
    console.log(`Deleting ${step.name}...`);
    const { error } = await supabase.from(step.table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.error(`❌ Failed to delete ${step.name}:`, error.message);
    } else {
      console.log(`✅ ${step.name} cleared`);
    }
  }
  
  console.log('\n🎉 All tasks data reset! Members preserved.');
}

resetTasks().catch(console.error);
