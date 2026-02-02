import type { Database } from "../../../shared/types/database.types.js";

// Use 'type' instead of 'export const'
export type Alert = Database['public']['Tables']['alert_history']['Row'];