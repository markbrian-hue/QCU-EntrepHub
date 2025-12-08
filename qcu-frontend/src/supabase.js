import { createClient } from '@supabase/supabase-js'

// REPLACE THESE WITH YOUR KEYS FROM SUPABASE DASHBOARD
const supabaseUrl = 'https://tlbbtuqqbclzfqycjqvr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsYmJ0dXFxYmNsemZxeWNqcXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMDY5MzYsImV4cCI6MjA4MDc4MjkzNn0.ogwJXcObxFs2w17qSF1uyUBuWDF4pT56cSBaJYZ3nGk'

export const supabase = createClient(supabaseUrl, supabaseKey)