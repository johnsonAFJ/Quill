// Signing in to Dropbox and talking to the app folder.
//
// Sign-in uses Dropbox's flow for apps with no server of their own (PKCE):
// Quill sends you to Dropbox, Dropbox sends you back with a one-time code,
// and Quill trades that code for a long-lived "refresh token" stored on this
// device. No password or App secret is ever involved.

import { Dropbox, DropboxAuth, DropboxResponseError, type files } from 'dropbox';
import type { Entry } from '../library/tree';

/** Registered as "Quill Writer" on the Personal Dropbox account. Safe to be public. */
const APP_KEY = '6k1n5w6asnatzen';

const REFRESH_TOKEN_KEY = 'quill.dropbox.refreshToken';
const VERIFIER_KEY = 'quill.dropbox.codeVerifier';
const STATE_KEY = 'quill.dropbox.state';

/** Where Dropbox sends you back after sign-in. Must match a Redirect URI on the Dropbox app. */
const redirectUri = new URL(import.meta.env.BASE_URL, location.origin).href;

export async function startSignIn(): Promise<void> {
  const auth = new DropboxAuth({ clientId: APP_KEY });
  const state = crypto.randomUUID();
  const url = await auth.getAuthenticationUrl(redirectUri, state, 'code', 'offline', undefined, 'none', true);
  // localStorage rather than sessionStorage: on iPhone the trip to Dropbox and
  // back can land in a fresh page session.
  localStorage.setItem(VERIFIER_KEY, auth.getCodeVerifier());
  localStorage.setItem(STATE_KEY, state);
  location.href = String(url);
}

/**
 * If this page load is Dropbox sending you back, finish signing in.
 * Returns an error message to show, or null.
 */
export async function finishSignInIfReturning(): Promise<string | null> {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const error = params.get('error_description') ?? params.get('error');
  if (!code && !error) return null;

  const clearUrl = () => history.replaceState(null, '', redirectUri);
  const verifier = localStorage.getItem(VERIFIER_KEY);
  const expectedState = localStorage.getItem(STATE_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
  clearUrl();

  if (error) return `Dropbox didn’t connect: ${error}`;
  if (!verifier || params.get('state') !== expectedState) {
    return 'That sign-in link didn’t come from this copy of Quill. Tap Connect Dropbox to try again.';
  }

  const auth = new DropboxAuth({ clientId: APP_KEY });
  auth.setCodeVerifier(verifier);
  const response = await auth.getAccessTokenFromCode(redirectUri, code!);
  const { refresh_token } = response.result as { refresh_token?: string };
  if (!refresh_token) return 'Dropbox didn’t send a sign-in token. Try connecting again.';
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
  return null;
}

export function isConnected(): boolean {
  return localStorage.getItem(REFRESH_TOKEN_KEY) !== null;
}

function client(): Dropbox {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) throw new Error('Not connected to Dropbox.');
  return new Dropbox({ auth: new DropboxAuth({ clientId: APP_KEY, refreshToken }) });
}

/** Forgets this device's sign-in and tells Dropbox to cancel it. Files are untouched. */
export async function disconnect(): Promise<void> {
  try {
    await client().authTokenRevoke();
  } catch {
    // Offline or already revoked: forgetting it locally is what matters.
  }
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function accountLabel(): Promise<string> {
  const { result } = await client().usersGetCurrentAccount();
  return `${result.name.display_name} (${result.email})`;
}

/** Every file and folder in the app folder. */
export async function listEverything(): Promise<Entry[]> {
  const dbx = client();
  const entries: Entry[] = [];
  const add = (items: files.ListFolderResult['entries']) => {
    for (const item of items) {
      if (item['.tag'] === 'folder') entries.push({ kind: 'folder', path: item.path_display ?? item.name });
      if (item['.tag'] === 'file') entries.push({ kind: 'file', path: item.path_display ?? item.name, modified: item.server_modified });
    }
  };
  let page = (await dbx.filesListFolder({ path: '', recursive: true })).result;
  add(page.entries);
  while (page.has_more) {
    page = (await dbx.filesListFolderContinue({ cursor: page.cursor })).result;
    add(page.entries);
  }
  return entries;
}

const WELCOME_PATH = '/Welcome to Quill.md';
const WELCOME_TEXT = `# Welcome to Quill

If you can read this in Dropbox, Quill can save files. This sheet is safe to delete.
`;

/**
 * Proves Quill can write. Uses Dropbox's "add" mode, which refuses to replace
 * an existing file, so this can never overwrite anything.
 * Returns false if the file was already there.
 */
export async function writeWelcomeSheet(): Promise<boolean> {
  const dbx = client();
  // "add" mode quietly succeeds when an identical file exists, so check first
  // to report honestly. The "add" mode below is still what prevents overwrites.
  try {
    await dbx.filesGetMetadata({ path: WELCOME_PATH });
    return false;
  } catch (err) {
    if (!(err instanceof DropboxResponseError && err.status === 409)) throw err;
  }
  try {
    await dbx.filesUpload({
      path: WELCOME_PATH,
      contents: WELCOME_TEXT,
      mode: { '.tag': 'add' },
      autorename: false,
    });
    return true;
  } catch (err) {
    if (err instanceof DropboxResponseError && err.status === 409) return false;
    throw err;
  }
}

/** Turns anything thrown by the Dropbox SDK into a sentence worth showing. */
export function describeError(err: unknown): string {
  if (err instanceof DropboxResponseError) {
    if (err.status === 401) return 'Dropbox says this device is no longer signed in. Disconnect and connect again.';
    const summary = (err.error as { error_summary?: string } | undefined)?.error_summary;
    return `Dropbox error ${err.status}${summary ? `: ${summary}` : ''}`;
  }
  if (err instanceof TypeError) return 'Couldn’t reach Dropbox. Check the connection and try again.';
  return err instanceof Error ? err.message : String(err);
}
