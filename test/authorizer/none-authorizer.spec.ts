import { describe, it, expect, vi } from 'vitest';
import { getMockedRequest, mockConfig, mockFetch } from './authorizer-mocks.js';

vi.mock('../../src/config.js', () => {
  return mockConfig({
    authorizationScheme: 'none'
  });
})

vi.mock('node-fetch', () => {
  return {
    default: mockFetch
  };
});

import { getAuthorizer } from '../../src/authorizer.js';
const authorizer = getAuthorizer();

describe('None authorizer', () => {
  it('Anonymous user with valid relative path', async () => {
    const request = getMockedRequest('/foo/bar', undefined);
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq('/path/to/zarr/data/foo/bar');
  });

  it('Registered user with valid absolute path', async () => {
    const request = getMockedRequest('/path/to/zarr/data/foo/bar', 'cookie-user-1');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq('/path/to/zarr/data/foo/bar');
  });

  it('Allowed user with invalid path', async () => {
    const request = getMockedRequest('../foo/bar', 'cookie-user-1');
    const path = await authorizer.getAuthorizedPath(request);
    expect(path).eq(undefined);
  });
});
