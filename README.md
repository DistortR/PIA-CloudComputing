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

## Jenkins y SonarQube · integración con el frente 3

El [Jenkinsfile](Jenkinsfile) usa un trabajo **Multibranch Pipeline**. Cada revisión descubierta ejecuta pruebas y archiva LCOV. `main` y `demo/quality-gate` analizan en proyectos SonarQube separados para usar Community Build. Solo `main` puede construir y publicar después de una puerta verde.

### Configuración en VM-TOOLS

1. Instalar los plugins Pipeline, GitHub Branch Source, Credentials Binding y SonarQube Scanner. Configurar un agente con etiqueta `medisur-ci`, Git, Bash, Bun 1.4.3 en el PATH del agente y acceso al daemon de Docker desde la cuenta que ejecuta el agente.
2. Crear un **Multibranch Pipeline** con GitHub como origen y `Jenkinsfile` como ruta. Darle acceso de lectura al repositorio con la credencial del origen. Descubrir ramas del repositorio del equipo y excluir forks. Las ramas que ejecutan código en ese agente deben pertenecer a colaboradores de confianza, porque el agente tiene acceso a Docker y el trabajo puede usar credenciales.
3. Conectar el webhook de GitHub a `https://<jenkins>/github-webhook/` para eventos de push. La URL debe ser alcanzable desde GitHub. Hacer una indexación inicial y después verificar que un push nuevo arranca una ejecución por sí solo.
4. Crear en SonarQube Community Build los proyectos locales `medisur` y `medisur-demo`. Asignar al principal una puerta que exija cobertura total de al menos 60 % y mantenga las comprobaciones de calidad y seguridad. En Jenkins, agregar el servidor con nombre `SonarQube` y una credencial Secret text con permiso de análisis de ambos proyectos. Agregar la herramienta CLI con nombre `SonarScanner`.
5. Configurar en SonarQube un webhook hacia `https://<jenkins>/sonarqube-webhook/`. Guardar el mismo secreto de ese webhook en Jenkins como Secret text con ID `sonar-webhook`. Verificar que SonarQube pueda alcanzar Jenkins.
6. Agregar en Jenkins una credencial de tipo Username with password con ID `ghcr-publisher`. Usar la cuenta autorizada para publicar y su token clásico con `write:packages`. La sesión temporal utilizada para publicar desde la laptop es independiente.

### Verificación para la entrega

1. Empujar una revisión de prueba en una rama interna y verificar el arranque por webhook, el SHA del checkout, las pruebas y el artefacto `coverage/lcov.info`.
2. Usar `demo/quality-gate` para un ensayo aislado. Ejecutar primero una línea base con la puerta normal. En `medisur-demo`, asociar temporalmente una puerta con un umbral de cobertura total superior a la cobertura observada. Empujar otro commit con pruebas verdes. Capturar el resultado rojo de SonarQube y el fallo de la etapa `Quality Gate`. Restaurar la puerta de demostración y repetir para confirmar que el gate cambia a verde.
3. En `main`, confirmar que Jenkins importa LCOV, la puerta pasa y se publica una etiqueta nueva `versión-SHA`. Para probar el bloqueo específico de publicación, capturar también una ejecución controlada de `main` con el gate rojo, verificando que los pasos de construcción y publicación queden omitidos por el fallo. Coordinar el cambio de umbral con el equipo y restaurarlo al terminar el ensayo.
4. Guardar evidencia del webhook y de las ejecuciones roja y verde. El frente de Kubernetes añadirá despliegue, smoke test y rollback después de la publicación.

[Pipeline declarativo de Jenkins](https://www.jenkins.io/doc/book/pipeline/syntax/) · [Puerta de calidad en Jenkins](https://docs.sonarsource.com/sonarqube-server/2026.1/analyzing-source-code/ci-integration/jenkins-integration/pipeline-pause)
