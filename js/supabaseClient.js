// Creates the one Supabase client that the rest of the app shares.
// The library is loaded straight from a CDN, so there is no npm install
// or build step: the site is plain HTML, CSS, and JavaScript.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// True once real values have been pasted into js/config.js
export const isConfigured =
  SUPABASE_URL.startsWith('https://') && !SUPABASE_KEY.startsWith('YOUR_');

export const supabase = isConfigured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
