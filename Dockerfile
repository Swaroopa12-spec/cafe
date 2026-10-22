FROM python:3.12-alpine
WORKDIR /app
COPY index.html ./index.html
ENV PORT=10000
EXPOSE 10000
CMD ["sh", "-c", "python -m http.server ${PORT:-10000} --bind 0.0.0.0"]
