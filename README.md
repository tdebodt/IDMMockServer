# IDM/ACM Mock Server

Mock OIDC server that mimics ACM/IDM (Vlaams Gebruikersbeheer) for testing the IDP Provider Web Flanders authentication flow.

## Quick Start

### Local development

```bash
npm install
node server.js
```

### Production (Docker Compose + Caddy)

```bash
docker compose up -d
```

This starts the Node app behind a Caddy reverse proxy with automatic HTTPS via Let's Encrypt. The server is available at `https://idmmock.semantical.cc`.

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /.well-known/openid-configuration` | OIDC Discovery document |
| `GET /v1/keys` | JWKS (RSA public key) |
| `GET /v1/auth` | Authorization — shows login form |
| `POST /v1/auth` | Authorization — processes form, issues code |
| `POST /v1/token` | Token exchange — returns signed ID token |
| `GET /v1/userinfo` | Userinfo (minimal mock) |
| `GET /v1/logout` | End session (redirects back) |

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3333` | Server port |
| `ISSUER` | `https://idmmock.semantical.cc` | Issuer URL (must match what your IDP is configured with) |

### Default Claims

Edit `config.js` to change the default user claims pre-populated in the login form:

- `sub` — Subject identifier
- `rrn` — Rijksregisternummer (Belgian national number)
- `given_name`, `family_name` — User name
- `roles` — Array of `wsedienstencheques_rol_3d` values

Claims can also be overridden per-request via the login form.

## Mock Behavior

This is a mock server — it intentionally does **not** enforce security checks:

- `client_id` and `client_secret` are accepted but not validated
- Any `redirect_uri` is accepted without registration
- PKCE (`code_challenge`/`code_verifier`) is checked but mismatches only produce a warning log
- `scope` is ignored — all claims are always returned in the ID token
- Both `response_mode=query` (302 redirect) and `response_mode=form_post` (auto-submitting form) are supported

## Deployment

The production setup uses Docker Compose with two services:

- **app** — Node.js Express server on port 3333 (internal only)
- **caddy** — Reverse proxy with automatic Let's Encrypt HTTPS on ports 80/443

Deployed on a Linode VM at `172.104.245.62` with DNS `idmmock.semantical.cc` pointing to it.

```bash
git clone https://github.com/tdebodt/IDMMockServer.git
cd IDMMockServer
docker compose up -d
```

To rebuild after code changes:

```bash
git pull
docker compose up -d --build
```

## Connecting Your IDP

Point your IDP's OIDC authority to the mock server URL:

```
https://idmmock.semantical.cc/
```

`ClientId` and `ClientSecret` can be any value — the mock does not validate them.

## RSA Keys

A new RSA key pair is generated in memory on each startup. The Microsoft OIDC handler auto-refreshes JWKS after signature validation failure, so restarts are safe.

## Verification

```bash
# Discovery
curl https://idmmock.semantical.cc/.well-known/openid-configuration | jq .

# JWKS
curl https://idmmock.semantical.cc/v1/keys | jq .

# Authorize (open in browser)
open "https://idmmock.semantical.cc/v1/auth?client_id=test&redirect_uri=https://example.com/callback&response_type=code&scope=openid&state=abc&nonce=xyz&response_mode=query"

# Token exchange (after getting a code)
curl -X POST https://idmmock.semantical.cc/v1/token \
  -d "grant_type=authorization_code&code={CODE}&redirect_uri=https://example.com/callback"
```
