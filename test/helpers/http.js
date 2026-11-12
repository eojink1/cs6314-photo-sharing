/**
 * Small HTTP helpers for the supplied P3 integration tests.
 * Node's built-in fetch does not maintain a cookie jar, so tests explicitly
 * return and resend the Express session cookie.
 */
import assert from 'node:assert/strict';

const baseUrl = (process.env.API_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

export const SEEDED_PASSWORD = 'weak';
export const mongoIdPattern = /^[a-f\d]{24}$/i;

export async function request(path, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  const setCookie = response.headers.get('set-cookie');
  return {
    status: response.status,
    data,
    text,
    // Send only the name=value part back as a Cookie request header.
    cookie: setCookie ? setCookie.split(';')[0] : null,
  };
}

export async function login(loginName = 'took', password = SEEDED_PASSWORD) {
  const result = await request('/admin/login', {
    method: 'POST',
    body: { login_name: loginName, password },
  });
  assert.equal(result.status, 200, `Login for ${loginName}: ${result.text}`);
  assert.ok(result.cookie, 'Successful login must issue a session cookie');
  return result;
}

export function assertErrorMessage(result, context) {
  const message = result.data?.error || result.data?.message;
  assert.ok(
    typeof message === 'string' && message.trim().length > 0,
    `${context}: expected JSON with a descriptive error message; got ${result.text}`,
  );
}

export function exactFields(value, fields, context) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${context} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...fields].sort(), `${context} has missing/extra fields`);
}

export function validId(id, context) {
  assert.match(id, mongoIdPattern, `${context}: expected a MongoDB ObjectId string`);
}

export function validDate(actual, expected, context) {
  assert.ok(Number.isFinite(new Date(actual).getTime()), `${context}: date must be valid`);
  assert.equal(new Date(actual).getTime(), new Date(expected).getTime(), `${context}: date differs`);
}
