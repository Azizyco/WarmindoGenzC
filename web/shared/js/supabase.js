/**
 * Supabase Client Initialization
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to your Supabase project dashboard
 * 2. Copy your Project URL and anon/public key
 * 3. Replace the placeholder values below
 * 
 * NOTE: This uses Supabase CDN (no npm required)
 * The supabase-js library is loaded via <script> tag in HTML files
 */

const SUPABASE_URL = 'https://caheywvfmftksrjgdkjr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhaGV5d3ZmbWZ0a3Nyamdka2pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwOTkwMzUsImV4cCI6MjA3MzY3NTAzNX0.GHTiKs0ewjUYr6PPxt7sufZk1mCMzshjVxvdv2j5TuA';

// Initialize Supabase client (supabase is loaded from CDN)
const { createClient } = window.supabase;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper: Check connection
export async function checkConnection() {
  try {
    const { error } = await supabase.from('orders').select('count', { count: 'exact', head: true });
    return !error;
  } catch (err) {
    return false;
  }
}
