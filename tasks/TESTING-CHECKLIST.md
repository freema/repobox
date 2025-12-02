# Repobox - Testing Checklist

> Manuální testovací checklist pro fáze 1-5
> Target: Self-hosted GitLab (code.denik.cz)

---

## Prerequisites

Před začátkem testování připrav:

### Lokální prostředí
- [ ] Node.js 20+ (`node -v`)
- [ ] Go 1.22+ (`go version`)
- [ ] pnpm 9+ (`pnpm -v`)
- [ ] Docker + Docker Compose (`docker compose version`)
- [ ] Git (`git --version`)

### GitLab PAT (code.denik.cz)
1. Přihlaš se na https://code.denik.cz
2. Settings → Access Tokens → Add new token
3. Scopes: **api** (zahrnuje read/write repos, create MRs)
4. Zkopíruj token (`glpat-xxxxx`)

```
URL: https://code.denik.cz
Username: <tvoje_gitlab_username>
Token: glpat-xxxxx
```

### Test repository
- [ ] Vytvoř nebo vyber testovací repo na code.denik.cz
- [ ] Zapamatuj si full path (např. `group/test-repo`)

### Lokální služby
- [ ] Redis běží (Docker nebo nativně)
- [ ] `.env` soubor vytvořen z `.env.example`

---

## Phase 1 - Project Foundation

### 1.1 Monorepo setup
```bash
# Z root složky projektu
pnpm install
```
- [ ] Instalace proběhla bez chyb
- [ ] `node_modules` existuje v rootu i v `apps/web`

### 1.2 Web app (Next.js)
```bash
pnpm dev --filter apps/web
```
- [ ] Server běží na http://localhost:3000
- [ ] Placeholder stránka se zobrazuje

### 1.3 Go runner
```bash
cd apps/runner
make build
# nebo: go build -o bin/runner ./cmd/runner
```
- [ ] Binárka vytvořena v `apps/runner/bin/runner`
- [ ] `./bin/runner --help` (nebo podobný) zobrazí usage

### 1.4 Docker (Redis)
```bash
docker compose -f docker/docker-compose.dev.yml up -d
```
- [ ] Redis container běží (`docker ps | grep redis`)
- [ ] Redis odpovídá:
```bash
redis-cli ping
# Očekáváno: PONG
```

### 1.5 Verifikace struktury
```bash
ls -la apps/
# Měl by obsahovat: web/ runner/

ls -la packages/
# Měl by obsahovat: types/
```
- [ ] Struktura odpovídá plánu

---

## Phase 2 - Authentication

### 2.1 Login page
- [ ] http://localhost:3000/login se renderuje
- [ ] Zobrazují se tlačítka pro providery (GitHub, Google)

### 2.2 Mock session (dev mode)
Pro rychlé testování bez OAuth:
```bash
# V .env nastav:
AUTH_BYPASS_DEV=true
```
- [ ] Po restartu můžeš přistoupit na dashboard bez loginu

### 2.3 Protected routes
```bash
# Bez session cookie:
curl -I http://localhost:3000/dashboard
```
- [ ] Vrací redirect (302) na `/login`

### 2.4 Session storage (s reálným OAuth)
```bash
# Po přihlášení zkontroluj Redis:
redis-cli KEYS "session:*"
```
- [ ] Session klíč existuje
- [ ] `redis-cli HGETALL "session:<id>"` obsahuje user_id

---

## Phase 3 - Git Providers (HLAVNÍ FOCUS)

### 3.1 Přidání GitLab providera

**Předpoklady:**
- Máš session cookie (z OAuth nebo mock)
- Máš GitLab PAT z Prerequisites

```bash
# Získej session cookie z browser DevTools nebo:
export SESSION_COOKIE="next-auth.session-token=xxx"

curl -X POST http://localhost:3000/api/git-providers \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "type": "gitlab",
    "url": "https://code.denik.cz",
    "token": "glpat-xxxxx",
    "username": "tomas.grasl"
  }'
```

**Očekávaná odpověď:**
```json
{
  "id": "provider_abc123",
  "type": "gitlab",
  "url": "https://code.denik.cz",
  "username": "tomas.grasl",
  "verified": false,
  "createdAt": "2024-..."
}
```

- [ ] API vrací provider ID
- [ ] `verified: false` (ještě neověřeno)

### 3.2 Verifikace tokenu

```bash
curl -X POST http://localhost:3000/api/git-providers/provider_abc123/verify \
  -H "Cookie: $SESSION_COOKIE"
```

**Očekávaná odpověď:**
```json
{
  "verified": true,
  "repos_count": 15,
  "username": "tomas.grasl"
}
```

- [ ] `verified: true`
- [ ] `repos_count` odpovídá počtu repozitářů

### 3.3 Token encryption test

```bash
# Zkontroluj že token NENÍ v plain textu:
redis-cli HGET "git_provider:<user_id>:provider_abc123" token
```

- [ ] Výstup začíná `encrypted:` nebo je base64 blob
- [ ] Token NENÍ čitelný jako `glpat-xxxxx`

### 3.4 Seznam repozitářů

```bash
curl http://localhost:3000/api/repositories \
  -H "Cookie: $SESSION_COOKIE"
```

**Očekávaná odpověď:**
```json
{
  "repositories": [
    {
      "id": "123",
      "name": "test-repo",
      "fullPath": "group/test-repo",
      "url": "https://code.denik.cz/group/test-repo",
      "provider": "gitlab",
      "providerId": "provider_abc123"
    }
  ]
}
```

