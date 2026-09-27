// Database access for the "tasks" table (the CRUD operations).
// Every request is sent with the logged-in user's token, and the Row
// Level Security policies in supabase/schema.sql make sure a user can
// only ever read or change their own rows.
import { supabase } from './supabaseClient.js';

const TABLE = 'tasks';

/** READ: all of the current user's tasks, newest first. */
export async function getTasks() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * CREATE: add a task. user_id is filled in by the database
 * (its default value is auth.uid(), the logged-in user).
 */
export async function createTask({ title, description, due_date, priority }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ title, description, due_date, priority })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** UPDATE: change some fields of a task, e.g. { is_complete: true }. */
export async function updateTask(id, changes) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(changes)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** DELETE: remove a task permanently. */
export async function deleteTask(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
