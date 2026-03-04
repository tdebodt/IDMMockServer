const express = require('express');
const { generateKeyPair, exportJWK, SignJWT } = require('jose');
const { v4: uuidv4 } = require('uuid');
const config = require('./config');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- RSA Key Pair (generated at startup) ---
let privateKey, publicKey, publicJwk;

// --- In-memory authorization code store (code → { claims, nonce, codeChallenge, redirectUri, clientId }) ---
const codeStore = new Map();
const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function storeCode(code, data) {
  codeStore.set(code, { ...data, createdAt: Date.now() });
}

function consumeCode(code) {
  const entry = codeStore.get(code);
  if (!entry) return null;
  codeStore.delete(code);
  if (Date.now() - entry.createdAt > CODE_TTL_MS) return null;
  return entry;
}

// Periodic cleanup of expired codes
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of codeStore) {
    if (now - entry.createdAt > CODE_TTL_MS) codeStore.delete(code);
  }
}, 60 * 1000);

// --- 1. Discovery Document ---
app.get('/.well-known/openid-configuration', (req, res) => {
  const iss = config.issuer;
  res.json({
    issuer: iss,
    authorization_endpoint: `${iss}/v1/auth`,
    token_endpoint: `${iss}/v1/token`,
    userinfo_endpoint: `${iss}/v1/userinfo`,
    jwks_uri: `${iss}/v1/keys`,
    end_session_endpoint: `${iss}/v1/logout`,
    response_types_supported: ['code'],
    response_modes_supported: ['query', 'form_post'],
    grant_types_supported: ['authorization_code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'rrn', 'vo', 'doensuuid'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    claims_supported: [
      'sub', 'iss', 'aud', 'exp', 'iat', 'nonce',
      'given_name', 'family_name', 'rrn',
      'wsedienstencheques_rol_3d'
    ],
    code_challenge_methods_supported: ['S256', 'plain']
  });
});

// --- 2. JWKS ---
app.get('/v1/keys', (req, res) => {
  res.json({ keys: [publicJwk] });
});