- [ ] Vrací repozitáře z code.denik.cz
- [ ] Každý repo má `id`, `name`, `url`

### 3.5 Seznam providerů

```bash
curl http://localhost:3000/api/git-providers \
  -H "Cookie: $SESSION_COOKIE"
```

- [ ] Vrací seznam všech přidaných providerů
- [ ] GitLab provider je v seznamu s `verified: true`

### 3.6 Setup UI

- [ ] http://localhost:3000/setup zobrazuje formulář
- [ ] Po přidání tokenu se zobrazí v seznamu
- [ ] Verification status je viditelný (zelená/červená)

### 3.7 Smazání providera

```bash
curl -X DELETE http://localhost:3000/api/git-providers/provider_abc123 \
  -H "Cookie: $SESSION_COOKIE"
```

- [ ] Vrací `{ "success": true }`
- [ ] Provider zmizí ze seznamu
- [ ] Redis klíč smazán:
```bash
redis-cli EXISTS "git_provider:<user_id>:provider_abc123"
# Očekáváno: (integer) 0
```

---

## Phase 4 - Redis Data Layer

### 4.1 User repository

```bash
# Po přihlášení zkontroluj user hash:
redis-cli HGETALL "user:<user_id>"
```

- [ ] Obsahuje: `id`, `email`, `name`, `auth_provider`, `created_at`

### 4.2 Git provider repository

```bash
# Index všech providerů uživatele:
redis-cli SMEMBERS "git_providers:<user_id>"

# Detail providera:
redis-cli HGETALL "git_provider:<user_id>:<provider_id>"
```

- [ ] Index obsahuje provider IDs
- [ ] Hash obsahuje type, url, encrypted token, verified status

### 4.3 Job repository (připrava pro Phase 6+)

```bash
# Vytvoř testovací job (pokud API existuje):
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "providerId": "provider_abc123",
    "repoUrl": "https://code.denik.cz/group/test-repo",
    "prompt": "Test prompt",
    "environment": "default"
  }'
```

- [ ] Job vytvořen s `status: pending`
- [ ] Job existuje v Redis:
```bash
redis-cli HGETALL "job:<job_id>"
```

### 4.4 Redis Streams

```bash
# Zkontroluj job stream:
redis-cli XINFO STREAM jobs:stream
# Očekáváno: informace o streamu

# Přečti pending joby:
redis-cli XRANGE jobs:stream - +
```

- [ ] Stream existuje
- [ ] Nové joby se zapisují do streamu

---

## Phase 5 - Dashboard UI

### 5.1 Dashboard layout

- [ ] http://localhost:3000/dashboard se zobrazuje
- [ ] Header s user info/avatar
- [ ] Sidebar s sessions

### 5.2 Repository selector

- [ ] Dropdown načítá repozitáře z API
- [ ] Po výběru se zobrazí název repo
- [ ] Funguje vyhledávání/filtrování (pokud implementováno)

### 5.3 Environment selector

- [ ] Dropdown s options: Default, PHP, Python, etc.
- [ ] Výběr se ukládá pro job creation

### 5.4 Prompt input

- [ ] Textarea pro zadání promptu
- [ ] Validace prázdného vstupu
- [ ] Send tlačítko disabled při prázdném inputu

### 5.5 Sessions list

- [ ] Zobrazuje historii jobů
- [ ] Status badges (pending, running, success, failed)
- [ ] Kliknutí otevírá detail

### 5.6 Settings page

- [ ] http://localhost:3000/settings
- [ ] Seznam git providerů
- [ ] Možnost přidat/odebrat provider

---

## Troubleshooting

### Redis connection refused
```bash
# Zkontroluj že Redis běží:
docker ps | grep redis

# Restart:
docker compose -f docker/docker-compose.dev.yml restart redis
```

### GitLab API 401 Unauthorized
- Token expiroval nebo nemá správné scopes
- Vygeneruj nový token s `api` scope

### Session not found
- Cookie expirovala
- Zkontroluj NEXTAUTH_SECRET v .env
- Přihlaš se znovu

### Encryption key error
```bash
# Vygeneruj nový 32-byte klíč:
openssl rand -hex 16
# Přidej do .env jako ENCRYPTION_KEY
```

---

## Quick Reference - Redis Keys

| Pattern | Popis |
|---------|-------|
| `user:{id}` | User hash |
| `session:{cookie}` | Session hash |
| `git_provider:{user_id}:{provider_id}` | Provider hash |
| `git_providers:{user_id}` | Set of provider IDs |
| `job:{id}` | Job hash |
| `jobs:user:{user_id}` | Sorted set of job IDs |
| `jobs:stream` | Job queue stream |
| `job:{id}:output` | Job output stream |

---

## Quick Reference - API Endpoints

| Method | Endpoint | Popis |
|--------|----------|-------|
| POST | `/api/git-providers` | Přidat provider |
| GET | `/api/git-providers` | Seznam providerů |
| POST | `/api/git-providers/[id]/verify` | Verifikace tokenu |
| DELETE | `/api/git-providers/[id]` | Smazat provider |
| GET | `/api/repositories` | Seznam repozitářů |
| POST | `/api/jobs` | Vytvořit job |
| GET | `/api/jobs` | Seznam jobů |
| GET | `/api/jobs/[id]` | Detail jobu |

---

*Poslední aktualizace: December 2024*
