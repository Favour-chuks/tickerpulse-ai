
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types.js';
import { envConfig } from '../../../config/environmentalVariables.js';

const { supabase_url, supabase_service_role_key } = envConfig;

if (!supabase_url) throw new Error('Supabase URL missing');
if (!supabase_service_role_key) throw new Error('Supabase service role key missing');

// Use a loosely-typed client in application code to avoid strict table-name
// overloads in many dynamic places. For stricter typing, replace `any` with
// `Database` and update queries to use typed tables.
export const supabase = createClient<any>(
  supabase_url,
  supabase_service_role_key,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
