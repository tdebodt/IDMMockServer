# ACM/IDM Mock Server

Mock OIDC server that mimics ACM/IDM (Vlaams Gebruikersbeheer) for testing.

## Endpoints

| Endpoint | URL |
|---|---|
| Discovery | [`{{ISSUER}}/.well-known/openid-configuration`]({{ISSUER}}/.well-known/openid-configuration) |
| JWKS | [`{{ISSUER}}/v1/keys`]({{ISSUER}}/v1/keys) |
| Authorization | [`{{ISSUER}}/v1/auth`]({{ISSUER}}/v1/auth) |
| Token | `{{ISSUER}}/v1/token` |
| Userinfo | [`{{ISSUER}}/v1/userinfo`]({{ISSUER}}/v1/userinfo) |
| Logout | [`{{ISSUER}}/v1/logout`]({{ISSUER}}/v1/logout) |

## Testing the Auth Flow

### 1. Open the login form

Open this URL in your browser to simulate an authorization request:

```
{{ISSUER}}/v1/auth?client_id=my-client&redirect_uri=https://example.com/callback&response_type=code&scope=openid%20profile%20rrn&state=test123&nonce=nonce456&response_mode=form_post
```

[Open login form with example parameters]({{ISSUER}}/v1/auth?client_id=my-client&redirect_uri=https://example.com/callback&response_type=code&scope=openid%20profile%20rrn&state=test123&nonce=nonce456&response_mode=form_post)

You can edit the claims on the form before signing in. After clicking **Sign In**, you will be redirected to the `redirect_uri` with a `code` and `state` parameter.

### 2. Exchange the code for tokens

```bash
curl -X POST {{ISSUER}}/v1/token \
  -d "grant_type=authorization_code" \
  -d "code=<paste-the-code>" \
  -d "redirect_uri=https://example.com/callback" \
  -d "client_id=my-client"
```

The response contains an `access_token` and a signed `id_token` (RS256 JWT).

### 3. Decode the ID token

Paste the `id_token` value at [jwt.io](https://jwt.io) to inspect the claims.

## Available Claims

| Claim | Description | Default |
|---|---|---|
| `sub` | Subject identifier | `mock-user-001` |
| `rrn` | Rijksregisternummer (Belgian national number) | `85073100145` |
| `given_name` | First name | `Jan` |
| `family_name` | Last name | `Peeters` |
| `wsedienstencheques_rol_3d` | Role claim (one per line in the form) | `DienstenchequesErkendeOnderneming-50042:0456765432` |

All claims are editable per-request via the login form.

## Supported Parameters

| Parameter | Values |
|---|---|
| `response_type` | `code` |
| `response_mode` | `query` (302 redirect) or `form_post` (auto-submitting form) |
| `scope` | Accepted but ignored — all claims are always returned |
| `code_challenge` / `code_challenge_method` | Accepted (S256, plain) — mismatches produce a warning only |

## Mock Behavior

This server intentionally does **not** enforce security checks:

- **client_id** and **client_secret** are accepted but never validated — use any value
- **redirect_uri** is accepted without registration
- **PKCE** mismatches only produce a warning log, never block token issuance
- **Scope** is ignored — the ID token always contains all claims
- A new **RSA key pair** is generated on each restart — JWKS auto-refreshes

## Connecting Your IDP

Point your IDP's OIDC authority to:

```
{{ISSUER}}/
```
