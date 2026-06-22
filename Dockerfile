FROM node:24

WORKDIR /

RUN mkdir /vizarr
WORKDIR /vizarr

RUN wget https://github.com/BioNGFF/vizarr/releases/download/v1.2.1/dist.tar.gz
RUN tar -xvf dist.tar.gz

RUN mkdir /fractal-data
WORKDIR /fractal-data

ADD src src
ADD package* /fractal-data/
ADD tsconfig.json /fractal-data/

RUN npm ci
RUN npm run build

ENV VIZARR_STATIC_FILES_PATH=/vizarr/sites/app/dist/

CMD ["node", "/fractal-data/dist/app.js"]
