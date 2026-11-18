# Avances del PIA · MediSur

## Parte 1 · Aplicación

**Aplicación piloto · API, variables de entorno, versión, métricas y pruebas**

### Avances de la aplicación

1. Revisé la consigna y el reparto del equipo. Definí los contratos que la aplicación entrega a quienes preparan la imagen, el pipeline, Kubernetes y el monitoreo.
2. Implementé la API en JavaScript con Bun 1.4.3. La consigna deja libre el lenguaje. El plan inicial planteaba Python, pero el entorno bloqueó la descarga de sus dependencias y Bun permitió completar el servicio y su verificación sin paquetes externos.
3. Agregué `GET /health` y `GET /ready` para vitalidad y disponibilidad. Agregué `GET /api/items` para listar e `POST /api/items` para crear un registro y validar su nombre. Los datos de ejemplo viven en memoria, separados por réplica, y se pierden al reiniciar.
4. Configuré el host y el puerto mediante `APP_HOST` y `APP_PORT`. `GET /version` devuelve la versión, el SHA y la fecha de construcción que recibe por `APP_VERSION`, `APP_COMMIT_SHA` y `APP_BUILD_DATE`.
5. Implementé `GET /metrics` con un contador por ruta y código de respuesta y un histograma de duración en segundos. Las series incluyen un identificador de versión para relacionarlas con los despliegues.
6. Ejecuté `bun test` en esta carpeta y en una copia limpia. Pasaron 13 pruebas, incluidas seis unitarias. Bun mostró 93.94 % de cobertura de líneas y 100 % de funciones en su resumen, por encima del mínimo de 60 %. El comando regenera `coverage/lcov.info`.
7. Comprobé las seis rutas mediante peticiones directas al manejador. El entorno bloqueó la escucha en un puerto, por lo que la verificación por red con `curl` queda pendiente. Guardé las [respuestas](evidencias/respuestas.txt) y la [salida de las pruebas](evidencias/pruebas.txt).

### Cierre del plan de Aplicación

| Paso del plan | Resultado verificado |
| --- | --- |
| 1. Contrato | Seis rutas, cinco variables de entorno, puerto y formato de métricas documentados. |
| 2. Arranque local | Bun 1.4.3, sin dependencias externas. Arranque y validación del puerto verificados. |
| 3. Sondas e ítems | Vitalidad y disponibilidad verificadas. Creación, listado y rechazo de entradas inválidas cubiertos por pruebas. |
| 4. Identidad del build | `/version` devuelve versión, SHA y fecha inyectados, comprobados por HTTP en el contenedor. |
| 5. Métricas | Contador por ruta y estado, histograma de latencia y etiqueta de versión. Series comprobadas tras generar tráfico. |
| 6. Pruebas y cobertura | 13 pruebas aprobadas, incluidas seis unitarias. Bun reportó 93.94 % de líneas, por encima del 60 % requerido. `bun test` regenera `coverage/lcov.info`. |
| 7. Evidencias y entrega | Código de aplicación publicado en el repo. [README](README.md), [resultado de pruebas](evidencias/pruebas.txt) y [evidencia HTTP en Docker](evidencias/docker-local.txt) disponibles para el equipo. |

La aplicación está lista para integrar. Las verificaciones en Jenkins, Kubernetes y Grafana corresponden a los responsables de esos frentes.

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

## Parte 2 · Repositorio e imagen

**Repositorio e imagen · ramas, Docker y GHCR**

1. El trabajo de repositorio e imagen se subió a `main` en el commit `8248ffb`.
2. Agregué un [Dockerfile multietapa](Dockerfile). La etapa de build compila el servicio con Bun 1.4.3. La etapa final copia el ejecutable a Debian slim y configura el usuario `10001:10001`, el puerto 8080 y los metadatos de construcción. El [filtro del contexto](.dockerignore) permite el Dockerfile y el código necesario para compilar.
3. Agregué [el comando de construcción](scripts/build-image.sh). Empaqueta el árbol del commit exacto, genera la fecha UTC y etiqueta para GHCR con versión y SHA corto. Rechaza `latest` como versión. Verifiqué con un Docker simulado los argumentos y que el contexto excluye los cambios locales. Jenkins podrá invocarlo al pasar la puerta de calidad.
4. Compilé el ejecutable en el host y verifiqué las seis rutas por HTTP con `curl`, además de la coincidencia del SHA y el cierre con `SIGTERM`. Guardé la [salida de la prueba](evidencias/binario-http.txt). Esa prueba cubrió el ejecutable compilado. La imagen completa requiere acceso al daemon de Docker.
5. Dejé en el [README](README.md) los pasos de verificación del usuario del contenedor, metadatos, publicación privada y protección de `main`.

