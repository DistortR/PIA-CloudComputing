# PIA-CloudComputing
Piloto de entrega continua de MediSur. El [reparto](Repartición.md) y la [bitácora](AVANCES.md) describen el alcance de cada parte.

## Aplicación y pruebas

Desde la raíz, con Bun 1.4.3:

```bash
bun test
APP_HOST=127.0.0.1 APP_PORT=8080 \
APP_VERSION=1.0.0 APP_COMMIT_SHA="$(git rev-parse HEAD)" \
APP_BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" bun app/server.js
```

Las cinco variables son obligatorias. El servicio ofrece `GET /health`, `GET /ready`, `GET /version`, `GET /metrics`, `GET /api/items` y `POST /api/items`. Para crear un ítem, enviar JSON como `{"name":"vendas"}`. Los registros viven en la memoria de cada réplica.

`bun test` exige un mínimo de 60 % y genera `coverage/lcov.info`. Configurar SonarQube con `sonar.sources=app`, `sonar.tests=tests` y `sonar.javascript.lcov.reportPaths=coverage/lcov.info`. Las métricas se recogen por réplica en `/metrics`. El contador `http_requests_total` incluye `method`, `route`, `status` y `version`. El histograma `http_request_duration_seconds` mide latencia en segundos.

## Construir y verificar la imagen

El script empaqueta el commit actual de Git e inyecta su SHA completo y la fecha UTC. La etiqueta usa versión y los primeros siete caracteres del SHA. Ejecutarlo después de guardar el Dockerfile en un commit.

```bash
bash scripts/build-image.sh 1.0.0
imagen="ghcr.io/distortr/pia-cloudcomputing:1.0.0-$(git rev-parse HEAD | cut -c 1-7)"
docker image inspect "$imagen" --format '{{.Config.User}} {{index .Config.Labels "org.opencontainers.image.revision"}}'
docker run --rm --entrypoint /bin/sh "$imagen" -ec '
  test "$(id -u)" = 10001
  for tool in bun gcc cc make; do ! command -v "$tool" || exit 1; done
'
docker run --rm -p 127.0.0.1:8080:8080 "$imagen"
```

En otra terminal, confirmar `200` en ambas sondas y comparar el SHA de `/version` con `git rev-parse HEAD`.

```bash
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/ready
curl -fsS http://127.0.0.1:8080/version
```

## Publicación y ramas

La consigna pide proteger `main` y usar ramas de funcionalidad con PR. La protección que exige PR y revisión cambia cómo se integran los siguientes avances. Configurarla en GitHub cuando el equipo adopte ese flujo. Cuando Jenkins reporte estados, agregar su comprobación como requisito de fusión.

Para publicar la imagen inicial, autenticar Docker en GHCR con un token clásico con `write:packages`. En Jenkins, guardar la credencial en Jenkins Credentials y pasarla por entrada estándar a `docker login`. Publicar solo la etiqueta generada y comprobar que el paquete esté privado y vinculado al repositorio. Kubernetes necesitará una credencial de lectura para descargarlo.

```bash
printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
docker push "$imagen"
docker buildx imagetools inspect "$imagen"
```

En el flujo final, Jenkins construye y publica después del Quality Gate. El Deployment debe usar la etiqueta exacta publicada y conservar los metadatos de la imagen.
