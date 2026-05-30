const fs = require('fs');
const path = require('path');

const baseUrl = 'http://localhost:3001';
let token = process.argv[2];

async function request(path, method = 'GET', body = null, headers = {}) {
  const url = `${baseUrl}${path}`;
  const reqHeaders = { ...headers };
  if (body && !(body instanceof String)) {
    reqHeaders['Content-Type'] = 'application/json';
  }
  
  const options = {
    method,
    headers: reqHeaders,
  };
  
  if (body) {
    options.body = typeof body === 'object' ? JSON.stringify(body) : body;
  }
  
  const start = Date.now();
  try {
    const res = await fetch(url, options);
    const duration = Date.now() - start;
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, duration };
  } catch (err) {
    return { status: 500, data: { error: err.message }, duration: Date.now() - start };
  }
}

function printResult(name, res, expectedStatus) {
  const isPass = res.status === expectedStatus;
  const statusColor = isPass ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`${statusColor} ${name.padEnd(35)} | Status: ${res.status} (Expected ${expectedStatus}) | Time: ${res.duration}ms`);
  if (!isPass) {
    console.log(`       Response:`, JSON.stringify(res.data, null, 2));
  }
}

// ─────────────────────────────────────────────────────────────
// Auto-mint a fresh Clerk session token via the Backend API.
// Clerk session tokens are short-lived (~60s by default), so a
// hand-pasted token expires partway through this run. Minting at
// run start gives a full, fresh window every time.
// ─────────────────────────────────────────────────────────────

const CLERK_API = 'https://api.clerk.com/v1';
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

