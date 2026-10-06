FROM node:alpine AS build

ENV VITE_OIDC_AUTHORITY=<authority>
ENV VITE_OIDC_AUDIENCE=<audience>
ENV VITE_OIDC_CLIENT_ID=<client id>
ENV VITE_APP_PATH_PREFIX=/<path_prefix/
ENV VITE_API_URL=<api url>
ENV VITE_NODE_ENV=development

WORKDIR /app

COPY ./package.json /app/package.json
COPY ./yarn.lock /app/yarn.lock
RUN yarn install
COPY . .
RUN yarn build

FROM nginx:alpine

COPY --from=build /app/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

RUN touch /var/run/nginx.pid
RUN chown -R nginx:nginx /var/run/nginx.pid /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx/conf.d
USER nginx

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
