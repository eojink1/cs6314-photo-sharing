# Project 3 — Authentication, Server State, and Mutations (CS 6314, Fall 2026)

P3 extends **your completed P2 Photo Sharing App**. Keep the P2 single-directory structure, your completed P1 React components, P2 backend handlers, and existing API response shapes. P3 adds Express-session authentication, TanStack Query, comments, MVC decomposition, and a Git collaboration workflow. The starter overlay does **not** contain completed solutions.

## Prepare the project

1. Work with your P3 partner. Agree on the completed P2 codebase to use (or carefully merge your completed implementations).
2. Copy the completed `project2/` directory to `project3/`.
3. Open `project3.zip`. Merge the **contents of its inner `project3/` folder** into your copied `project3/` directory. Do not create `project3/project3/`. Replace its `loadDatabase.js`, `README.md`, and `nodemon.json` and the supplied files under `test/`, and add the supplied `.env.example` and `.gitignore`. (If your P2 `.gitignore` had extra entries, merge them in, but never ignore `package-lock.json`.) Keep your completed `webServer.js`, schemas, React components, `lib/api.js`, ESLint configuration, and `public/images/`.
4. Make one shared **private GitHub repository** with your partner. Follow the PR/review workflow in the course specification; use the same repository for P4.
5. Use Node.js `^20.19.0 || >=22.12.0` (prefer a currently supported LTS release) and a running local MongoDB server.

Run from your `project3/` root:

```sh
npm install @tanstack/react-query express-session bcrypt dotenv
```

The P2 `cors` dependency should already be installed. TanStack Query Devtools are optional for debugging. **Keep `package-lock.json`** updated and submit it; do not include `node_modules/`.

## Environment

Copy the included `.env.example` to a **local** `.env` and replace the sample session secret:

```dotenv
MONGO_URL=mongodb://127.0.0.1:27017/project3
SESSION_SECRET=replace-with-a-long-random-local-secret
CLIENT_ORIGIN=http://localhost:3000
PORT=3001
VITE_API_URL=http://localhost:3001
```

Read the environment in the backend using `dotenv` (for example, `import dotenv from 'dotenv';` followed by `dotenv.config();` before accessing `process.env`). The supplied loader already does this. The equivalent `import 'dotenv/config';` also works at runtime, but some `eslint-plugin-import` versions report it as `import/no-unresolved`. Your completed P2 `webServer.js` still needs its P3 environment/session changes: it originally defaulted to a `project2` database, allowed general CORS, and did not configure sessions. **You must update those yourself.** Make sure the server and loader use the same `MONGO_URL`. Do not commit `.env`; the supplied `.gitignore` excludes it.

## Recommended implementation order

**First:** Git/GitHub collaboration; add the two fields to `schema/user.js`; implement password hashing, session configuration, reusable authorization middleware, and the backend authentication routes. Test these endpoints with HTTP clients or the provided integration tests. You can complete this without TanStack Query.

**Then:** Integrate TanStack Query into the frontend. Implement login/registration UI and session restoration using `GET /admin/me`, then comment creation and cache invalidation. Keep local form fields in React state; use the server session as the source of truth for authentication.

### Seed the database

**Update `schema/user.js` before running the loader.** It must contain `login_name` and `password_digest` (see Problem 1). The loader intentionally stops with an explanatory error if those fields are absent, rather than seeding unusable accounts.

```sh
node loadDatabase.js
```

The loader **deletes and reloads** the P3 `User`, `Photo`, and `SchemaInfo` collections, remapping P1 IDs to MongoDB ObjectIds. Do not point `MONGO_URL` at another project's database. Every seeded user has `login_name` set to their lowercase last name and a **bcrypt digest for the password `weak`**. For example, `took` / `weak` works after the backend authentication route is implemented. These intentionally weak demo credentials are only for coursework; real users' passwords must be hashed on registration.

## Run

In separate terminals at `project3/`:

