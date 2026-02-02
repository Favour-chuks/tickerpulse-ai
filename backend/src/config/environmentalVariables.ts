import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from "url";


if (process.env.NODE_ENV !== "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
}


export const envConfig = {
 node_port: process.env.PORT,
 node_host: process.env.HOST,
 node_env: process.env.NODE_ENV,
 
 cors_origin: process.env.CORS_ORIGIN,
 
 log_level: process.env.LOG_LEVEL,
 enable_request_logging: process.env.ENABLE_REQUEST_LOGGING === 'true',

 redis_service_uri: process.env.REDIS_SERVICE_URI,
 redis_port: process.env.REDIS_PORT,
 redis_host: process.env.REDIS_HOST,
 redis_password: process.env.REDIS_PASSWORD,
 redis_username: process.env.REDIS_USERNAME,

 
 supabase_api_key: process.env.SUPABASE_API_KEY,
 supabase_url: process.env.SUPABASE_URL,
 supabase_service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
 supabase_anon_key: process.env.SUPABASE_ANON_KEY,
 
 gemini_api_key: process.env.GEMINI_API_KEY,
 gemini_api_key2: process.env.GEMINI_API_KEY2,
 gemini_api_key3: process.env.GEMINI_API_KEY3,
 google_client_id: process.env.GOOGLE_CLIENT_ID,
 google_client_secret: process.env.GOOGLE_CLIENT_ID,
 oauth_redirect_url: process.env.OAUTH_REDIRECT_URL,
 
 finnhub_api_key:process.env.FINNHUB_API_KEY,

  vapid_public_key:process.env.VAPID_PUBLIC_KEY,
  vapid_private_key:process.env.VAPID_PRIVATE_KEY,

 rate_limit_window: process.env.RATE_LIMIT_WINDOW_MS,
 rate_limit_max_requests: process.env.RATE_LIMIT_MAX_REQUESTS,

 alert_retry_attempts: process.env.ALERT_RETRY_ATTEMPTS,
 alert_retry_delay_ms: process.env.ALERT_RETRY_DELAY_MS,
 
 filing_batch_size: process.env.FILING_BATCH_SIZE,
 news_fetch_interval_minutes: process.env.NEWS_FETCH_INTERVAL_MINUTES,
 worker_check_interval_ms: process.env.WORKER_CHECK_INTERVAL_MS,
 worker_max_concurrent_jobs: process.env.WORKER_MAX_CONCURRENT_JOBS,
 volume_spike_threshold: process.env.VOLUME_SPIKE_THRESHOLD,
 min_z_score: process.env.MIN_Z_SCORE,
 
 sentry_dsn: process.env.SENTRY_DSN,
 datadog_api_key: process.env.DATADOG_API_KEY,

 debug: process.env.DEBUG,
 debug_tests: process.env.DEBUG_TESTS,
}