FROM node:10 AS stage-one

# Install DEB dependencies and others.
RUN \
    set -x \
    && apt-get update \
    && apt-get install -y net-tools build-essential valgrind

WORKDIR /server
COPY package.json .
RUN yarn install
CMD ["node", "/server/node_modules/mediakitchen-server/dist/server.js"]