import type { Request } from 'express';
import { Config } from '../../src/types';

export function mockFetchUser(_: string, { headers }) {
  const cookie = headers['Cookie'];
  switch (cookie) {
    case 'cookie-user-1':
      return {
        ok: true,
        json: () => ({ email: 'admin@example.com' })
      };
    case 'cookie-user-2':
      return {
        ok: true,
        json: () => ({ email: 'user2@example.com' })
      };
    default:
      return {
        ok: false,
        json: () => ({})
      };
  }
}

export function mockConfig(config: Partial<Config>) {
  const getConfig = () => ({
    fractalServerUrl: 'http://localhost:8000',
    zarrDataBasePath: '/path/to/zarr/data',
    authorizationScheme: config.authorizationScheme,
    allowedUsers: config.allowedUsers || []
  });
  return {
    getConfig
  };
}

export function getMockedRequest(path: string, cookie: string | undefined) {
  return {
    path,
    get: () => {
      return cookie;
    }
  } as unknown as Request;
}
