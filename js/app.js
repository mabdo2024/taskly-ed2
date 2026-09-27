// Main UI logic: connects the page (index.html) to auth.js and tasks.js.
import { isConfigured } from './supabaseClient.js';
import { signUp, signIn, signOut, onAuthChange } from './auth.js';
import { getTasks, createTask, updateTask, deleteTask } from './tasks.js';

// ---------- Grab the elements we need ----------
const $ = (id) => document.getElementById(id);

const pageLoading = $('page-loading');
const setupView = $('setup-view');
const authView = $('auth-view');
const appView = $('app-view');
const userArea = $('user-area');
const userEmail = $('user-email');
const logoutBtn = $('logout-btn');

const authForm = $('auth-form');
const authEmail = $('auth-email');
const authPassword = $('auth-password');
const authSubmit = $('auth-submit');
const authMessage = $('auth-message');
const tabs = document.querySelectorAll('.tab');

const taskForm = $('task-form');
const taskTitle = $('task-title');
const taskDescription = $('task-description');
const taskDue = $('task-due');
const taskPriority = $('task-priority');
const taskSubmit = $('task-submit');

const filterButtons = document.querySelectorAll('.filter');
const listStatus = $('list-status');
const taskList = $('task-list');
const taskTemplate = $('task-template');

const editDialog = $('edit-dialog');
const editForm = $('edit-form');
const editTitle = $('edit-title');
const editDescription = $('edit-description');
const editDue = $('edit-due');
const editPriority = $('edit-priority');
const editCancel = $('edit-cancel');
const editSave = $('edit-save');

const toast = $('toast');

// ---------- App state ----------
let authMode = 'login';   // 'login' or 'signup'
let currentUser = null;   // the logged-in Supabase user, or null
let tasks = [];           // tasks loaded from the database
let filter = 'all';       // 'all' | 'active' | 'completed'
let editingId = null;     // id of the task open in the edit dialog

// ---------- Helpers ----------
function show(el, visible) {
  el.hidden = !visible;
}

let toastTimer;
function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.dataset.type = type;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function setBusy(button, busy, busyText) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

// Turn Supabase error messages into something friendlier
function friendlyError(error) {
  const msg = (error && error.message) || 'Something went wrong. Please try again.';
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first (check your inbox), then log in.';
  if (/already registered|already exists/i.test(msg)) return 'An account with this email already exists. Try logging in.';
  if (/failed to fetch|network/i.test(msg)) return 'Could not reach the server. Check your internet connection.';
  return msg;
}

// Dates are stored as "YYYY-MM-DD". Build a local date so the day
// does not shift because of time zones.
function parseDate(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDue(value) {
  const due = parseDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return 'Due yesterday';
  const label = due.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: due.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
  return `Due ${label}`;
}

function isOverdue(task) {
  if (!task.due_date || task.is_complete) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseDate(task.due_date) < today;
}

// Unfinished tasks first, then by due date (soonest first), then newest.
function sortTasks(list) {
  return [...list].sort((a, b) => {
    if (a.is_complete !== b.is_complete) return a.is_complete ? 1 : -1;
    if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

// ---------- Which screen to show ----------
function renderScreen() {
  show(pageLoading, false);
  const loggedIn = Boolean(currentUser);
  show(authView, !loggedIn);
  show(appView, loggedIn);
  show(userArea, loggedIn);
  userEmail.textContent = loggedIn ? currentUser.email : '';
}

// ---------- Register / log in ----------
function setAuthMode(mode) {
  authMode = mode;
  tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.mode === mode)));
  authSubmit.textContent = mode === 'login' ? 'Log in' : 'Create account';
  authPassword.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  authMessage.textContent = '';
  authMessage.dataset.type = '';
}

tabs.forEach((tab) => tab.addEventListener('click', () => setAuthMode(tab.dataset.mode)));

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !authEmail.checkValidity()) {
    authMessage.dataset.type = 'error';
    authMessage.textContent = 'Please enter a valid email address.';
    return;
  }
  if (password.length < 6) {
    authMessage.dataset.type = 'error';
    authMessage.textContent = 'Password must be at least 6 characters.';
    return;
  }

  authMessage.textContent = '';
  setBusy(authSubmit, true, authMode === 'login' ? 'Logging in…' : 'Creating account…');
  try {
    if (authMode === 'signup') {
      const { needsConfirmation } = await signUp(email, password);
      if (needsConfirmation) {
        setAuthMode('login');
        authMessage.dataset.type = 'success';
        authMessage.textContent = 'Account created! Check your email for a confirmation link, then log in.';
      }
      // If no confirmation is needed, the user is now logged in and
      // onAuthChange will switch to the task screen.
    } else {
      await signIn(email, password);
    }
    authPassword.value = '';
  } catch (error) {
    authMessage.dataset.type = 'error';
    authMessage.textContent = friendlyError(error);
  } finally {
    setBusy(authSubmit, false);
  }
});

// ---------- Log out ----------
logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  try {
    await signOut();
    showToast('You have been logged out.');
  } catch (error) {
    showToast(friendlyError(error), 'error');
  } finally {
    logoutBtn.disabled = false;
  }
});

// ---------- Load and show tasks (READ) ----------
async function loadTasks() {
  listStatus.textContent = 'Loading your tasks…';
  taskList.replaceChildren();
  try {
    tasks = await getTasks();
    renderTasks();
  } catch (error) {
    listStatus.textContent = `Could not load tasks: ${friendlyError(error)}`;
  }
}