**Uso de IA.** Codex preparó la receta de empaquetado, el script y la documentación. Se usó para reducir pasos manuales y probar que los metadatos coinciden con el commit. Se ajustó la verificación para ejecutar el binario por HTTP cuando Docker no estuvo accesible.

**Verificación posterior en Docker.** Construí `medisur:prueba-local` con el Dockerfile multietapa y ejecuté la imagen. Comprobé que corre con UID y GID 10001 y que la etapa final carece de `bun`, `gcc`, `cc` y `make`. Validé las seis rutas por HTTP, incluidos los tres metadatos de build y las métricas después de crear un ítem. La [evidencia de Docker](evidencias/docker-local.txt) corresponde a una etiqueta de prueba local. Después se construyó y publicó la imagen desde el commit `8248ffb`.

**Publicación en GHCR.** Se publicó `ghcr.io/distortr/pia-cloudcomputing:1.0.0-8248ffb`. La descarga autenticada devolvió el mismo digest que la publicación, `sha256:cd61a4566c64313abcd6f659e829eae812e544c6d5a4988ca963f2981f6fabc0`. El titular de la cuenta confirmó que el paquete aparece como privado en GitHub. Usar la etiqueta `1.0.0-8248ffb` en el despliegue.

**Pendiente.** Configurar la protección de `main` y el flujo de PR con el equipo.

## Parte 3 · CI y calidad

1. Agregué el [Jenkinsfile](Jenkinsfile) con checkout del commit, pruebas Bun, archivo de cobertura, análisis SonarQube y Quality Gate bloqueante con tiempo límite. Después de una puerta verde, el pipeline de `main` construye y publica en GHCR con una credencial de Jenkins.
2. Configuré [SonarQube](sonar-project.properties) para medir el código de `app/` e importar `coverage/lcov.info`. La rama de ensayo `demo/quality-gate` usa un proyecto SonarQube separado para preservar la línea base de `main`.
3. Ejecuté el bloque de pruebas del Jenkinsfile en una copia limpia. Pasaron 13 pruebas y Bun reportó 93.94 % de cobertura de líneas. Inyecté una prueba fallida en una copia temporal y confirmé que el bloque terminó con código distinto de cero. Revisé la sintaxis de los bloques shell, el orden de las etapas y la condición de publicación. El validador declarativo de un Jenkins temporal confirmó `Jenkinsfile successfully validated.`
4. Probé SonarQube Community Build en local con el reporte LCOV real. SonarQube midió 97.0 % y devolvió puerta roja con un umbral de 100 %, luego puerta verde con 60 %. Guardé la [evidencia local](evidencias/sonarqube-local.txt).
5. La ejecución integrada requiere configurar Jenkins, SonarQube y ambos webhooks en VM-TOOLS. Allí se deben capturar el disparo automático, la importación de cobertura, el gate rojo y el build verde publicado por Jenkins. El [README](README.md) registra la configuración y el procedimiento de prueba.

**Uso de IA.** Codex elaboró el pipeline y la documentación de integración. Los proyectos SonarQube separados mantienen el análisis de demostración aislado en Community Build. La verificación local incluyó un fallo controlado de pruebas. La respuesta real de SonarQube se verificará en VM-TOOLS.

### VM-TOOLS y control de costos

Azure rechazó la asignación de la B4as v2 autorizada en México Central y West US 2 por falta de capacidad. En North Central US, Azure CLI falló durante la creación y no mostró el motivo de fondo. Azure confirmó que los grupos temporales de estos intentos se eliminaron. La instalación de Jenkins y SonarQube en VM-TOOLS, los webhooks y la demostración del Quality Gate con publicación desde Jenkins siguen pendientes.

Instrucciones para el equipo y sus asistentes:

- Revisar el estado antes de iniciar una VM. Encenderla solo para instalación, pruebas, ensayos o exposición que se harán en ese momento. Coordinar con el equipo quién la está usando.
- Desasignarla desde Azure al terminar cada sesión. En el portal, usar **Detener** y confirmar **Detenida (desasignada)**. Por CLI, usar `az vm deallocate -g <grupo> -n <vm>` y verificar el estado con `az vm show -d -g <grupo> -n <vm> --query powerState -o tsv`. Apagar desde Ubuntu por sí solo puede dejar el cómputo asignado.
- Mantener habilitado el límite de gasto de Azure for Students. El disco y la IP reservada pueden seguir consumiendo crédito con la VM desasignada. Revisar ambos recursos al calcular el costo y coordinar su eliminación al terminar el PIA.
- Una alerta de presupuesto avisa sobre el consumo. El apagado y la verificación siguen siendo responsabilidad de quien inicia la VM.
