FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY app/ /usr/share/nginx/html/
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
