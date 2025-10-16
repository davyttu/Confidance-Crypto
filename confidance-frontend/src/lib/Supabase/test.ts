// src/lib/supabase/test.ts
import { supabase } from './client';

export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('scheduled_payments')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Supabase Error:', error);
      return false;
    }

    console.log('✅ Supabase connected successfully!');
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error);
    return false;
  }
}