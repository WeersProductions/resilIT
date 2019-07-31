FROM node:alpine AS base

RUN apk add --no-cache bash git tzdata

# Set container timezone to Amsterdam
RUN cp /usr/share/zoneinfo/Europe/Amsterdam /etc/localtime
RUN echo "Europe/Amsterdam" >  /etc/timezone
RUN apk del tzdata

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/

RUN npm install gulp -g
RUN npm install gulp-nodemon -g
RUN npm install nodemon -g
RUN npm rebuild node-sass

COPY entrypoint.development.sh entrypoint.production.sh /usr/src/


EXPOSE 3000

# Development image
FROM base AS development

# Production image
FROM base AS production
ADD singularIT /usr/src/app

WORKDIR /usr/src/app/

RUN rm -rvf node_modules
RUN npm install
RUN npm install gulp-nodemon
RUN npm link gulp
RUN npm link gulp-nodemon
RUN gulp sass
RUN gulp js

WORKDIR /usr/src/
