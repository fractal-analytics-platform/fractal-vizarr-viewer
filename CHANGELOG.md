Note: Numbers like (#123) point to closed Pull Requests on the `fractal-data` repository.

# Unreleased

- Drop Node 20 support (\#106).
- Log version upon startup (\#113).

# 0.6.2

- Drop references to custom vizarr builds (\#103).
- Handle I/O errors in file read (\#104).

# 0.6.1

- Added support for custom log4js configuration file via `LOG_CONFIG_FILE` environment variable (\#93);
- Exit if `VIZARR_STATIC_FILES_PATH` is set but does not exist (\#95).
- Testing:
  - Harden GitHub Action based on `zizmor` (\#90).
- Add prettier and eslint (\#97).

# 0.6.0

- Added support for S3 paths (\#88);
- Fixed handling of invalid range requests (\#88);

# 0.5.0

- Used BioNGFF/vizarr instead of fractal-analytics-platform/vizarr (\#81);
- Drop support for node v18 (\#85).
- Add support for node v24 (\#85).

# 0.4.3

- Update `User` type (\#74);
- Drop `TestingBasicAuthAuthorizer` and `NoneAuthorizer` (\#75);
- Supported range requests (\#78);

# 0.4.2

- Added workaround to fix labels bug in most recent Chrome versions (\#68);

# 0.4.0

- Separated fractal-data from vizarr, renamed repository to `fractal-data` (\#64);
- Added `BIND_ADDRESS` environment variable, defaulting to `0.0.0.0` for IPv4 binding (\#64);
- Made `VIZARR_STATIC_FILES_PATH` environment variable optional (\#66);

# 0.3.2

- Updated vizarr git commit references to include labels feature;
- Updated dependencies and CI configuration;

# 0.3.1

- Added `/alive` endpoint (\#55);

# 0.3.0

- Retrieved complete list of allowed viewer paths directly from fractal-server: (\#53);
  - removed `user-folders` and `fractal-server-viewer-paths` authorization schemes;
  - added `fractal-server` authorization scheme;
- Supported both tokens and cookies (\#53);

# 0.2.4

- Allowed `project_dir` outside `ZARR_DATA_BASE_PATH` (\#50);

# 0.2.3

- Checked `project_dir` also in `user-folders` authorizer (\#49);

# 0.2.2

- Distinguished handling of 401 Unauthorized and 403 Forbidden responses (\#47);
- Included `user_settings.project_dir` in list of allowed paths (\#47);
- Supported `AUTHORIZATION_SCHEME="testing-basic-auth"` (\#47);

# 0.2.1

- Updated Vizarr git commit references and removed vizarr.patch (\#42);
- Dropped Node 16 support (\#41);

# 0.2.0

- Supported `AUTHORIZATION_SCHEME="fractal-server-viewer-paths"` (\#35);
- Supported URL encoded characters in path (\#35);
- Deprecated `AUTHORIZATION_SCHEME="allowed-list"` (\#35);
- Removed support for relative paths (\#35);

# 0.1.4

- Fix broken `AUTHORIZATION_SCHEME=user-folders` (\#34);

# 0.1.3

- Updated documentation (\#29);
- Run npm audit fix (\#29);
- Added CI configuration for stable Docker image (\#29);
- Added CI configuration for GitHub release (\#29);

# 0.1.2

- Supported different schemes for authorization (\#25);
- Added first unit tests (\#25);

# 0.1.1

- Added log4js dependency and configured logging (\#22);

# 0.1.0

First official release

- Used newer vizarr version, based on zarrita.js and pnpm (\#15);
- Added Docker setup and configured CI to publish docker images on tags (\#15);
