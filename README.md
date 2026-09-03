# Nakconel Examinations — Phase 1

Phase 1 scope: student registration, student login (email or Student ID),
admin login (API only — no admin screens yet), server-side sessions, and the
Student ID generator (`NAK-2026-001`, etc.). Later phases build on this
without breaking it.

Everything below can be done from a phone browser — no computer or command
line required.

## 1. Create the database (Neon)

1. Go to neon.tech and create a free project.
2. In your project's dashboard, open **Connection Details**.
3. You need two connection strings:
   - **Pooled connection** (usually the default one shown) → this is `DATABASE_URL`
   - **Direct connection** (toggle "Pooled connection" off, or look for
     "Direct connection") → this is `DIRECT_URL`
4. Keep this tab open — you'll paste both into Vercel shortly.

## 2. Get the code into GitHub

Tell me your GitHub username (and, when I ask, a **personal access token**
with `repo` access — GitHub → Settings → Developer settings → Personal
access tokens → generate one, works fine from a phone browser). I'll push
this project directly into a new repo for you so you don't have to upload
anything by hand.

(If you'd rather do it yourself: download the project as a zip, create a
new empty repo on github.com, and use its "upload files" page to add the
contents.)

## 3. Import into Vercel

1. Go to vercel.com, sign in, and choose **Add New → Project**.
2. Connect your GitHub account if you haven't, then select the repo.
3. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the pooled Neon connection string |
   | `DIRECT_URL` | the direct Neon connection string |
   | `AUTH_SECRET` | any long random string (48+ characters) |
   | `SETUP_SECRET` | any random string you make up |
   | `SEED_ADMIN_EMAIL` | the email for your first admin login (optional but recommended) |
   | `SEED_ADMIN_PASSWORD` | a strong password for that admin (optional but recommended) |

4. Deploy. The build automatically creates all the database tables — you
   don't need to run any migration command yourself.

## 4. Create the courses (one-time)

Once the deploy finishes, visit this URL once in any browser (swap in your
real domain and the `SETUP_SECRET` you chose):

```
https://YOUR-APP.vercel.app/api/setup?key=YOUR_SETUP_SECRET
```

This creates the 6 courses and your first admin account. It's safe to
revisit this URL later — it won't create duplicates.

## 5. Try it

- `https://YOUR-APP.vercel.app/register` — register a test student
- `https://YOUR-APP.vercel.app/login` — log in with either the email or the
  Student ID you were given, plus the password

## What's included so far

**Phase 1 — Authentication & registration**
- Student registration (name, email, phone, age, gender, address, social
  media, password, course) with server-side validation
- Automatic, race-safe Student ID generation (`NAK-2026-001`, `NAK-2026-002`, …)
- Student login by email **or** Student ID
- Admin login (backend only — admin screens are Phase 3)
- Passwords hashed with bcrypt, sessions as signed HTTP-only cookies (JWT),
  never trusting client-supplied course IDs or roles
- Basic rate limiting on register/login endpoints
- An audit log table recording registrations and logins

**Phase 2 — Student dashboard & course display**
- Real exam data model (`Exam`) with schedule, publish state, question
  count, duration, and randomization settings — ready for the admin screens
  and exam engine to build on
- Dashboard shows the student's enrolled course and its Test 1 / Test 2 /
  Final Test rows, each with a status computed **only** from the schedule
  and publish flag — never shown as "Ongoing" just because a row exists
- `/api/setup` now also creates default (unpublished) Test 1 / Test 2 /
  Final Test rows for every course — safe to re-run, won't duplicate

**Phase 3 — Admin dashboard & student management**
- Admin login screen at `/admin/login` (also linked from the homepage footer)
- Admin overview at `/admin` — total students, active courses, exams by
  status (upcoming/ongoing/closed), recent registrations
- Student management at `/admin/students` — search by name/email/Student
  ID/phone, filter by course and status, view full registration detail per
  student, activate/disable accounts (a disabled student is blocked at login)
- Export to Excel (`.xlsx`) with all registration fields, one click from the
  students list
- Every admin action re-verifies the session AND the admin's live status in
  the database — a disabled admin loses access immediately, not just when
  their token expires. All destructive actions are logged to the audit trail.
- Sidebar shows the remaining sections (Courses, Exams, Question Bank,
  Results, Live Monitoring, Suspicious Activity, Settings) as visibly
  disabled placeholders for the phases ahead

**Phase 4 — Course & exam management**
- `/admin/courses` — add courses, rename them, activate/deactivate (a
  deactivated course is hidden from new registrations but existing students
  stay enrolled)
- `/admin/exams` — every exam across every course, filterable by course, each
  showing its live status
- Create/edit exams with the full config from the spec: question count,
  duration, passing score, start/end date & time, instructions, shuffle
  questions, shuffle answer options, display order
- A real **Exam Validation** checklist on each exam's page, matching the
  spec's publishing workflow — publish is blocked (422) until every check
  passes, including a "valid questions available in the Question Bank"
  check. That check is always 0-of-N right now, on purpose: the question
  bank doesn't exist yet (Phase 5), so no exam can be truly ready to publish
  until then — this deliberately refuses to fake that check rather than
  let something un-publishable-in-spirit go live
- Editing a published exam automatically unpublishes it, so a schedule or
  question-count change always gets re-validated before going live again

## What's intentionally NOT here yet

Course/exam management (admin can't yet schedule or publish exams — that's
Phase 4), the question bank, the exam-taking interface, randomization in
action, scoring, exam attempts/results, camera/identity monitoring, live
monitoring, and the suspicious-activity center. The schema is structured so
those attach without reworking what's here.

## Local development (optional, if you ever use a computer)

```
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```
