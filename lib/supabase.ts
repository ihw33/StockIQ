import { createClient } from '@supabase/supabase-js'

// Fallback to placeholder values during build time if env vars are missing
// This prevents build failures in CI/CD or when setting up the project
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
