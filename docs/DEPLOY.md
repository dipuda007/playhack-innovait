# Deploying PlayHack

Two things are needed: a Postgres database on the internet, and a host for the
app. Total time is about ten minutes, most of it waiting.

---

## 1. Database — Neon

Neon is the pick because it is real Postgres 17 with `btree_gist` available, has
a free tier with no card, and does not put the database to sleep in a way that
would kill a live demo.

1. Go to **neon.tech** and sign in with GitHub.
2. Create a project. Any name; region **AWS ap-southeast-1 (Singapore)** is the
   closest to Guwahati.
3. On the project dashboard, copy the **pooled** connection string. It looks
   like:

   ```
   postgresql://USER:PASSWORD@ep-something-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

   Use the *pooled* one (the host contains `-pooler`). The app opens a
   connection per request, and the pooler is what keeps that cheap.

4. Point the app at it and set the schema up:

   ```bash
   DATABASE_URL="<paste>" npm run db:push
   DATABASE_URL="<paste>" npm run db:seed
   DATABASE_URL="<paste>" npm run invariant
   ```

   `db:push` refuses to finish if `bookings_no_overlap` is not present
   afterwards, so a silent failure here is impossible.

---

## 2. App — Vercel

The repo is already on GitHub. Import it rather than uploading anything.

1. **vercel.com/new** → Import Git Repository → `playhack-innovait`.
2. Framework preset is detected as Next.js. Leave the build settings alone.
3. Add two Environment Variables, for **all** environments:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the pooled Neon string from step 1 |
   | `SESSION_SECRET` | any long random string — generate one below |

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

4. Deploy.

### If git-triggered builds come back `BLOCKED`

A Vercel account created by email signup — its username looks like
`youremail-5774` rather than your GitHub login — has no GitHub identity to
attribute commits to, so every push-triggered build is refused before it starts.
Either link GitHub under **Account Settings → Login Connections**, or deploy
straight from the machine, which skips git attribution entirely:

```bash
npm i -g vercel
vercel login                 # device-code flow, approve in the browser
vercel link --yes --project <project-name>
vercel deploy --prod --yes
```

The build still runs on Vercel; only the source upload is local.

---

## 3. Check the deployment

Open the Vercel URL and confirm, in this order:

- `/` lists twelve facilities with live availability
- `/race` in **naive** mode double-books; in **safe** mode confirms exactly one
- the whole-table sweep on that page reads `0` overlapping pairs
- `/fair` opens a window, draws a winner, and shows the published seed
- `/ops` refuses to close a court that has a student booking

Then run the invariant check against production:

```bash
DATABASE_URL="<neon string>" npm run invariant
```

It exits non-zero on any violation, so it is safe to wire into CI.

---

## Notes

**Reseeding before judging.** `npm run db:seed` truncates and rebuilds the demo
data, which resets the clock-relative bookings so the grid looks alive. Worth
running the morning of the demo, since the seed places bookings relative to
*now*.

**The race demo writes to the database.** `/race` has a **Reset demo data**
button that clears everything a run left behind. Use it between runs so the
story can be retold cleanly.

**Serverless and connection limits.** `maxDuration` is raised to 60s on the race
and lottery routes because a 200-way burst plus the invariant sweep exceeds the
default budget. If Vercel's free tier caps that lower, drop the burst slider to
100 — the result is identical, and the point is not the size of the number.

**Region matters more than anything else here.** `vercel.json` pins functions to
`sin1` (Singapore) to sit next to the Neon database. Every request in this app is
database-bound, so on the default `iad1` (Washington DC) each round trip costs
~250 ms and a 200-way race exceeds the function timeout. Co-located, the same
burst finishes in ~1.2 s. If the database moves, move this with it — check with:

```bash
curl -sI https://<your-app>.vercel.app/race | grep -i x-vercel-id
# x-vercel-id: bom1::sin1::...   edge::compute
```

**Nothing here needs a background worker.** Waitlist promotion happens inside
the cancellation transaction, and the lottery draw happens on request. There is
no cron to configure and nothing to keep warm.
