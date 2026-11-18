FROM oven/bun:1.4.3 AS build
WORKDIR /src
COPY app/ ./app/
RUN bun build --compile app/server.js --outfile /out/medisur

FROM debian:bookworm-slim AS runtime
ARG APP_VERSION
ARG APP_COMMIT_SHA
ARG APP_BUILD_DATE
RUN test -n "$APP_VERSION" && test -n "$APP_COMMIT_SHA" && test -n "$APP_BUILD_DATE"
LABEL org.opencontainers.image.source="https://github.com/DistortR/PIA-CloudComputing" \
      org.opencontainers.image.version="$APP_VERSION" \
      org.opencontainers.image.revision="$APP_COMMIT_SHA" \
      org.opencontainers.image.created="$APP_BUILD_DATE"
ENV APP_HOST=0.0.0.0 APP_PORT=8080 \
    APP_VERSION=$APP_VERSION APP_COMMIT_SHA=$APP_COMMIT_SHA APP_BUILD_DATE=$APP_BUILD_DATE
COPY --from=build /out/medisur /usr/local/bin/medisur
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/medisur"]
