
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types.js';
import { envConfig } from '../../../config/environmentalVariables.js';

const { supabase_url, supabase_service_role_key } = envConfig;

if (!supabase_url) throw new Error('Supabase URL missing');
if (!supabase_service_role_key) throw new Error('Supabase service role key missing');

export const supabase = createClient<Database>(
  supabase_url,
  supabase_service_role_key,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
