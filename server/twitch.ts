import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Twitch's own web-player endpoint and its public Client-ID - the same approach
// Clip-n-Ship's server/ambassadors.js already uses. It's undocumented, so
// everything here treats a failure as "no answer", never as an error the user
// sees: the page just doesn't tick the box / show a suggestion.
const GQL_URL = "https://gql.twitch.tv/gql";
const CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

async function gql(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: { "Client-ID": CLIENT_ID, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Twitch said " + res.status);
  const body = (await res.json()) as { data?: any; errors?: { message: string }[] };
  if (body.errors) throw new Error(body.errors[0].message);
  return body.data;
}

// --- Ambassadors -----------------------------------------------------------
// Starts from the snapshot copied out of Clip-n-Ship (server/data/), so it works
// instantly and offline, then swaps in the live team roster from Twitch when it
// can get it.
const SNAPSHOT = path.join(__dirname, "data", "ambassadors.txt");

function readSnapshot(): Set<string> {
  try {
    const lines = fs.readFileSync(SNAPSHOT, "utf8").split("\n");
    return new Set(lines.map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#")));
  } catch {
    return new Set();
  }
}

let ambassadors = readSnapshot();

export function getAmbassadorLogins(): string[] {
  return [...ambassadors].sort();
}

const PAGE = 100;
async function fetchLiveAmbassadors(): Promise<Set<string>> {
  const logins: string[] = [];
  let total: number | null = null;
  for (let guard = 0; guard < 20; guard++) {
    // Twitch pages by offset: the cursor is just {"v":1,"o":<how many to skip>}.
    const after = logins.length
      ? Buffer.from(JSON.stringify({ v: 1, o: logins.length })).toString("base64")
      : null;
    const data = await gql(
      `query($after: Cursor) { team(name: "ambassadors") { members(first: ${PAGE}, after: $after) { totalCount edges { node { login } } pageInfo { hasNextPage } } } }`,
      { after }
    );
    const members = data.team.members;
    total = members.totalCount;
    for (const e of members.edges) logins.push(String(e.node.login).toLowerCase());
    if (!members.pageInfo.hasNextPage || !members.edges.length) break;
  }
  const unique = new Set(logins);
  // A short page means Twitch gave us a partial roster - keep what we have.
  if (total && unique.size < total * 0.9) throw new Error(`only got ${unique.size} of ${total} ambassadors`);
  return unique;
}

async function refreshAmbassadors() {
  try {
    ambassadors = await fetchLiveAmbassadors();
    console.log(`Ambassador list refreshed from Twitch (${ambassadors.size} channels).`);
  } catch (err) {
    console.error("Couldn't refresh the Ambassador list (using the last one):", err instanceof Error ? err.message : err);
  }
}

export function startAmbassadorRefresh() {
  void refreshAmbassadors();
  setInterval(refreshAmbassadors, 24 * 60 * 60 * 1000).unref();
}

// --- Display-name lookup ---------------------------------------------------
// Twitch only lets a display name differ from the login by capitalization (or
// swap in non-Latin characters), so this is how we find a streamer's real casing.
const NAME_TTL_MS = 60 * 60 * 1000;
const NAME_CACHE_MAX = 5000;
const nameCache = new Map<string, { displayName: string | null; at: number }>();

export const LOGIN_RE = /^[A-Za-z0-9_]{3,25}$/;

// Returns null both for "no such channel" and for "couldn't ask Twitch" - the
// caller treats them the same. Only real answers are cached.
export async function lookupDisplayName(login: string): Promise<string | null> {
  const key = login.toLowerCase();
  const hit = nameCache.get(key);
  if (hit && Date.now() - hit.at < NAME_TTL_MS) return hit.displayName;
  try {
    const data = await gql(`query($login: String!) { user(login: $login) { displayName } }`, { login: key });
    const displayName: string | null = data?.user?.displayName ?? null;
    if (nameCache.size >= NAME_CACHE_MAX) nameCache.clear();
    nameCache.set(key, { displayName, at: Date.now() });
    return displayName;
  } catch (err) {
    console.error("Display-name lookup failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
