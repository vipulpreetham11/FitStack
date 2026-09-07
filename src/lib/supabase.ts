import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim()
export const isSupabaseConfigured = Boolean(url && key)
export const supabase = isSupabaseConfigured ? createClient<Database>(url!, key!) : null
// Explicit development-only preview. Never used to authorize API/database operations.
export const previewAvailable = import.meta.env.DEV && import.meta.env.VITE_ENABLE_PREVIEW !== 'false'
