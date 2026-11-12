/**
 * Supplied Mocha HTTP tests for P3 login, sessions, registration, and comments.
 * The two student-authored tests in the P3 spec are NOT provided here:
 *   1) Complete /admin/me lifecycle (401 -> 200 -> 401)
 *   2) Rejection of whitespace-only comments
 *
 * Tests create their own sessions and do not depend on preceding "it" blocks.
 * They assume the database was reset before the full test run.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'mocha';
import {
  request, login, exactFields, validId, assertErrorMessage,
} from './helpers/http.js';

const userKeys = ['_id', 'first_name', 'last_name'];
const authUserRequiredKeys = [...userKeys, 'login_name'];
const commentKeys = ['_id', 'comment', 'date_time', 'user'];

function assertSafeUser(data, context) {
  assert.ok(data && typeof data === 'object' && !Array.isArray(data), `${context}: expected JSON user`);
  authUserRequiredKeys.forEach((key) => {
    assert.equal(typeof data[key], 'string', `${context}: missing ${key}`);
  });
  validId(data._id, context);
  assert.ok(!Object.hasOwn(data, 'password'), `${context}: leaked password`);
  assert.ok(!Object.hasOwn(data, 'password_digest'), `${context}: leaked password_digest`);
  const permitted = new Set([...authUserRequiredKeys, 'location', 'description', 'occupation']);
  assert.ok(Object.keys(data).every((key) => permitted.has(key)), `${context}: unexpected user field`);
}

function validRegistration(loginName) {
  return {
    login_name: loginName,
    password: 'an-example-password-123',
    first_name: 'New',
    last_name: 'Member',
    location: 'Dallas',
    description: 'Sample test account',
    occupation: 'Student',
  };
}

function uniqueLoginName() {
  return `test_${randomUUID().replaceAll('-', '')}`;
}

describe('P3 authentication, registration, and comment endpoints', function () {
  describe('Access control and login errors', function () {
    it('rejects unauthenticated access to all protected endpoints before checking IDs', async function () {
      const paths = ['/user/list', '/user/not-an-objectid', '/photosOfUser/not-an-objectid', '/admin/me'];
      const results = await Promise.all(paths.map((path) => request(path)));
      results.forEach((result, i) => {
        assert.equal(result.status, 401, `${paths[i]} should require a session`);
        assertErrorMessage(result, paths[i]);
      });
      const comment = await request('/commentsOfPhoto/not-an-objectid', {
        method: 'POST', body: { comment: 'Hello' },
      });
      assert.equal(comment.status, 401);
      assertErrorMessage(comment, 'anonymous comment');
    });

    it('rejects missing and invalid login credentials with 400 and an error message', async function () {
      const attempts = [
        { login_name: 'took' },
        { login_name: 'unknown_login', password: 'weak' },
        { login_name: 'took', password: 'incorrect' },
      ];
      const results = await Promise.all(attempts.map((credentials) => request('/admin/login', {
        method: 'POST', body: credentials,
      })));
      results.forEach((result, i) => {
        assert.equal(result.status, 400, `Expected 400 for ${JSON.stringify(attempts[i])}`);
        assertErrorMessage(result, 'invalid login');
      });
    });

    it('rejects logout if there is no logged-in session', async function () {
      const result = await request('/admin/logout', { method: 'POST', body: {} });
      assert.equal(result.status, 400);
      assertErrorMessage(result, 'anonymous logout');
    });
  });

  describe('Session behavior', function () {
    it('logs in with the seeded password and reads current session/user', async function () {
      const auth = await login('took');
      assertSafeUser(auth.data, 'login response');
      assert.equal(auth.data.login_name, 'took');

      const current = await request('/admin/me', { cookie: auth.cookie });
      assert.equal(current.status, 200);
      assertSafeUser(current.data, '/admin/me response');
      assert.equal(current.data._id, auth.data._id);
      assert.equal(current.data.login_name, 'took');

      const list = await request('/user/list', { cookie: auth.cookie });
      assert.equal(list.status, 200);
      assert.ok(Array.isArray(list.data));

      const detail = await request(`/user/${auth.data._id}`, { cookie: auth.cookie });
      assert.equal(detail.status, 200);
      assert.ok(!Object.hasOwn(detail.data, 'login_name'), 'P2 detail must preserve its exact public shape');
      assert.ok(!Object.hasOwn(detail.data, 'password_digest'), 'P2 detail must not leak credentials');
    });

    it('destroys an existing session and clears the cookie on logout', async function () {
      const auth = await login('took');
      const logout = await request('/admin/logout', {
        method: 'POST', body: {}, cookie: auth.cookie,
      });
      assert.equal(logout.status, 200);
      assert.deepEqual(logout.data, { message: 'Logged out' });
      assert.ok(logout.cookie, 'Logout must issue a Set-Cookie header to clear the cookie');

      // Reusing the OLD cookie must not recover the destroyed server session.
      const afterLogout = await request('/user/list', { cookie: auth.cookie });
      assert.equal(afterLogout.status, 401);
      assertErrorMessage(afterLogout, 'access after logout');
    });
  });

  describe('User registration', function () {
    it('creates a new user with 201 and does not automatically authenticate', async function () {
      const params = validRegistration(uniqueLoginName());
      const registered = await request('/user', { method: 'POST', body: params });
      assert.equal(registered.status, 201, registered.text);
      assertSafeUser(registered.data, 'registration response');
      ['login_name', 'first_name', 'last_name'].forEach((field) => {
        assert.equal(registered.data[field], params[field]);
      });

      const me = await request('/admin/me', { cookie: registered.cookie });
      assert.equal(me.status, 401, 'Registration must not automatically log in the new user');
    });

    it('rejects duplicate login names with 400', async function () {
      const result = await request('/user', {
        method: 'POST', body: validRegistration('took'),
      });
      assert.equal(result.status, 400);
      assertErrorMessage(result, 'duplicate login_name');
    });

    it('rejects blank required registration fields', async function () {
      const keys = ['login_name', 'password', 'first_name', 'last_name'];
      const results = await Promise.all(keys.map((key) => {
        const params = validRegistration(uniqueLoginName());
        params[key] = '  \t  ';
        return request('/user', { method: 'POST', body: params });
      }));
      results.forEach((result, i) => {
        assert.equal(result.status, 400, `Blank ${keys[i]} should be rejected`);
        assertErrorMessage(result, `blank ${keys[i]}`);
      });
    });

    it('verifies newly registered passwords using bcrypt-compatible login', async function () {
      const params = validRegistration(uniqueLoginName());
      const registered = await request('/user', { method: 'POST', body: params });
      assert.equal(registered.status, 201);

      const incorrect = await request('/admin/login', {
        method: 'POST', body: { login_name: params.login_name, password: 'not-the-password' },
      });
      assert.equal(incorrect.status, 400);

      const auth = await login(params.login_name, params.password);
      assert.equal(auth.data._id, registered.data._id);
    });
  });

  describe('Adding comments', function () {
    it('returns 400/404 for invalid comment input or photo IDs', async function () {
      const auth = await login('took');
      const photos = await request(`/photosOfUser/${auth.data._id}`, { cookie: auth.cookie });
      assert.equal(photos.status, 200);
      assert.ok(photos.data.length > 0, 'Expected seeded Took photos');
      const photoId = photos.data[0]._id;

      const invalidBodies = await Promise.all([{}, { comment: '' }].map((body) => request(
        `/commentsOfPhoto/${photoId}`,
        { method: 'POST', body, cookie: auth.cookie },
      )));
      invalidBodies.forEach((result) => {
        assert.equal(result.status, 400);
        assertErrorMessage(result, 'invalid comment');
      });

      const malformed = await request('/commentsOfPhoto/not-an-objectid', {
        method: 'POST', body: { comment: 'Hello' }, cookie: auth.cookie,
      });
      assert.equal(malformed.status, 400);
      assertErrorMessage(malformed, 'malformed photo ID');

      const missing = await request('/commentsOfPhoto/000000000000000000000000', {
        method: 'POST', body: { comment: 'Hello' }, cookie: auth.cookie,
      });
      assert.equal(missing.status, 404);
      assertErrorMessage(missing, 'missing photo');
    });

    it('persists a comment and ignores a forged author ID in the request body', async function () {
      const auth = await login('took');
      const [photos, users] = await Promise.all([
        request(`/photosOfUser/${auth.data._id}`, { cookie: auth.cookie }),
        request('/user/list', { cookie: auth.cookie }),
      ]);
      assert.equal(photos.status, 200);
      assert.equal(users.status, 200);
      assert.ok(photos.data.length > 0);
      const other = users.data.find((user) => user._id !== auth.data._id);
      assert.ok(other, 'Expected another seeded user');

      const photoId = photos.data[0]._id;
      const oldCount = photos.data[0].comments.length;
      const commentText = `An integration-test comment ${randomUUID()}`;
      const began = Date.now();
      const added = await request(`/commentsOfPhoto/${photoId}`, {
        method: 'POST',
        body: { comment: commentText, user_id: other._id },
        cookie: auth.cookie,
      });
      const ended = Date.now();
      assert.equal(added.status, 200, added.text);
      exactFields(added.data, commentKeys, 'created comment');
      validId(added.data._id, 'created comment');
      assert.equal(added.data.comment, commentText);
      exactFields(added.data.user, userKeys, 'comment author');
      assert.equal(added.data.user._id, auth.data._id, 'Author must come from session');
      assert.ok(new Date(added.data.date_time).getTime() >= began - 2000, 'Timestamp is too early');
      assert.ok(new Date(added.data.date_time).getTime() <= ended + 2000, 'Timestamp is too late');

      const updated = await request(`/photosOfUser/${auth.data._id}`, { cookie: auth.cookie });
      assert.equal(updated.status, 200);
      const photo = updated.data.find((entry) => entry._id === photoId);
      assert.ok(photo, 'Updated photo not returned');
      assert.equal(photo.comments.length, oldCount + 1);
      const saved = photo.comments.find((entry) => entry._id === added.data._id);
      assert.ok(saved, 'New comment not returned by GET /photosOfUser/:id');
      assert.deepEqual(saved, added.data, 'POST comment must use the same shape as the P2 GET comment');
    });
  });
});