// --- 3. Authorization — Show Login Form ---
app.get('/v1/auth', (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state, nonce, response_mode, code_challenge, code_challenge_method } = req.query;
  const d = config.defaults;

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>IDM Mock — Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #1a1a2e; display: flex; justify-content: center; padding: 2rem; }
    .container { max-width: 640px; width: 100%; }
    h1 { font-size: 1.4rem; margin-bottom: 1.5rem; color: #0f4c81; }
    .card { background: #fff; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    .card h2 { font-size: 1rem; margin-bottom: 1rem; color: #555; border-bottom: 1px solid #eee; padding-bottom: .5rem; }
    label { display: block; font-size: .85rem; font-weight: 600; margin-bottom: .25rem; color: #333; }
    input[type="text"], textarea { width: 100%; padding: .5rem; border: 1px solid #ccc; border-radius: 4px; font-size: .9rem; margin-bottom: .75rem; font-family: monospace; }
    textarea { min-height: 80px; resize: vertical; }
    .readonly { background: #f8f8f8; color: #666; }
    button { background: #0f4c81; color: #fff; border: none; padding: .65rem 2rem; border-radius: 4px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #0d3d6b; }
    .param-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>ACM/IDM Mock — Login</h1>

    <div class="card">
      <h2>OIDC Request Parameters</h2>
      <div class="param-grid">
        <div><label>client_id</label><input type="text" class="readonly" readonly value="${escHtml(client_id || '')}"></div>
        <div><label>response_type</label><input type="text" class="readonly" readonly value="${escHtml(response_type || '')}"></div>
        <div><label>scope</label><input type="text" class="readonly" readonly value="${escHtml(scope || '')}"></div>
        <div><label>response_mode</label><input type="text" class="readonly" readonly value="${escHtml(response_mode || 'query')}"></div>
        <div><label>state</label><input type="text" class="readonly" readonly value="${escHtml(state || '')}"></div>
        <div><label>nonce</label><input type="text" class="readonly" readonly value="${escHtml(nonce || '')}"></div>
      </div>
      <label>redirect_uri</label><input type="text" class="readonly" readonly value="${escHtml(redirect_uri || '')}">
    </div>

    <form method="POST" action="/v1/auth">
      <input type="hidden" name="client_id" value="${escHtml(client_id || '')}">
      <input type="hidden" name="redirect_uri" value="${escHtml(redirect_uri || '')}">
      <input type="hidden" name="response_type" value="${escHtml(response_type || '')}">
      <input type="hidden" name="scope" value="${escHtml(scope || '')}">
      <input type="hidden" name="state" value="${escHtml(state || '')}">
      <input type="hidden" name="nonce" value="${escHtml(nonce || '')}">
      <input type="hidden" name="response_mode" value="${escHtml(response_mode || 'query')}">
      <input type="hidden" name="code_challenge" value="${escHtml(code_challenge || '')}">
      <input type="hidden" name="code_challenge_method" value="${escHtml(code_challenge_method || '')}">

      <div class="card">
        <h2>User Claims (editable)</h2>
        <label>sub</label>
        <input type="text" name="sub" value="${escHtml(d.sub)}">
        <label>rrn (Rijksregisternummer)</label>
        <input type="text" name="rrn" value="${escHtml(d.rrn)}">
        <label>given_name</label>
        <input type="text" name="given_name" value="${escHtml(d.given_name)}">
        <label>family_name</label>
        <input type="text" name="family_name" value="${escHtml(d.family_name)}">
        <label>wsedienstencheques_rol_3d (one role per line)</label>
        <textarea name="roles">${escHtml(d.roles.join('\n'))}</textarea>
      </div>

      <button type="submit">Sign In</button>
    </form>
  </div>
</body>
</html>`);
});

// --- 4. Authorization — Process Form ---
app.post('/v1/auth', (req, res) => {
  const { client_id, redirect_uri, state, nonce, response_mode, code_challenge, code_challenge_method } = req.body;
  const claims = {
    sub: req.body.sub || config.defaults.sub,
    rrn: req.body.rrn || config.defaults.rrn,
    given_name: req.body.given_name || config.defaults.given_name,
    family_name: req.body.family_name || config.defaults.family_name,
    roles: (req.body.roles || '').split('\n').map(r => r.trim()).filter(Boolean)
  };

  const code = uuidv4();
  storeCode(code, { claims, nonce, codeChallenge: code_challenge, codeChallengeMethod: code_challenge_method, redirectUri: redirect_uri, clientId: client_id });

  console.log(`[auth] Code issued: ${code} for sub=${claims.sub}, redirect=${redirect_uri}`);

  if (response_mode === 'form_post') {
    res.type('html').send(`<!DOCTYPE html>
<html><head><title>Submitting...</title></head>
<body>
  <form id="f" method="POST" action="${escHtml(redirect_uri)}">
    <input type="hidden" name="code" value="${escHtml(code)}">
    <input type="hidden" name="state" value="${escHtml(state || '')}">
    <noscript><button type="submit">Continue</button></noscript>
  </form>
  <script>document.getElementById('f').submit();</script>
</body></html>`);
  } else {
    // response_mode=query (default)
    const url = new URL(redirect_uri);
    url.searchParams.set('code', code);
    if (state) url.searchParams.set('state', state);
    res.redirect(302, url.toString());
  }
});

// --- 5. Token Endpoint ---
app.post('/v1/token', async (req, res) => {
  const { grant_type, code, redirect_uri, code_verifier } = req.body;

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  const entry = consumeCode(code);
  if (!entry) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'Code is invalid or expired' });
  }

  // Redirect URI check
  if (entry.redirectUri && redirect_uri !== entry.redirectUri) {
    console.warn(`[token] redirect_uri mismatch: expected=${entry.redirectUri}, got=${redirect_uri}`);
  }

  // PKCE check (warn only, don't block)
  if (entry.codeChallenge && code_verifier) {
    const crypto = require('crypto');
    let computed;
    if (entry.codeChallengeMethod === 'S256') {
      computed = crypto.createHash('sha256').update(code_verifier).digest('base64url');
    } else {
      computed = code_verifier;
    }
    if (computed !== entry.codeChallenge) {
      console.warn(`[token] PKCE mismatch: expected=${entry.codeChallenge}, computed=${computed}`);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const idToken = await new SignJWT({
    sub: entry.claims.sub,
    rrn: entry.claims.rrn,
    given_name: entry.claims.given_name,
    family_name: entry.claims.family_name,
    wsedienstencheques_rol_3d: entry.claims.roles,
    nonce: entry.nonce || undefined,
    sid: uuidv4()
  })
    .setProtectedHeader({ alg: 'RS256', kid: publicJwk.kid })
    .setIssuer(config.issuer)
    .setAudience(entry.clientId)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  console.log(`[token] ID token issued for sub=${entry.claims.sub}`);

  res.json({
    access_token: `mock-access-token-${uuidv4()}`,
    id_token: idToken,
    token_type: 'Bearer',
    expires_in: 3600
  });
});

// --- Userinfo (minimal) ---
app.get('/v1/userinfo', (req, res) => {
  res.json({ sub: 'mock-user-001', message: 'This is a mock endpoint' });
});

// --- End Session (minimal) ---
app.get('/v1/logout', (req, res) => {
  const postLogoutRedirect = req.query.post_logout_redirect_uri;
  if (postLogoutRedirect) {
    return res.redirect(302, postLogoutRedirect);
  }
  res.send('Logged out (mock)');
});

// --- HTML escaping helper ---
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Startup ---
async function main() {
  const { privateKey: priv, publicKey: pub } = await generateKeyPair('RS256');
  privateKey = priv;
  publicKey = pub;
  publicJwk = await exportJWK(pub);
  publicJwk.kid = uuidv4();
  publicJwk.use = 'sig';
  publicJwk.alg = 'RS256';

  app.listen(config.port, () => {
    console.log(`\nIDM/ACM Mock Server running on ${config.issuer}`);
    console.log(`  Discovery: ${config.issuer}/.well-known/openid-configuration`);
    console.log(`  JWKS:      ${config.issuer}/v1/keys`);
    console.log(`  Authorize: ${config.issuer}/v1/auth`);
    console.log(`  Token:     ${config.issuer}/v1/token`);
    console.log(`\nDefault user: ${config.defaults.sub} (rrn: ${config.defaults.rrn})\n`);
  });
}

main().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
