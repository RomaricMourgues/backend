FROM node:16-alpine

WORKDIR /usr/app
COPY package.json .
RUN yarn install --quiet
COPY src src
COPY tests tests
COPY config/default.json config/default.json
COPY babel.config.js babel.config.js
COPY tsconfig.json tsconfig.json
COPY gulpfile.ts gulpfile.ts
RUN yarn build

EXPOSE 3000
CMD ["yarn", "serve"]