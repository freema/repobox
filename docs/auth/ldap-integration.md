# LDAP Authentication Integration

> **Status:** Planned for Phase 2 - Enterprise Ready

## Overview

LDAP authentication will allow enterprises with Active Directory or LDAP servers to authenticate users without requiring external OAuth providers.

## Environment Variables

The following environment variables are already defined in `.env.example`:

```bash
LDAP_URL=ldap://ldap.company.com
LDAP_BIND_DN=cn=admin,dc=company,dc=com
LDAP_BIND_PASSWORD=xxx
LDAP_SEARCH_BASE=ou=users,dc=company,dc=com
LDAP_USER_FILTER=(uid={{username}})
```

## Planned Implementation

### Provider Pattern

LDAP will be implemented as a NextAuth credentials provider:

```typescript
// Future implementation in src/lib/auth.ts
import Credentials from "next-auth/providers/credentials";

Credentials({
  name: "LDAP",
  credentials: {
    username: { label: "Username", type: "text" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    // 1. Bind to LDAP server using service account
    // 2. Search for user by username
    // 3. Attempt bind with user's credentials
    // 4. Return user profile on success
  },
});
```

### Dependencies

- `ldapjs` or `ldapts` for LDAP client operations
- TLS/SSL support for LDAPS connections

### User Schema Mapping

LDAP attributes will be mapped to Repobox user schema:

| LDAP Attribute | User Field |
|---------------|------------|
| `uid` or `sAMAccountName` | `id` (prefixed with `ldap:`) |
| `mail` | `email` |
| `cn` or `displayName` | `name` |
| `jpegPhoto` or `thumbnailPhoto` | `avatar_url` (base64 encoded) |

### Security Considerations

1. **Connection Security**: Always use LDAPS (port 636) or StartTLS in production
2. **Service Account**: Use a dedicated service account with minimal read permissions
3. **Password Handling**: Never log or store LDAP passwords
4. **Rate Limiting**: Implement rate limiting to prevent brute force attacks
5. **Bind DN Escaping**: Properly escape user input to prevent LDAP injection

### Login Flow

```
1. User enters username + password on /login
2. Server binds to LDAP with service account
3. Server searches for user DN using LDAP_USER_FILTER
4. Server attempts bind with user DN + password
5. On success: create/update user in Redis, create session
6. On failure: return error to login page
```

## Testing

For local development, you can use a test LDAP server:

```bash
# Using Docker
docker run -d --name openldap \
  -p 389:389 \
  -e LDAP_ORGANISATION="Test Org" \
  -e LDAP_DOMAIN="test.local" \
  -e LDAP_ADMIN_PASSWORD="admin" \
  osixia/openldap:latest
```

## References

- [NextAuth Credentials Provider](https://authjs.dev/getting-started/providers/credentials)
- [LDAP Authentication Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/LDAP_Injection_Prevention_Cheat_Sheet.html)
- [tasks/SPEC.MD - Authentication Section](../../tasks/SPEC.MD#authentication)
