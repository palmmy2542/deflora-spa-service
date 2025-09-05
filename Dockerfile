FROM node:20-alpine

WORKDIR /usr/src/app
COPY package*.json ./
RUN yarn install --production
COPY . .

EXPOSE 8080
CMD ["yarn", "build"]
CMD ["yarn", "start"]
