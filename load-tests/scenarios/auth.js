import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, jsonHeaders, authHeaders, metrics, recordStatus, recordTimeout, jsonValue } from '../config.js';

export function registerUser(user) {
  const started = Date.now();
  try {
    const res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      name: user.name,
      email: user.email,
      password: user.password,
      passwordConfirm: user.password,
      travelCompanionType: user.travelCompanionType
    }), jsonHeaders());

    metrics.authLatency.add(Date.now() - started);
    recordStatus(res);

    if (res.status === 201) {
      const body = res.json();
      return { token: body.token, user: body.user };
    }

    if (res.status === 400 && String(res.body || '').includes('Email already registered')) {
      return loginUser(user);
    }

    return null;
  } catch (error) {
    recordTimeout(error);
    return null;
  }
}

export function loginUser(user) {
  const started = Date.now();
  try {
    const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password
    }), jsonHeaders());

    metrics.authLatency.add(Date.now() - started);
    recordStatus(res);

    check(res, {
      'login returned 200': (r) => r.status === 200,
      'login returned token': (r) => Boolean(jsonValue(r, 'token'))
    });

    if (res.status !== 200) return null;
    return { token: jsonValue(res, 'token'), user: jsonValue(res, 'user') };
  } catch (error) {
    recordTimeout(error);
    return null;
  }
}

export function getProfile(token) {
  const started = Date.now();
  try {
    const res = http.get(`${BASE_URL}/api/auth/profile`, authHeaders(token));
    metrics.authLatency.add(Date.now() - started);
    recordStatus(res);
    check(res, { 'profile returned 200': (r) => r.status === 200 });
    return res;
  } catch (error) {
    recordTimeout(error);
    return null;
  }
}

export function authFlow(user) {
  const session = loginUser(user) || registerUser(user);
  if (session?.token) {
    getProfile(session.token);
  }
  return session;
}
