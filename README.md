# fractal-vizarr-viewer

Prototype to explore serving/viewing zarr data.

This repository contains a simple server application made using [Express](https://expressjs.com/).

The application has 2 endpoints:

* the root (`/`), that serves [vizarr](https://github.com/hms-dbmi/vizarr) static files;
* the endpoint `/data/{path-to-zarr}`, that serves the content of Zarr files checking user authorization.

## How it works

When a user logins to fractal-web, the browser receives a cookie that is generated by fractal-server. The same cookie is sent by the browser to other services on the same domain. The fractal-vizarr-viewer service forwards that cookie back to fractal-server in order to obtain the user details and then decides if the user is authorized to retrieve the requested file or not:

![Fractal Data cookie flow](./fractal-vizarr-viewer-cookie-flow.png)

Currently the authorization check verifies if the user email retrieved from the cookie has been added to the file specified by the `ALLOWED_USERS` environment variable. The file contains the email addresses of authorized users separated by newlines. In the future more complex authorization mechanisms can be set up, also using an additional table in fractal-server to check allowed paths.

### Note about the domain constraint

This cookie-based technique can be used only if fractal-server and fractal-vizarr-viewer are reachable from the same domain (or different subdomains of the same main domain). The single applications can be located on different servers, but a common reverse proxy must be used to expose them on the same domain.

If different subdomains are used for fractal-web and fractal-vizarr-viewer, the fractal-web environment variable `AUTH_COOKIE_DOMAIN` must contain the common parent domain.

Example: if fractal-vizarr-viewer is served on `fractal-vizarr-viewer.mydomain.net` and fractal-web is served on `fractal-web.mydomain.net`, then `AUTH_COOKIE_DOMAIN` must be set to `mydomain.net`.

If we need to serve these services on different domains a different authentication strategy has to be chosen, for example something token-based. That results in a more complicated setup, possibly involving some extra changes on the vizarr code.

## Vizarr setup

In order to display a proper error message related to the missing authorization it is necessary to use a modified version of vizarr.

Clone the [vizarr repo](https://github.com/hms-dbmi/vizarr), checkout to `ca1b1c5693f3cdc355a1e2f2f6b7bb57ba62d4ed` (that is the current reference to the main branch while writing this README) and apply the vizarr.patch contained in this repository.

Run `npm install` to install the dependencies.

Then it is also necessary to modify the [zarr.js](https://github.com/gzuidhof/zarr.js) library used by vizarr, adding the propagation of HTTP errors. Notice that there is an [open pull request](https://github.com/gzuidhof/zarr.js/pull/151) about this.

Open the file `node_modules/zarr/core.mjs` and add the following at the line 3187 (in function `containsItem()` of `HTTPStore` class):

```javascript
if (value.status !== 200 && value.status !== 404) {
  throw new HTTPError(String(value.status));
}
```

Run `npm run build`. This will generate the static files inside the `out` folder. These files will be served by the app contained in this repo.

## Fractal-vizarr-viewer setup

Copy the file `.env.example` to `.env` and define proper values for the environment variables.

```bash
npm install
```

Then run `npm run start` to start the project. The server will start on port 3000.

Login on fractal-web and then on another tab open the following URL to display the example dataset:

http://localhost:3000/?source=http://localhost:3000/data/20200812-CardiomyocyteDifferentiation14-Cycle1.zarr/B/03/0


# Detailed instructions

1. You need to have an active instance of `fractal-server` and an active instance of `fractal-web`.
2. You need to log-in to `fractal-web` from the browser, as the `admin@fractal.xy` user.
3. Get and install the `fractal-vizarr-viewer` application

```bash
git clone https://github.com/fractal-analytics-platform/fractal-vizarr-viewer.git
cd fractal-vizarr-viewer
npm install
```

4. Get/patch/install/patch/build `vizarr`

> Vizarr needs to be built using **pnpm**. To install it you can use `npm install -g pnpm`.

> Note: for simplicity, we assume that `fractal-vizarr-viewer` and `vizarr` are subfolders of the same folder:

```bash
git clone https://github.com/hms-dbmi/vizarr.git
cd vizarr
git checkout 55845ffb658fa04ee2fb649a434c4c16c587233e
git apply ../fractal-vizarr-viewer/vizarr.patch
pnpm install
pnpm run build
```

The output is located in the `dist` folder.

5. Create and fill data folder for `fractal-vizarr-viewer`:

```bash
mkdir zarr-files
cd zarr-files
wget https://zenodo.org/records/10424292/files/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr.zip?download=1
unzip 20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr.zip?download=1
```

6. Set up environment variables for `fractal-vizarr-viewer`.
From the `fractal-vizarr-viewer` main folder, copy `.env.example` into `.env`, and modify `.env` so that it looks like
```
PORT=3000
FRACTAL_SERVER_URL=http://localhost:8000
ZARR_DATA_BASE_PATH=/somewhere/zarr-files/
VIZARR_STATIC_FILES_PATH=/somewhere/vizarr/dist/
BASE_PATH=/vizarr
CACHE_EXPIRATION_TIME=60
```

7. Startup `fractal-vizarr-viewer`
```bash
npm start
```

8. Look at the zarr from the browser, at http://localhost:3000/vizarr/?source=http://localhost:3000/vizarr/data/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr/B/03/0

## Environment variables

* `PORT`: the port where fractal-vizarr-viewer app is served;
* `FRACTAL_SERVER_URL`: the base URL of fractal-server;
* `ZARR_DATA_BASE_PATH`: path to Zarr files served by fractal-vizarr-viewer; the app reads files only in this directory;
* `VIZARR_STATIC_FILES_PATH`: path to the files generated running `npm run build` in vizarr source folder;
* `BASE_PATH`: base path of fractal-vizarr-viewer application;
* `CACHE_EXPIRATION_TIME`: cookie cache TTL in seconds; when user info is retrieved from a cookie calling the current user endpoint on fractal-server the information is cached for the specified amount of seconds, to reduce the number of calls to fractal-server;

## Production setup

Add an Apache configuration to expose fractal-vizarr-viewer service on a given path of the public server. The specified location must have the same value set in fractal-vizarr-viewer `BASE_PATH` environment variable (the default value is `/vizarr`).

```
<Location /vizarr>
    ProxyPass http://127.0.0.1:3000/vizarr
    ProxyPassReverse http://127.0.0.1:3000/vizarr
</Location>
```

Add a systemd unit file in `/etc/systemd/system/fractal-vizarr-viewer.service`:

```
[Unit]
Description=Fractal Vizarr Viewer service
After=syslog.target

[Service]
User=fractal
Environment="PORT=3000"
Environment="FRACTAL_SERVER_URL=https://fractal-server.example.com/"
Environment="ZARR_DATA_BASE_PATH=/path/to/zarr-files"
Environment="VIZARR_STATIC_FILES_PATH=/path/to/vizarr/dist"
Environment="BASE_PATH=/vizarr"
Environment="ALLOWED_USERS=/path/to/allowed-users.txt"
Environment="CACHE_EXPIRATION_TIME=60"
ExecStart=/path/to/node /path/to/fractal-vizarr-viewer/dist/app.js
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Enable the service and start it:

```sh
sudo systemctl enable fractal-vizarr-viewer
sudo systemctl start fractal-vizarr-viewer
```

## Docker setup

Build the docker image:

```sh
docker build . -t fractal-vizarr-viewer
```

The following command can be used to start the docker image for testing:

```sh
docker run --network host \
  -v /path/to/allowed_users.txt:/allowed_users.txt \
  -v /path/to/zarr-files:/zarr-files \
  -e ZARR_DATA_BASE_PATH=/zarr-files \
  -e FRACTAL_SERVER_URL=http://localhost:8000 \
  -e ALLOWED_USERS=/allowed_users.txt \
  fractal-vizarr-viewer
```

For production replace the `--network host` option with a proper published port `-p 3000:3000` and set `FRACTAL_SERVER_URL` as an URL using a public domain.