```sh
npm run server    # Express on port 3001
npm run client    # Vite on port 3000
# or run both with: npm run dev
```

The frontend uses the shared `lib/api.js` Axios instance. In P3 you must configure `withCredentials: true` and set credential-aware CORS for `CLIENT_ORIGIN` in Express. Local HTTP can use `sameSite: 'lax'` and `secure: false`; use secure cookies with HTTPS in deployment. Do not assume that the server session can be reconstructed from a React-only `useState` variable.

### API contracts

| HTTP request | Authentication | Successful response |
|---|---|---|
| `POST /admin/login` | Public | `200`, authenticated user object; `400` for failed credentials |
| `POST /user` | Public | `201`, new user object without digest; **no automatic login** |
| `GET /admin/me` | Required | `200`, session user; `401` when logged out |
| `POST /admin/logout` | Session (no `401`) | `200`, `{ "message": "Logged out" }`; **`400`** (not `401`) without login |
| `GET /user/list` | Required | P2 user list shape (otherwise `401`) |
| `GET /user/:id` | Required | P2 user detail shape (otherwise `401`) |
| `GET /photosOfUser/:id` | Required | P2 photos/comments shape (otherwise `401`) |
| `POST /commentsOfPhoto/:photoId` | Required | `200`, created comment with nested user summary |

Authenticated-user-shaped responses include `_id`, `login_name`, `first_name`, and `last_name` and may include `location`, `description`, and `occupation`. Never expose `password` or `password_digest`. The three P2 GET endpoints still return only their original required fields when authenticated. Error responses must be JSON with an `error` or `message` string. See the full P3 specification for detailed validation and status rules.

## Testing

Start MongoDB and the backend; reset the database before running the *complete* suite, since tests create users and comments:

```sh
# In project3/:
node loadDatabase.js
npm run server

# In a second terminal:
cd test
npm install
npm test
```

The supplied Mocha tests cover **P2 read-only regression with authentication** and the P3 authentication, registration, and comment endpoints. They use Node's built-in `fetch` and explicitly pass HTTP session cookies. Test server defaults to `http://127.0.0.1:3001`; override `API_BASE_URL` if needed. The `test/` directory has its own `package.json`. Its `npm install` command generates `test/package-lock.json`; **keep and submit that generated lockfile** for reproducible grading.

**You must author two additional Mocha integration tests:**

1. `/admin/me` returns `401` before login, `200` after login, and `401` again after logout, using the same session cookie.
2. An authenticated POST with a whitespace-only comment returns `400`.

Add your own test files to `test/` and **update the `test/package.json` test script** so `npm test` runs both your files and the supplied tests. Your tests should create their own session/login rather than depend on a previous test. The supplied tests intentionally do not implement these two required test cases. For example:

```json
"test": "mocha serverApiTest.js sessionInputApiTest.js adminMeTest.js commentInputTest.js"
```

The supplied tests import `describe`, `it`, and `before` from `mocha` (`import { describe, it } from 'mocha';`) so ESLint does not need Mocha globals configured; do the same in your test files to keep `npm run lint` clean.

The supplied tests intentionally fail until you have implemented the corresponding functionality. Passing them alone does not demonstrate completion of frontend state management, browser CORS/cookies, security practices, MVC organization, or student-authored testing.

## Final checks

From project root:

```sh
npm run lint
npm run build
```

From `test/`, run `npm test`. Verify in the browser: unauthenticated redirects; login; refresh preserving the session; posting a comment and seeing it without reloading; logout and loss of protected access. Remove or disable React Query Devtools before submission.

Retain root and test `package-lock.json` files. Exclude actual `.env`, `node_modules/`, `test/node_modules/`, and `dist/` from the ZIP. Include `.env.example`, `.gitignore`, `README.md`, the GitHub repository URL in `repo.txt`, and both students' contributions. See the course specification for the full grading and submission requirements.
