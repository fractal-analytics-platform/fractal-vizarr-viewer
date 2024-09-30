import { describe, it, expect, vi } from 'vitest';
import { getMockedRequest, mockConfig, mockFetchUser } from './authorizer-mocks.js';

vi.mock('../../src/config.js', () => {
  return mockConfig({
    authorizationScheme: 'fractal-server-viewer-paths'
  });
});

vi.mock('node-fetch', () => {
  return {
    default: function (path: string, { headers }) {
      if (path.endsWith('/auth/current-user/viewer-paths/')) {
        const cookie = headers['Cookie'];
        switch (cookie) {
          case 'cookie-user-3':
            return {
              ok: false,
              json: () => ({ detail: 'error' })
            }
          default:
            return {
              ok: true,
              json: () => (['/path/to/zarr/data/foo', '/path/to/zarr/data/bar'])
            }
        }
      } else {
        return mockFetchUser(path, { headers });
      }
    }
  }
});

import { getAuthorizer } from '../../src/authorizer.js';
const authorizer = getAuthorizer();

describe('Viewer paths authorizer', () => {
  it('Allowed user with valid path', async () => {
    const request = getMockedRequest('/path/to/zarr/data/foo/xxx', 'cookie-user-1');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq('/path/to/zarr/data/foo/xxx');
  });

  it('Allowed user with forbidden path', async () => {
    const request = getMockedRequest('/path/to/forbidden', 'cookie-user-1');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it('Allowed user with forbidden relative path', async () => {
    const request = getMockedRequest('/path/to/zarr/data/foo/xxx/../../forbidden', 'cookie-user-1');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it('Anonymous user with valid path', async () => {
    const request = getMockedRequest('/path/to/zarr/data/foo/xxx', undefined);
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it('/auth/current-user/viewer-paths/ returns error', async () => {
    const request = getMockedRequest('/path/to/zarr/data/foo/xxx', 'cookie-user-3');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });
});
