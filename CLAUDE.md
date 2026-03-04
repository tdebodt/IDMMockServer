# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Mock OIDC server that mimics ACM/IDM (Vlaams Gebruikersbeheer) for UAT testing of the Pluxee IDP Provider Web Flanders authentication flow. It implements a minimal OpenID Connect authorization code flow so IdentityServer4 can authenticate against it instead of the real ACM/IDM.

## Commands

```bash
npm install        # install dependencies
npm start          # start server (or: node server.js)
```

Server runs on `http://localhost:3333` by default. Configure via `PORT` and `ISSUER` env vars.

## Architecture

This is a single-file Express server (`server.js`) with a separate config module (`config.js`).

**server.js** — All OIDC endpoints in one file:
- Discovery (`/.well-known/openid-configuration`) — returns OIDC metadata
- JWKS (`/v1/keys`) — exposes the RSA public key generated at startup
- Authorization (`GET/POST /v1/auth`) — renders an HTML login form with editable claims, issues authorization codes
- Token (`POST /v1/token`) — exchanges codes for signed RS256 ID tokens (with PKCE support, warn-only)
- Userinfo and Logout — minimal stubs

Authorization codes are stored in an in-memory `Map` with 5-minute TTL. A new RSA key pair is generated on each startup (no persistence needed).

**config.js** — Default port, issuer URL, and pre-populated user claims (sub, rrn, given_name, family_name, roles). Edit this to change the default form values.

## Key Domain Concepts

- **rrn**: Rijksregisternummer (Belgian national number) — a core claim
- **wsedienstencheques_rol_3d**: Role claim used by the Dienstencheques application
- Claims are editable per-request via the login form; the mock does not validate `client_id` or `client_secret`
- The consuming IdentityServer4 is pointed at this mock via `IdpConfiguration__ExternalIdentityProviders__IdmOidc__Authority`

## Dependencies

Only three: `express`, `jose` (JWT signing/JWKS), `uuid` (authorization codes and key IDs). No build step, no tests, no linter configured.
