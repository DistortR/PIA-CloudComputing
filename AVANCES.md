# Avances del PIA · MediSur

## ========================= PARTE 1 =========================

**Aplicación piloto · API, variables de entorno, versión, métricas y pruebas**

### Avances

1. Revisé la consigna y el reparto del equipo. Definí los contratos que la aplicación entrega a quienes preparan la imagen, el pipeline, Kubernetes y el monitoreo.
2. Implementé la API en JavaScript con Bun 1.4.3. La consigna deja libre el lenguaje. El plan inicial planteaba Python, pero el entorno bloqueó la descarga de sus dependencias y Bun permitió completar el servicio y su verificación sin paquetes externos.
3. Agregué `GET /health` y `GET /ready` para vitalidad y disponibilidad. Agregué `GET /api/items` para listar e `POST /api/items` para crear un registro y validar su nombre. Los datos de ejemplo viven en memoria, separados por réplica, y se pierden al reiniciar.
4. Configuré el host y el puerto mediante `APP_HOST` y `APP_PORT`. `GET /version` devuelve la versión, el SHA y la fecha de construcción que recibe por `APP_VERSION`, `APP_COMMIT_SHA` y `APP_BUILD_DATE`.
5. Implementé `GET /metrics` con un contador por ruta y código de respuesta y un histograma de duración en segundos. Las series incluyen un identificador de versión para relacionarlas con los despliegues.
6. Ejecuté `bun test` en esta carpeta y en una copia limpia. Pasaron 13 pruebas, incluidas seis unitarias. Bun mostró 93.94 % de cobertura de líneas y 100 % de funciones en su resumen, por encima del mínimo de 60 %. El comando regenera `coverage/lcov.info`.
7. Comprobé las seis rutas mediante peticiones directas al manejador. El entorno bloqueó la escucha en un puerto, por lo que la verificación por red con `curl` queda pendiente. Guardé las [respuestas](evidencias/respuestas.txt) y la [salida de las pruebas](evidencias/pruebas.txt).

### Archivos para continuar

| Archivo | Contenido |
| --- | --- |
| [app/api.js](app/api.js) | Rutas, validación y lectura de configuración. |
| [app/server.js](app/server.js) | Arranque y cierre del servicio HTTP. |
| [app/metrics.js](app/metrics.js) | Contador e histograma en formato Prometheus. |
| [tests/app.test.js](tests/app.test.js) y [bunfig.toml](bunfig.toml) | Pruebas, umbral y configuración del reporte LCOV. |
| [README.md](README.md) | Comandos de arranque y prueba, contrato de integración y aporte al Word con declaración de IA. |

### Entrega a los demás frentes

| Frente | Siguiente paso con la aplicación |
| --- | --- |
| **2. Repositorio e imagen** | Empaquetar con Bun 1.4.3 y arrancar con `bun app/server.js`. Inyectar versión, SHA y fecha al construir la imagen. |
| **3. CI y calidad** | Ejecutar `bun test` desde la raíz y comprobar que SonarQube importa `coverage/lcov.info` con `sonar.javascript.lcov.reportPaths`. El reporte se genera en cada ejecución. |
| **4. Kubernetes y entrega** | Configurar las sondas en `/health` y `/ready` y comprobar que `/version` cambia tras el despliegue y recupera el SHA anterior tras el rollback. |
| **5. Infraestructura y monitoreo** | Recoger `/metrics` de ambas réplicas y conectar el contador y el histograma con los paneles de Grafana. |

## ===== PARTE 2 =====

**Repositorio e imagen · ramas, Docker y GHCR**

1. Dejé los cambios de la Parte 2 en `main`, pendientes de commit.
2. Agregué un [Dockerfile multietapa](Dockerfile). La etapa de build compila el servicio con Bun 1.4.3. La etapa final copia el ejecutable a Debian slim y configura el usuario `10001:10001`, el puerto 8080 y los metadatos de construcción. El [filtro del contexto](.dockerignore) permite el Dockerfile y el código necesario para compilar.
3. Agregué [el comando de construcción](scripts/build-image.sh). Empaqueta el árbol del commit exacto, genera la fecha UTC y etiqueta para GHCR con versión y SHA corto. Rechaza `latest` como versión. Verifiqué con un Docker simulado los argumentos y que el contexto excluye los cambios locales. Jenkins podrá invocarlo al pasar la puerta de calidad.
4. Compilé el ejecutable en el host y verifiqué las seis rutas por HTTP con `curl`, además de la coincidencia del SHA y el cierre con `SIGTERM`. Guardé la [salida de la prueba](evidencias/binario-http.txt). Esa prueba cubrió el ejecutable compilado. La imagen completa requiere acceso al daemon de Docker.
5. Dejé en el [README](README.md) los pasos de verificación del usuario del contenedor, metadatos, publicación privada y protección de `main`. El build en Docker, el push a GHCR y la protección remota quedan pendientes de verificación con acceso al daemon y a GitHub.

**Uso de IA.** Codex preparó la receta de empaquetado, el script y la documentación. Se usó para reducir pasos manuales y probar que los metadatos coinciden con el commit. Se ajustó la verificación para ejecutar el binario por HTTP cuando Docker no estuvo accesible.

**Verificación posterior en Docker.** Construí `medisur:prueba-local` con el Dockerfile multietapa y ejecuté la imagen. Comprobé que corre con UID y GID 10001 y que la etapa final carece de `bun`, `gcc`, `cc` y `make`. Validé las seis rutas por HTTP, incluidos los tres metadatos de build y las métricas después de crear un ítem. La [evidencia de Docker](evidencias/docker-local.txt) corresponde a una etiqueta de prueba local. Siguen pendientes la publicación en GHCR desde un commit y la protección remota de `main`.
