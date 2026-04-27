import { createClient } from '@supabase/supabase-js'

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL
let supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export let supabase = createClient(supabaseUrl, supabaseKey)