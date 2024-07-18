# fractal-data

Prototype to explore serving/viewing zarr data.

This repository contains a simple server application made using [Express](https://expressjs.com/).

The application has 2 endpoints:

* the root (`/`), that serves [vizarr](https://github.com/hms-dbmi/vizarr) static files;
* the endpoint `/data/{path-to-zarr}`, that serves the content of Zarr files checking user authorization (currently only superusers can access the service).

## How it works

When a user logins to fractal-web, the browser receives a cookie that is generated by fractal-server. The same cookie is sent by the browser to other services on the same domain. The fractal-data service forwards that cookie back to fractal-server in order to obtain the username and then decides if the user is authorized to retrieve the requested file or not:

![Fractal Data cookie flow](./fractal-data-cookie-flow.png)

Currently the authorization check verifies if the username specified in the path matches with the username retrieved from the cookie. In the future more complex authorization mechanisms can be set up, also using an additional table in fractal-server to check allowed paths.

### Note about the domain constraint

This cookie-based technique can be used only if fractal-server and fractal-data are reachable from the same domain (or different subdomains of the same main domain). The single applications can be located on different servers, but a common reverse proxy must be used to expose them on the same domain.

If different subdomains are used for fractal-web and fractal-data, the fractal-web environment variable `AUTH_COOKIE_DOMAIN` must contain the common parent domain.

Example: if fractal-data is served on `fractal-data.mydomain.net` and fractal-web is served on `fractal-web.mydomain.net`, then `AUTH_COOKIE_DOMAIN` must be set to `mydomain.net`.

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

## Fractal-data setup

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
3. Get and install the `fractal-data` application

```bash
git clone https://github.com/fractal-analytics-platform/fractal-data.git
cd fractal-data
npm install
```

4. Get/patch/install/patch/build `vizarr`

> Note: for simplicity, we assume that `fractal-data` and `vizarr` are subfolders of the same folder:

```bash
git clone https://github.com/hms-dbmi/vizarr.git
cd vizarr
git checkout ca1b1c5693f3cdc355a1e2f2f6b7bb57ba62d4ed
git apply ../fractal-data/vizarr.patch
npm install
cat node_modules/zarr/core.mjs | sed '3188 i \        if (value.status !== 200 && value.status !== 404) {throw new HTTPError(String(value.status));}' > node_modules/zarr/core.mjs.tmp
mv node_modules/zarr/core.mjs.tmp node_modules/zarr/core.mjs
npm run build
```

> NOTE that we are applying two patches:
> * A git patch to `vizarr` itself, defined in `fractal-data/vizarr.patch`.
> * A patch to `zarr.js` (as in the PR as in https://github.com/gzuidhof/zarr.js/pull/151), which makes lines 3187-3189 of `node_modules/zarr/core.mjs` look like:
> ```js
>         const value = await fetch(url, { ...this.fetchOptions, method });^M
>         if (value.status !== 200 && value.status !== 404) {throw new HTTPError(String(value.status));}
>         return value.status === 200;^M
> ```

5. Create and fill data folder for `fractal-data`:

```bash
mkdir zarr-files
cd zarr-files
wget https://zenodo.org/records/10424292/files/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr.zip?download=1
unzip 20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr.zip?download=1
```

6. Set up environment variables for `fractal-data`.
From the `fractal-data` main folder, copy `.env.example` into `.env`, and modify `.env` so that it looks like
```
FRACTAL_SERVER_URL=http://localhost:8000
ZARR_DATA_BASE_PATH=/somewhere/zarr-files/
VIZARR_STATIC_FILES_PATH=/somewhere/vizarr/out/
BASE_PATH=/vizarr
```

7. Startup `fractal-data`
```bash
npm start
```

8. Look at the zarr from the browser, at http://localhost:3000/vizarr/?source=http://localhost:3000/vizarr/data/20200812-CardiomyocyteDifferentiation14-Cycle1_mip.zarr/B/03/0

## Production setup

Add an Apache configuration to expose fractal-data service on a given path of the public server. The specified location must have the same value set in fractal-data `BASE_PATH` environment variable (the default value is `/vizarr`).

```
<Location /vizarr>
    ProxyPass http://127.0.0.1:3000/vizarr
    ProxyPassReverse http://127.0.0.1:3000/vizarr
</Location>
```