function renderTasks() {
  const active = tasks.filter((t) => !t.is_complete);
  const completed = tasks.filter((t) => t.is_complete);
  $('count-all').textContent = tasks.length;
  $('count-active').textContent = active.length;
  $('count-completed').textContent = completed.length;

  const visible = sortTasks(filter === 'active' ? active : filter === 'completed' ? completed : tasks);

  if (tasks.length === 0) {
    listStatus.textContent = 'No tasks yet. Add your first one above!';
  } else if (visible.length === 0) {
    listStatus.textContent = filter === 'active' ? 'Nothing left to do. Nice work!' : 'No completed tasks yet.';
  } else {
    listStatus.textContent = '';
  }

  taskList.replaceChildren(...visible.map(buildTaskItem));
}

// Build one <li> from the <template> in index.html.
// textContent is used (not innerHTML) so user text can never run as code.
function buildTaskItem(task) {
  const item = taskTemplate.content.firstElementChild.cloneNode(true);
  item.dataset.id = task.id;
  item.classList.toggle('is-complete', task.is_complete);

  const toggle = item.querySelector('.task-toggle');
  toggle.checked = task.is_complete;
  item.querySelector('.task-toggle-label').textContent =
    `Mark "${task.title}" as ${task.is_complete ? 'not done' : 'done'}`;
  toggle.addEventListener('change', () => toggleComplete(task, toggle));

  item.querySelector('.task-title').textContent = task.title;

  const description = item.querySelector('.task-description');
  description.textContent = task.description || '';
  show(description, Boolean(task.description));

  const priority = item.querySelector('.priority');
  priority.textContent = `${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`;
  priority.dataset.level = task.priority;

  const due = item.querySelector('.due');
  if (task.due_date) {
    due.textContent = isOverdue(task) ? `Overdue · ${formatDue(task.due_date)}` : formatDue(task.due_date);
    due.classList.toggle('is-overdue', isOverdue(task));
  } else {
    due.remove();
  }

  item.querySelector('.task-edit').addEventListener('click', () => openEditDialog(task));
  item.querySelector('.task-delete').addEventListener('click', () => removeTask(task));
  return item;
}

// Replace one task in our local list with the fresh copy from the database
function replaceTask(updated) {
  tasks = tasks.map((t) => (t.id === updated.id ? updated : t));
}

// ---------- Filters ----------
filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    filterButtons.forEach((b) => {
      const on = b === button;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    renderTasks();
  });
});

// ---------- Add a task (CREATE) ----------
taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = taskTitle.value.trim();
  if (!title) {
    showToast('Please give the task a title.', 'error');
    taskTitle.focus();
    return;
  }

  setBusy(taskSubmit, true, 'Adding…');
  try {
    const task = await createTask({
      title,
      description: taskDescription.value.trim() || null,
      due_date: taskDue.value || null,
      priority: taskPriority.value,
    });
    tasks = [task, ...tasks];
    taskForm.reset();
    taskPriority.value = 'medium';
    renderTasks();
    showToast('Task added.', 'success');
    taskTitle.focus();
  } catch (error) {
    showToast(`Could not add task: ${friendlyError(error)}`, 'error');
  } finally {
    setBusy(taskSubmit, false);
  }
});

// ---------- Check / uncheck a task (UPDATE) ----------
async function toggleComplete(task, checkbox) {
  checkbox.disabled = true;
  try {
    const updated = await updateTask(task.id, { is_complete: !task.is_complete });
    replaceTask(updated);
    renderTasks();
  } catch (error) {
    checkbox.checked = task.is_complete;
    checkbox.disabled = false;
    showToast(`Could not update task: ${friendlyError(error)}`, 'error');
  }
}

// ---------- Edit a task (UPDATE) ----------
function openEditDialog(task) {
  editingId = task.id;
  editTitle.value = task.title;
  editDescription.value = task.description || '';
  editDue.value = task.due_date || '';
  editPriority.value = task.priority;
  editDialog.showModal();
  editTitle.focus();
}

editCancel.addEventListener('click', () => editDialog.close());

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = editTitle.value.trim();
  if (!title) {
    showToast('The title cannot be empty.', 'error');
    editTitle.focus();
    return;
  }

  setBusy(editSave, true, 'Saving…');
  try {
    const updated = await updateTask(editingId, {
      title,
      description: editDescription.value.trim() || null,
      due_date: editDue.value || null,
      priority: editPriority.value,
    });
    replaceTask(updated);
    renderTasks();
    editDialog.close();
    showToast('Task updated.', 'success');
  } catch (error) {
    showToast(`Could not save changes: ${friendlyError(error)}`, 'error');
  } finally {
    setBusy(editSave, false);
  }
});

// ---------- Delete a task (DELETE) ----------
async function removeTask(task) {
  if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
  try {
    await deleteTask(task.id);
    tasks = tasks.filter((t) => t.id !== task.id);
    renderTasks();
    showToast('Task deleted.');
  } catch (error) {
    showToast(`Could not delete task: ${friendlyError(error)}`, 'error');
  }
}

// ---------- Start the app ----------
if (!isConfigured) {
  show(pageLoading, false);
  show(setupView, true);
} else {
  // Fires once right away (with the saved session, if any) and again
  // every time the user logs in or out.
  onAuthChange((user) => {
    const changedUser = (user?.id ?? null) !== (currentUser?.id ?? null);
    currentUser = user;
    renderScreen();
    if (!changedUser) return;
    if (user) {
      loadTasks();
    } else {
      tasks = [];
      taskList.replaceChildren();
      setAuthMode('login');
    }
  });
}
