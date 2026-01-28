require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function listNotifications() {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n📬 ${data.length} notification(s) dans la base:\n`);

  data.forEach((n, i) => {
    const readIcon = n.read ? '✓' : '•';
    console.log(`${i + 1}. [${readIcon}] ${n.title}`);
    console.log(`   ${n.message}`);
    console.log(`   ${new Date(n.created_at).toLocaleString()}`);
    console.log('');
  });
}

listNotifications();
