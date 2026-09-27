// User authentication: register, log in, log out.
// Supabase Auth stores the logged-in session in the browser, so users
// stay logged in after a page refresh until they log out.
import { supabase } from './supabaseClient.js';

/**
 * Create a new account.
 * Returns { needsConfirmation: true } when the Supabase project requires
 * users to click a link in a confirmation email before logging in.
 */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { user: data.user, needsConfirmation: !data.session };
}

/** Log in with email and password. */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

/** Log out and clear the saved session. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Run `callback(user)` now and whenever the user logs in or out.
 * `user` is null when nobody is logged in.
 */
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    // Supabase recommends not calling other Supabase functions directly
    // inside this listener, so hand off to the next tick.
    setTimeout(() => callback(session?.user ?? null), 0);
  });
}
