import { describe, it, expect, vi } from 'vitest';
import { getMockedRequest, mockConfig, mockFetchUser } from './authorizer-mocks.js';

vi.mock('../../src/config.js', () => {
  return mockConfig({
    authorizationScheme: 'user-folders'
  });
})

vi.mock('node-fetch', () => {
  return {
    default: function (path: string, { headers }) {
      if (path.endsWith('/auth/current-user/settings/')) {
        const cookie = headers['Cookie'];
        switch (cookie) {
          case 'cookie-user-1':
            return {
              ok: true,
              json: () => ({ slurm_user: 'admin' })
            };
          case 'cookie-user-2':
            return {
              ok: true,
              json: () => ({ slurm_user: 'user2' })
            };
          case 'cookie-user-3':
            return {
              ok: false,
              json: () => ({ detail: 'error' })
            };
          default:
            return {
              ok: false,
              json: () => ({})
            };
        }
      } else {
        return mockFetchUser(path, { headers });
      }
    }
  }
});

import { getAuthorizer } from '../../src/authorizer.js';
const authorizer = getAuthorizer();

describe('User folders authorizer', () => {
  it('Registered user1 with valid absolute path', async () => {
    const request = getMockedRequest('/path/to/zarr/data/admin/foo/bar', 'cookie-user-1');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq('/path/to/zarr/data/admin/foo/bar');
  });

  it('Registered user with path of another user', async () => {
    const request = getMockedRequest('/path/to/zarr/data/admin/foo/bar', 'cookie-user-2');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it('Registered user with invalid path', async () => {
    const request = getMockedRequest('../foo/bar', 'cookie-user-1');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it('/auth/current-user/settings/ returns error', async () => {
    const request = getMockedRequest('/user2/foo/bar', 'cookie-user-3');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });
});
