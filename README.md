# EOX vote

Best Dressed voting for Monash Association of Coding (MAC) events. Attendees scan a QR code, nominate people with a costume photo, swipe to vote, and the host reveals the top three one place at a time.

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, Postgres and Drizzle ORM.

## How an event runs

Each event is a **session**. The host creates one at `/admin`, marks it as the current session and moves it through five stages:

| Stage | What attendees see |
| --- | --- |
| `pending` | "Waiting for host to start a session" |
| `nominating` | Nominate form (first name, last name, costume photo) and a browsable list of all nominations. Attendees can edit or delete their own nominations. |
| `voting` | A swipe deck: swipe right to vote for an entry, left to skip. After the deck they see who they voted for and can add or remove votes. All entries stay browsable. |
| `results` | Nothing at first. Each time the host presses the reveal button, which names the place it shows ("Reveal 3rd place", "Reveal joint 2nd place"), every attendee sees that place appear (3rd, then 2nd, then 1st). |
| `finished` | The full podium stays visible. |

Rules worth knowing:

- **Timers are informational.** Nominating and voting can have a countdown ("Nominations close in 12:34"). When it reaches zero the stage stays open, unless the session has **auto-advance** on, in which case it moves to the next stage by itself. During nominating and voting, hosts can pause, resume, stop, set, and add or remove time.
- **One vote per entry per device.** A device can vote for many entries but only once for each. This is enforced by a primary key on `(nominee_id, voter_token_hash)`.
- **Ties share a place** (1, 2, 2, 4). Only entries with at least one vote are ranked. Joint places are revealed together.
- Moving a stage back never deletes nominations or votes.

## Local setup

You need Node 24, pnpm 10 and Docker.

```bash
pnpm install
docker compose up -d db
cp .env.example .env
pnpm db:migrate
docker compose exec db psql -U postgres -d eox_vote -c "update app_settings set admin_passcode = 'letmein'"
pnpm dev
```

On Windows PowerShell use `copy .env.example .env` for the third step.

Then open <http://localhost:3000> for the attendee view and <http://localhost:3000/admin> for the host page. Sign in with the passcode you set (`letmein` above).

The compose database is Postgres 17 on host port **5433** (user and password `postgres`, database `eox_vote`, data kept in the `pgdata` volume). `.env.example` already points `DATABASE_URL` at it.

### Host page

The host page is `/admin`. It is deliberately not linked from the attendee pages, so give the address only to hosts. From there hosts manage sessions, stages and timers, nominations (rename, replace photo, delete), the results reveal, and can save a QR code image for each session.

### Admin passcode

The passcode lives in Postgres as `app_settings.admin_passcode` (plain text) and there is no screen to change it. The database administrator sets or changes it with SQL:

```sql
update app_settings set admin_passcode = 'a-new-passcode';
```

For a real event use a long random passcode, for example the output of `openssl rand -base64 24`, not a word or a short code like `letmein`. Wrong attempts are slowed and rate limited, but a guessable passcode still falls to a patient attacker, and it gives full control over every session.

Sign-in cookies are signed with the current passcode, so **changing it signs every host out**. While the passcode is empty, sign-in is refused with a message asking for the database administrator.

### QR codes

Open a session in the host page and use the QR code panel. The address defaults to the site you are on; change it if attendees use a different public address. "Save QR code" downloads a printable PNG (white background, 1280 px wide) with the session name above the code and the address below it. It is drawn in the browser, so there is nothing to configure on the server.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Start the development server (Turbopack). |
| `pnpm build` | Production build. |
| `pnpm start` | Serve the production build. Run `pnpm build` first. |
| `pnpm lint` | Run ESLint. |
| `pnpm test` | Run the unit tests (`node --test`) for the stage engine, ranking and helpers. |
| `pnpm db:generate` | Generate a new SQL migration in `drizzle/` after editing `lib/db/schema.ts`. |
| `pnpm db:migrate` | Apply pending migrations to the database in `DATABASE_URL`. |
| `pnpm db:studio` | Open Drizzle Studio to browse the database. |

Commits follow Conventional Commits; a husky hook enforces it.

## Deployment

The app is a plain Node server plus Postgres. There is no serverless or edge dependency.

1. Provide a Postgres database and set `DATABASE_URL` (for example `postgres://user:password@host:5432/dbname`) in the server environment. Also set `DEVICE_SECRET` to a long random value (`openssl rand -base64 32`); attendee requests fail with a server error until it is set.
2. Install and build: `pnpm install --frozen-lockfile` then `pnpm build`.
3. **Run migrations before starting the new version:** `pnpm db:migrate`. This uses `drizzle-kit`, which is a dev dependency, so run it from an install that includes dev dependencies (for example the build stage).
4. Set the admin passcode with the SQL above.
5. Start with `pnpm start` (use `-p <port>` to choose the port, default 3000), behind a reverse proxy that terminates HTTPS.

Notes:

