/**
 * Regression tests for the read-only P2 endpoints after P3 authentication.
 * Preserve P2's exact response shapes, data relationships, and error codes.
 * Run after resetting the database with node loadDatabase.js.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it, before } from 'mocha';
import models from '../modelData/photoApp.js';
import {
  request, login, exactFields, validId, validDate, assertErrorMessage,
} from './helpers/http.js';

const modelUsers = models.userListModel();
const userListKeys = ['_id', 'first_name', 'last_name'];
const userDetailKeys = [...userListKeys, 'location', 'description', 'occupation'];
const photoKeys = ['_id', 'user_id', 'file_name', 'date_time', 'comments'];
const commentKeys = ['_id', 'comment', 'date_time', 'user'];

function matchUserByName(users, modelUser) {
  return users.find((user) => user.first_name === modelUser.first_name
    && user.last_name === modelUser.last_name);
}

// Some fixture photos have no comments property; treat that as [].
function expectedPhotosOf(modelUserId) {
  return models.photoOfUserModel(modelUserId)
    .map((photo) => ({ ...photo, comments: photo.comments || [] }));
}

describe('P3 regression: authenticated P2 GET endpoints', function () {
  let cookie;
  let apiUsers;

  before(async function () {
    const auth = await login();
    cookie = auth.cookie;
    const result = await request('/user/list', { cookie });
    assert.equal(result.status, 200, 'GET /user/list must return 200 when logged in');
    assert.ok(Array.isArray(result.data), '/user/list must return an array');
    apiUsers = result.data;
  });

  describe('GET /user/list', function () {
    it('returns exactly the required fields and all seeded users', function () {
      // Registration tests may add users, so require at least the seeded users.
      assert.ok(apiUsers.length >= modelUsers.length, 'Missing seeded users');
      const ids = new Set();
      apiUsers.forEach((user) => {
        exactFields(user, userListKeys, 'user list entry');
        validId(user._id, 'user list entry');
        assert.ok(!ids.has(user._id), 'user ids must be unique');
        ids.add(user._id);
      });
      modelUsers.forEach((modelUser) => {
        assert.ok(matchUserByName(apiUsers, modelUser), `Missing ${modelUser.first_name} ${modelUser.last_name}`);
      });
    });
  });

  describe('GET /user/:id', function () {
    it('returns correct details for every seeded user', async function () {
      await Promise.all(modelUsers.map(async (modelUser) => {
        const user = matchUserByName(apiUsers, modelUser);
        const result = await request(`/user/${user._id}`, { cookie });
        assert.equal(result.status, 200, `User ${user.first_name} must return 200`);
        exactFields(result.data, userDetailKeys, 'user detail');
        assert.equal(result.data._id, user._id);
        ['first_name', 'last_name', 'location', 'description', 'occupation'].forEach((field) => {
          assert.equal(result.data[field], modelUser[field], `Incorrect ${field} for ${user.first_name}`);
        });
      }));
    });

    it('returns 400 with a message for malformed IDs', async function () {
      const result = await request('/user/not-an-objectid', { cookie });
      assert.equal(result.status, 400);
      assertErrorMessage(result, 'malformed user id');
    });

    it('returns 404 with a message for a missing user', async function () {
      const missingId = '000000000000000000000000';
      assert.ok(!apiUsers.some((user) => user._id === missingId));
      const result = await request(`/user/${missingId}`, { cookie });
      assert.equal(result.status, 404);
      assertErrorMessage(result, 'missing user');
    });
  });

  describe('GET /photosOfUser/:id', function () {
    it('returns all photos, all comments, and exactly the required fields', async function () {
      await Promise.all(modelUsers.map(async (modelUser) => {
        const user = matchUserByName(apiUsers, modelUser);
        const result = await request(`/photosOfUser/${user._id}`, { cookie });
        assert.equal(result.status, 200, `Photos for ${user.first_name} must return 200`);
        assert.ok(Array.isArray(result.data), 'Photo response must be an array');
        const expectedPhotos = expectedPhotosOf(modelUser._id);
        assert.equal(result.data.length, expectedPhotos.length, `Wrong photo count for ${user.first_name}`);
        expectedPhotos.forEach((expected) => {
          const matches = result.data.filter((photo) => photo.file_name === expected.file_name);
          assert.equal(matches.length, 1, `Expected one photo called ${expected.file_name}`);
          const actual = matches[0];
          exactFields(actual, photoKeys, 'photo');
          validId(actual._id, 'photo');
          assert.equal(actual.user_id, user._id);
          assert.equal(actual.file_name, expected.file_name);
          validDate(actual.date_time, expected.date_time, 'photo timestamp');
          assert.ok(Array.isArray(actual.comments), 'comments must always be an array');
          // Other tests may add comments, so every seeded comment must be present.
          assert.ok(actual.comments.length >= expected.comments.length, 'Missing comments');
          expected.comments.forEach((expectedComment) => {
            const matchesComment = actual.comments.filter((c) => c.comment === expectedComment.comment);
            assert.equal(matchesComment.length, 1, 'Missing or duplicate comment');
            const comment = matchesComment[0];
            exactFields(comment, commentKeys, 'comment');
            validId(comment._id, 'comment');
            assert.equal(comment.comment, expectedComment.comment);
            validDate(comment.date_time, expectedComment.date_time, 'comment timestamp');
            exactFields(comment.user, userListKeys, 'nested comment user');
            validId(comment.user._id, 'comment user');
            const expectedAuthor = matchUserByName(apiUsers, expectedComment.user);
            assert.ok(expectedAuthor, 'Missing comment author from user list');
            assert.deepEqual(comment.user, expectedAuthor, 'Wrong comment author');
          });
        });
      }));
    });

    it('returns [] for an existing user with no photos', async function () {
      // Register a fresh user instead of relying on the fixture having one.
      const params = {
        login_name: `nophotos_${randomUUID().replaceAll('-', '')}`,
        password: 'an-example-password-123',
        first_name: 'No',
        last_name: 'Photos',
        location: 'Dallas',
        description: 'Account without photos',
        occupation: 'Student',
      };
      const registered = await request('/user', { method: 'POST', body: params });
      assert.equal(registered.status, 201, registered.text);
      const result = await request(`/photosOfUser/${registered.data._id}`, { cookie });
      assert.equal(result.status, 200);
      assert.deepEqual(result.data, []);
    });

    it('returns 400 with a message for malformed IDs', async function () {
      const result = await request('/photosOfUser/not-an-objectid', { cookie });
      assert.equal(result.status, 400);
      assertErrorMessage(result, 'malformed photo user id');
    });

    it('returns 404 with a message for a missing user', async function () {
      const result = await request('/photosOfUser/000000000000000000000000', { cookie });
      assert.equal(result.status, 404);
      assertErrorMessage(result, 'missing photo user');
    });
  });
});
