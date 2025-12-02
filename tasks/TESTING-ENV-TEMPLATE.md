# Repobox - Testing Environment Template

> Komentovaný .env template pro testování s code.denik.cz

---

## Jak použít

1. Zkopíruj obsah do `.env` v root složce projektu
2. Vyplň hodnoty označené `<...>`
3. Generuj secrets pomocí příkazů v komentářích

---

## .env Template

```env
# ============================================================
# REPOBOX - TESTING ENVIRONMENT
# ============================================================
# Target: Self-hosted GitLab (code.denik.cz)
# Vyplň hodnoty označené <...>
# ============================================================

# ============================================================
# INFRASTRUCTURE (POVINNÉ)
# ============================================================

# Redis URL - lokální nebo Docker
# Pro Docker: redis://localhost:6379
# Pro remote: redis://user:password@host:port
REDIS_URL=redis://localhost:6379

# Encryption key pro git tokeny (AES-256-GCM)
# Generuj: openssl rand -hex 16
# DŮLEŽITÉ: 32 znaků (16 bytes hex encoded)
ENCRYPTION_KEY=<vygeneruj-openssl-rand-hex-16>

# ============================================================
# NEXTAUTH (POVINNÉ)
# ============================================================

# URL aplikace
NEXTAUTH_URL=http://localhost:3000

# Secret pro JWT signing
# Generuj: openssl rand -base64 32
NEXTAUTH_SECRET=<vygeneruj-openssl-rand-base64-32>

# Session max age v sekundách (7 dní = 604800)
SESSION_MAX_AGE=604800

# ============================================================
# AUTH PROVIDERS (OPTIONAL PRO DEV)
# ============================================================
# Pro rychlé testování bez OAuth můžeš použít AUTH_BYPASS_DEV=true
# Pro produkci vyplň OAuth credentials

# Dev bypass - přeskočí OAuth a vytvoří mock session
# POUZE PRO DEVELOPMENT!
AUTH_BYPASS_DEV=true

# --- GitHub OAuth ---
# https://github.com/settings/developers
# Callback URL: http://localhost:3000/api/auth/callback/github
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=

# --- Google OAuth ---
# https://console.cloud.google.com/apis/credentials
# Callback URL: http://localhost:3000/api/auth/callback/google
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# --- LDAP (pro enterprise) ---
# Zatím neimplementováno, připraveno pro budoucnost
LDAP_URL=
LDAP_BIND_DN=
LDAP_BIND_PASSWORD=
LDAP_SEARCH_BASE=
LDAP_USER_FILTER=

# ============================================================
# GIT PROVIDERS - TESTING VALUES
# ============================================================
# Tyto hodnoty NEJSOU načítány aplikací automaticky!
# Slouží jako reference pro manuální testování.
# Tokeny se přidávají přes UI nebo API.

# GitLab (code.denik.cz)
# Token vytvoříš: Settings → Access Tokens → api scope
TEST_GITLAB_URL=https://code.denik.cz
TEST_GITLAB_USERNAME=<tvoje-gitlab-username>
TEST_GITLAB_TOKEN=<glpat-xxxxx>

# GitHub (optional)
# Token vytvoříš: Settings → Developer settings → Fine-grained PAT
# Permissions: Contents (R/W), Pull requests (R/W), Metadata (R)
TEST_GITHUB_USERNAME=
TEST_GITHUB_TOKEN=

# ============================================================
# AI PROVIDER
# ============================================================

# Anthropic API key pro Claude Code
# https://console.anthropic.com/
ANTHROPIC_API_KEY=<sk-ant-xxxxx>

# ============================================================
# RUNNER
# ============================================================

# Unikátní ID runneru (pro multi-runner setup)
RUNNER_ID=runner-local-1

# Temp directory pro git operace
# Runner zde klonuje repozitáře
TEMP_DIR=/tmp/repobox

# Cleanup po jobu (true/false)
CLEANUP_AFTER_JOB=true

# Job timeout v sekundách (1 hodina = 3600)
JOB_TIMEOUT=3600

# ============================================================
# LOGGING & DEBUG
# ============================================================

# Log level: debug, info, warn, error
LOG_LEVEL=debug

# Node.js debug (Next.js)
# DEBUG=*

# ============================================================
# OPTIONAL FEATURES
# ============================================================

# Rate limiting pro API (requests per minute)
RATE_LIMIT_RPM=60

# Max repos to fetch per provider
MAX_REPOS_PER_PROVIDER=100
```

---

## Generování secrets

```bash
# Encryption key (32 hex chars)
openssl rand -hex 16
# Příklad výstupu: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6

# NextAuth secret (base64)
openssl rand -base64 32
# Příklad výstupu: K7xZ...dlouhý-base64-string

# Alternativa pro NEXTAUTH_SECRET pomocí Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Minimální konfigurace pro Phase 1-3

Pro základní testování stačí:

```env
REDIS_URL=redis://localhost:6379
ENCRYPTION_KEY=<vygeneruj>
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<vygeneruj>
AUTH_BYPASS_DEV=true
LOG_LEVEL=debug
```

---

## Příklad vyplněného .env

```env
# Infrastructure
REDIS_URL=redis://localhost:6379
ENCRYPTION_KEY=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=K7xZmN2pQ8rS9tU0vW1xY2zA3bC4dE5fG6hI7jK8lM9n

# Dev mode
AUTH_BYPASS_DEV=true

# Testing values (reference only)
TEST_GITLAB_URL=https://code.denik.cz
TEST_GITLAB_USERNAME=tomas.grasl
TEST_GITLAB_TOKEN=glpat-abc123def456

# Runner
RUNNER_ID=runner-local-1
TEMP_DIR=/tmp/repobox
CLEANUP_AFTER_JOB=true
JOB_TIMEOUT=3600

# Logging
LOG_LEVEL=debug
```

---

## Checklist před testováním

- [ ] `.env` soubor vytvořen v root složce
- [ ] `ENCRYPTION_KEY` vygenerován (32 hex znaků)
- [ ] `NEXTAUTH_SECRET` vygenerován
- [ ] Redis běží a je dostupný na `REDIS_URL`
- [ ] GitLab PAT vytvořen na code.denik.cz s `api` scope

---

*Poslední aktualizace: December 2024*