/** Load env vars from common .env locations (no dotenv dependency). First file wins. */
function loadEnv() {
  const candidates = [
    '.env', '.env.local',
    'apps/api/.env', 'apps/api/.env.local',
    'apps/web/.env', 'apps/web/.env.local',
  ];
  const out = {};
  for (const rel of candidates) {
    const p = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const val = m[2].replace(/^["']|["']$/g, '');
      if (out[m[1]] === undefined) out[m[1]] = val;
    }
  }
  // process.env overrides file values
  return new Proxy(out, { get: (t, k) => process.env[k] ?? t[k] });
}

/** Decode a JWT payload without verifying (for display only). */
function decodeJwt(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

async function clerkFetch(secretKey, pathname, options = {}) {
  const res = await fetch(`${CLERK_API}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const msg = data?.errors?.[0]?.message || data?.message || text;
    throw new Error(`Clerk ${options.method || 'GET'} ${pathname} → ${res.status}: ${msg}`);
  }
  return data;
}

/** Create a fresh, freshly-issued session JWT for a real Clerk user. */
async function mintFreshToken(env) {
  const secretKey = env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'CLERK_SECRET_KEY not found in .env / apps/api/.env / apps/web/.env.\n' +
      '       Add it (Clerk Dashboard → API Keys → Secret key, sk_test_…) or pass a token: node dev/test-api.js <jwt>'
    );
  }

  // 1. Pick a user to authenticate as.
  let userId = env.CLERK_TEST_USER_ID;
  if (!userId) {
    const users = await clerkFetch(secretKey, '/users?limit=1&order_by=-created_at');
    const first = Array.isArray(users) ? users[0] : users?.data?.[0];
    if (!first?.id) {
      throw new Error('No Clerk users exist and CLERK_TEST_USER_ID is not set.');
    }
    userId = first.id;
    const email = first.email_addresses?.[0]?.email_address || 'no email';
    console.log(dim(`[mint] Using newest Clerk user: ${userId} (${email})`));
  } else {
    console.log(dim(`[mint] Using CLERK_TEST_USER_ID: ${userId}`));
  }

  // 2. Create an active session for that user.
  const session = await clerkFetch(secretKey, '/sessions', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
  if (!session?.id) throw new Error('Clerk did not return a session id.');

  // 3. Mint a session token. Try to extend its lifetime; fall back to default (~60s).
  const template = env.CLERK_TEST_JWT_TEMPLATE;
  const tokenPath = template
    ? `/sessions/${session.id}/tokens/${template}`
    : `/sessions/${session.id}/tokens`;
  let tokenRes;
  try {
    tokenRes = await clerkFetch(secretKey, tokenPath, {
      method: 'POST',
      body: JSON.stringify({ expires_in_seconds: 600 }),
    });
  } catch {
    tokenRes = await clerkFetch(secretKey, tokenPath, { method: 'POST', body: JSON.stringify({}) });
  }
  if (!tokenRes?.jwt) throw new Error('Clerk did not return a jwt.');
  return tokenRes.jwt;
}

async function run() {
  console.log('==================================================');
  console.log('          DEVTRACK V2 API INTEGRATION TEST        ');
  console.log('==================================================');
  console.log(`Target Base URL: ${baseUrl}`);

  // No token passed → mint a fresh one so the run can't outlive the token.
  if (!token) {
    const env = loadEnv();
    try {
      console.log(dim('[mint] No token argument — minting a fresh one via Clerk Backend API…'));
      token = await mintFreshToken(env);
      console.log(dim('[mint] Fresh token acquired.'));
    } catch (e) {
      console.log(`\x1b[31m[mint] Failed: ${e.message}\x1b[0m`);
    }
  }

  if (token) {
    const payload = decodeJwt(token);
    const secsLeft = payload?.exp ? Math.round(payload.exp - Date.now() / 1000) : null;
    const suffix = secsLeft !== null ? `, expires in ~${secsLeft}s` : '';
    console.log(`Clerk JWT Token: Provided (Length: ${token.length}${suffix})`);
    if (secsLeft !== null && secsLeft < 30) {
      console.log(yellow('⚠ Token has < 30s left — the run will likely fail partway. Re-run with no token arg to auto-mint a fresh one.'));
    }
  } else {
    console.log('Clerk JWT Token: None (Only running public/unauth tests)');
  }
  console.log('--------------------------------------------------\n');

  // 1. Health Check
  const healthRes = await request('/api/v1/health');
  printResult('Health Check (v1)', healthRes, 200);

  // 2. Auth checks
  const noTokenRes = await request('/api/v1/users/me');
  printResult('Test — No Token (should 401)', noTokenRes, 401);

  const badTokenRes = await request('/api/v1/users/me', 'GET', null, {
    'Authorization': 'Bearer this.is.not.valid'
  });
  printResult('Test — Bad Token (should 401)', badTokenRes, 401);

  if (!token) {
    console.log('\n\x1b[33m[INFO] No Clerk JWT token provided. Skipping authenticated tests.\x1b[0m');
    console.log('To run all tests, pass your Clerk JWT token as an argument:');
    console.log('  node dev/test-api.js <clerk-jwt-token>\n');
    return;
  }

  const authHeader = { 'Authorization': `Bearer ${token}` };

  // 3. User & Profile
  console.log('\n--- Running User & Profile Tests ---');
  const meRes = await request('/api/v1/users/me', 'GET', null, authHeader);
  printResult('Get Current User (Me)', meRes, 200);

  const updateProfileRes = await request('/api/v1/users/me/profile', 'PATCH', {
    bio: 'Full-stack developer building cool things',
    location: 'Mumbai, India',
    website: 'https://example.com',
    isPublic: true
  }, authHeader);
  printResult('Update Profile', updateProfileRes, 200);

  // 4. Projects & Tasks Workflow
  console.log('\n--- Running Projects & Tasks Lifecycle ---');
  const listProjectsRes = await request('/api/v1/projects', 'GET', null, authHeader);
  printResult('List Projects', listProjectsRes, 200);

  const createProjRes = await request('/api/v1/projects', 'POST', {
    name: 'DevTrack V2',
    description: 'Engineering growth OS',
    deadline: '2026-08-01T00:00:00Z'
  }, authHeader);
  printResult('Create Project', createProjRes, 201);

  const projectId = createProjRes.data?.id;
  if (!projectId) {
    console.log('\x1b[31m[ERROR] Could not extract projectId from create response. Skipping project dependent tests.\x1b[0m');
    return;
  }
  console.log(`       Created Project ID: ${projectId}`);

  // Create Task under Project
  const createTaskRes = await request(`/api/v1/projects/${projectId}/tasks`, 'POST', {
    title: 'Build GitHub sync pipeline',
    priority: 'HIGH',
    dueDate: '2026-06-15T00:00:00Z'
  }, authHeader);
  printResult('Create Task', createTaskRes, 201);

  // Archive Project (Soft Delete)
  const archiveProjRes = await request(`/api/v1/projects/${projectId}/archive`, 'PATCH', null, authHeader);
  printResult('Archive Project (Soft Delete)', archiveProjRes, 200);

  // 5. GitHub Integration
  console.log('\n--- Running GitHub Endpoint Tests ---');
  const listReposRes = await request('/api/v1/github/repositories', 'GET', null, authHeader);
  printResult('List Repositories', listReposRes, 200);

  const syncStatusRes = await request('/api/v1/github/status', 'GET', null, authHeader);
  printResult('Get Sync Status', syncStatusRes, 200);

  // 6. Analytics, Learning & AI Features
  console.log('\n--- Running Analytics, Learning & AI Tests ---');
  const streakRes = await request('/api/v1/analytics/streak', 'GET', null, authHeader);
  printResult('Get Current Streak', streakRes, 200);

  const summaryRes = await request('/api/v1/analytics/summary', 'GET', null, authHeader);
  printResult('Get Analytics Summary', summaryRes, 200);

  const languagesRes = await request('/api/v1/analytics/languages', 'GET', null, authHeader);
  printResult('Get Language Breakdown', languagesRes, 200);

  // Learning logs
  const createLearningRes = await request('/api/v1/learning', 'POST', {
    topic: 'NestJS EventEmitter2',
    notes: 'Learned how to use wildcard events for domain-driven design',
    source: 'https://docs.nestjs.com/techniques/events',
    tags: ['nestjs', 'backend', 'events'],
    duration: 90
  }, authHeader);
  printResult('Create Learning Log', createLearningRes, 201);

  const listLearningRes = await request('/api/v1/learning', 'GET', null, authHeader);
  printResult('List Learning Logs', listLearningRes, 200);

  // AI complete
  const aiCompleteRes = await request('/api/v1/ai/complete', 'POST', {
    prompt: 'I have made 42 commits in the last 7 days, mostly in TypeScript. Give me one specific, actionable growth insight in 3 sentences.',
    maxTokens: 256
  }, authHeader);
  printResult('AI Complete (Growth Insight)', aiCompleteRes, 201);

  // 7. Intelligence Layer Features
  console.log('\n--- Running Intelligence Layer Tests ---');

  // Developer Graph
  const graphRes = await request('/api/v1/intelligence/graph', 'GET', null, authHeader);
  printResult('Get Developer Graph', graphRes, 200);

  const graphScoreRes = await request('/api/v1/intelligence/graph/score', 'GET', null, authHeader);
  printResult('Get Centrality Score', graphScoreRes, 200);

  // Momentum Signal
  const momentumRes = await request('/api/v1/intelligence/momentum', 'GET', null, authHeader);
  printResult('Get Momentum Signal', momentumRes, 200);

  const burnoutRes = await request('/api/v1/intelligence/momentum/burnout-risk', 'GET', null, authHeader);
  printResult('Get Burnout Risk', burnoutRes, 200);

  // Build Memory
  const createMemoryRes = await request('/api/v1/intelligence/memory', 'POST', {
    title: 'Learned NestJS Guards',
    content: 'Guards execute before route handlers and can deny access based on custom logic.',
    tags: ['nestjs', 'auth', 'backend']
  }, authHeader);
  printResult('Create Build Memory', createMemoryRes, 201);

  const listMemoryRes = await request('/api/v1/intelligence/memory', 'GET', null, authHeader);
  printResult('List Build Memories', listMemoryRes, 200);

  // Skill Confidence
  const inferSkillsRes = await request('/api/v1/intelligence/skills/infer', 'POST', null, authHeader);
  printResult('Infer Skills', inferSkillsRes, 200);

  const skillsRes = await request('/api/v1/intelligence/skills', 'GET', null, authHeader);
  printResult('Get Skills', skillsRes, 200);

  // Developer Reputation
  const computeRepRes = await request('/api/v1/intelligence/reputation/compute', 'POST', null, authHeader);
  printResult('Compute Reputation', computeRepRes, 200);

  const reputationRes = await request('/api/v1/intelligence/reputation', 'GET', null, authHeader);
  printResult('Get Reputation', reputationRes, 200);

  // AI Coach Session
  const coachRes = await request('/api/v1/intelligence/coach', 'POST', {
    prompt: 'How can I improve my commit quality and maintain a healthy work-life balance?'
  }, authHeader);
  printResult('Create Coach Session', coachRes, 201);

  console.log('\n==================================================');
  console.log('                 TEST RUN COMPLETE                ');
  console.log('==================================================\n');
}

run();
