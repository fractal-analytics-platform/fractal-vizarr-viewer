FROM node:20

WORKDIR /

RUN git clone https://github.com/hms-dbmi/vizarr.git
WORKDIR /vizarr

RUN git checkout eb2b77fed92a08c78c5770144bc7ccf19e9c7658
RUN npx -y pnpm install
RUN npx pnpm run build

RUN mkdir /fractal-vizarr-viewer

WORKDIR /fractal-vizarr-viewer

ADD src src
ADD package* .
ADD tsconfig.json .

RUN npm install
RUN npm run build

ENV VIZARR_STATIC_FILES_PATH=/vizarr/dist

CMD ["node", "/fractal-vizarr-viewer/dist/app.js"]
