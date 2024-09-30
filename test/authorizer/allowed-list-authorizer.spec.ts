import { describe, it, expect, vi } from 'vitest';
import { getMockedRequest, mockConfig, mockFetchUser } from './authorizer-mocks.js';

vi.mock('../../src/config.js', () => {
  return mockConfig({
    authorizationScheme: 'allowed-list',
    allowedUsers: ['admin@example.com']
  });
})

vi.mock('node-fetch', () => {
  return {
    default: mockFetchUser
  };
});

import { getAuthorizer } from '../../src/authorizer.js';
const authorizer = getAuthorizer();

describe('Allowed list authorizer', () => {
  it('Allowed user with valid absolute path', async () => {
    const request = getMockedRequest('/path/to/zarr/data/foo/bar', 'cookie-user-1');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq('/path/to/zarr/data/foo/bar');
  });

  it('Not allowed user with valid path', async () => {
    const request = getMockedRequest('/foo/bar', 'cookie-user-2');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it('Allowed user with invalid path', async () => {
    const request = getMockedRequest('../foo/bar', 'cookie-user-1');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });

  it('Anonymous user with valid path', async () => {
    const request = getMockedRequest('/foo/bar', undefined);
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });
});