- **HTTPS is required in production.** The device and admin cookies are marked `secure` when `NODE_ENV` is `production`, so browsers only store and send them over HTTPS (or on `localhost`). Serving `pnpm start` to attendees as `http://192.168.x.x:3000` on a LAN breaks quietly:
  - attendees get a new device identity on every request, so voting and nominating fail with a message asking them to reload, and they cannot see or edit their own entries;
  - admin sign-in appears to succeed but the host is never signed in.

  Put the app behind HTTPS: a reverse proxy with a certificate (nginx, Caddy), or a tunnel such as Cloudflare Tunnel or ngrok, and give attendees the `https://` address.
- **Instances.** The public state endpoint keeps a 1 second in-process cache, and every change on the same instance clears it immediately. A single instance keeps that cache coherent. Multiple instances behind a load balancer work, because all data is in Postgres, but each instance caches separately, so a change made through one instance can take up to a second to show on the others.
- **Never rotate `DEVICE_SECRET` during an event.** It signs the device cookies, so a new value gives every device a new identity: earlier votes no longer count as theirs (they can vote again) and attendees can no longer edit their own nominations.
- **Limit request bodies at the proxy too.** The app rejects uploads over about 5.5 MB, and any upload without a `Content-Length`, before reading them, but a proxy limit stops oversized bodies before they reach Node. With nginx, set `client_max_body_size 6m;`; most proxies' defaults are smaller than a 5 MB photo (nginx's is 1 MB), so set it either way.

## Data model

Postgres, managed by Drizzle migrations in `drizzle/`. Schema: `lib/db/schema.ts`.

- `sessions`: name, stage, default timer minutes for nominating and voting (0 means no timer), auto-advance flag, the running timer end time or the paused remaining time, how many results places are revealed, and start and finish times.
- `nominees`: belongs to a session; first and last name, a hash of the owning device token, and a photo version used to bust the browser cache.
- `nominee_photos`: the image bytes and content type, one row per nominee (kept apart so browsing `nominees` in a database tool stays light).
- `sponsors`: societies that run events with MAC, reused across sessions. A full name (unique, ignoring case), an optional short name such as "CISSA", and a logo version used to bust the browser cache.
- `sponsor_logos`: the logo bytes and content type, one row per sponsor. Logos must be PNG, JPEG or WebP and at most 2 MB; SVG is refused because an SVG served from the app's own origin can run script.
- `votes`: primary key `(nominee_id, voter_token_hash)`. Vote counts are always derived with `count(*)`, never stored.
- `app_settings`: a single row holding the admin passcode and the current session.

Deleting a session removes its nominees, photos and votes.

## Data retention

Nominations are kept for 30 days at most (`NOMINATION_RETENTION_DAYS` in `lib/retention.ts`). Attendees and hosts are told so in the app.

- **What is deleted.** Every nomination submitted more than 30 days ago, with its photo and its votes. The 30 days count from when it was submitted; editing it later does not extend them. Sessions are kept, so a session shows fewer nominees and votes (and a different podium) once its nominations expire.
- **When.** The app server runs the purge itself, once at start and then every hour (`instrumentation.ts`, `lib/nominations-retention.ts`), and logs the count as `[retention] Deleted N nominations older than 30 days.` It is skipped during `next build` and when `DATABASE_URL` is unset. A failure is logged and retried at the next run; it never stops the server.
- **Self-hosting.** The purge only runs while the app server (`pnpm start`) is running, so keep it running continuously. A server that is stopped, or only started for events, deletes nothing until it is next started. With several instances, each runs it; the delete is idempotent, so that is harmless.
- **Purging by hand.** Run this against the database, for example when the server has been down. The photos and votes go with the nominations (`on delete cascade`):

  ```sql
  delete from nominees where created_at < now() - interval '30 days';
  ```

  Public state caches for up to 1 second on each instance, so attendees see the change almost at once.

## Limitations

- **Device identity is a cookie.** Each browser gets a random token signed with `DEVICE_SECRET` (`eox_device`, httpOnly, one year), issued by `/api/me` when the attendee page loads. Voting and nominating require that cookie, so a script cannot vote as a new device on every request, but a script that first calls `/api/me` still can. Only a hash is stored. Clearing cookies, using a private window, or switching browsers makes a new device, which can vote again and cannot edit earlier nominations.
- **A lost cookie means asking a host.** Hosts can edit or delete any nomination regardless of stage.
- **Nominations are capped** at 5 per device and 300 per session. Deleting one of your own frees a slot. Change `lib/nomination-limits.ts` for bigger events.
- **Photos live in Postgres.** Uploads must be JPEG, PNG or WebP and at most 5 MB. The attendee app resizes them in the browser to at most 1600 px on the long edge and re-encodes as JPEG, which also strips EXIF data. Back up the database accordingly.
- The admin passcode is a shared secret with no per-host accounts. Each wrong attempt waits 500 ms, and after 10 wrong attempts in a minute from one address (or 50 from everyone) sign-in is refused for 60 seconds. The counters live in server memory and reset on restart.
