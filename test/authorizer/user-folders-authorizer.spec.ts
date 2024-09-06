import { describe, it, expect, vi } from 'vitest';
import { getMockedRequest, mockConfig, mockFetch } from './authorizer-mocks.js';

vi.mock('../../src/config.js', () => {
  return mockConfig({
    authorizationScheme: 'user-folders'
  });
})

vi.mock('node-fetch', () => {
  return {
    default: mockFetch
  };
});

import { getAuthorizer } from '../../src/authorizer.js';
const authorizer = getAuthorizer();

describe('User folders authorizer', () => {
  it('Registered user1 with valid absolute path', async () => {
    const request = getMockedRequest('/path/to/zarr/data/admin/foo/bar', 'cookie-user-1');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq('/path/to/zarr/data/admin/foo/bar');
  });

  it('Registered user2 with valid relative path', async () => {
    const request = getMockedRequest('/user2/foo/bar', 'cookie-user-2');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq('/path/to/zarr/data/user2/foo/bar');
  });

  it('Registered user with path of another user', async () => {
    const request = getMockedRequest('/path/to/zarr/data/admin/foo/bar', 'cookie-user-2');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it('Anonymous user with valid relative path', async () => {
    const request = getMockedRequest('/foo/bar', undefined);
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it('Registered user with invalid path', async () => {
    const request = getMockedRequest('../foo/bar', 'cookie-user-1');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });
});
