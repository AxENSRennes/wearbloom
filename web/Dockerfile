FROM nginxinc/nginx-unprivileged:1.29.0-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public /usr/share/nginx/html
EXPOSE 8080
