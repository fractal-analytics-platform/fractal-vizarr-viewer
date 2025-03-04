FROM node:20

RUN npm install -g pnpm 

WORKDIR /

RUN git clone https://github.com/hms-dbmi/vizarr.git
WORKDIR /vizarr

RUN git checkout manzt/labels
RUN pnpm install
RUN pnpm run build

RUN mkdir /fractal-vizarr-viewer

WORKDIR /fractal-vizarr-viewer

ADD src src
ADD package* .
ADD tsconfig.json .

RUN npm install
RUN npm run build

ENV VIZARR_STATIC_FILES_PATH=/vizarr/dist

CMD ["node", "/fractal-vizarr-viewer/dist/app.js"]
