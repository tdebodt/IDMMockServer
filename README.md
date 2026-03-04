# IDM/ACM Mock Server

Mock OIDC server that mimics ACM/IDM (Vlaams Gebruikersbeheer) for UAT testing of the Pluxee IDP Provider Web Flanders authentication flow.

## Quick Start

```bash
npm install
node server.js
```

The server starts on `http://localhost:3333` by default.

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
| `ISSUER` | `http://localhost:3333` | Issuer URL (must match what IdentityServer4 is configured with) |

### Default Claims

Edit `config.js` to change the default user claims pre-populated in the login form:

- `sub` — Subject identifier
- `rrn` — Rijksregisternummer (Belgian national number)
- `given_name`, `family_name` — User name
- `roles` — Array of `wsedienstencheques_rol_3d` values

Claims can also be overridden per-request via the login form.

## Connecting to IdentityServer4

Set the IdmOidc authority to point to the mock:

```
IdpConfiguration__ExternalIdentityProviders__IdmOidc__Authority = https://{mock-host}/
```

`ClientId` and `ClientSecret` can remain unchanged — the mock does not validate them.

### HTTPS Requirement

The IdentityServer4 backchannel enforces TLS 1.2. In UAT, serve the mock over HTTPS (Azure App Service with automatic HTTPS, or behind a reverse proxy).

## RSA Keys

A new RSA key pair is generated in memory on each startup. The Microsoft OIDC handler auto-refreshes JWKS after signature validation failure, so restarts are safe.

## Verification

```bash
# Discovery
curl http://localhost:3333/.well-known/openid-configuration | jq .

# JWKS
curl http://localhost:3333/v1/keys | jq .

# Authorize (open in browser)
open "http://localhost:3333/v1/auth?client_id=test&redirect_uri=http://localhost:9999/callback&response_type=code&scope=openid&state=abc&nonce=xyz&response_mode=query"

# Token exchange (after getting a code)
curl -X POST http://localhost:3333/v1/token \
  -d "grant_type=authorization_code&code={CODE}&redirect_uri=http://localhost:9999/callback"
```
