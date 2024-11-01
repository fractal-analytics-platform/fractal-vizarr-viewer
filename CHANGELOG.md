Note: Numbers like (#123) point to closed Pull Requests on the fractal-vizarr-viewer repository.

# 0.2.1

* Updated Vizarr git commit references and removed vizarr.patch (\#42);
* Dropped Node 16 support (\#41);

# 0.2.0

* Supported `AUTHORIZATION_SCHEME="fractal-server-viewer-paths"` (\#35);
* Supported URL encoded characters in path (\#35);
* Deprecated `AUTHORIZATION_SCHEME="allowed-list"` (\#35);
* Removed support for relative paths (\#35);

# 0.1.4

* Fix broken `AUTHORIZATION_SCHEME=user-folders` (\#34);

# 0.1.3

* Updated documentation (\#29);
* Run npm audit fix (\#29);
* Added CI configuration for stable Docker image (\#29);
* Added CI configuration for GitHub release (\#29);

# 0.1.2

* Supported different schemes for authorization (\#25);
* Added first unit tests (\#25);

# 0.1.1

* Added log4js dependency and configured logging (\#22);

# 0.1.0

First official release

* Used newer vizarr version, based on zarrita.js and pnpm (\#15);
* Added Docker setup and configured CI to publish docker images on tags (\#15);
