# Trabajo final: entrega continua sobre Kubernetes

## 1. Problemática

MediSur ya opera su infraestructura en la nube, pero sus despliegues siguen dependiendo de pasos manuales: el código se envía como archivo, una persona entra por SSH al servidor, copia los cambios y reinicia el servicio. No hay una cadena confiable de pruebas y revisión de calidad antes de publicar. Esto alarga las entregas, aumenta el riesgo de errores y hace difícil saber qué versión está funcionando o recuperarse cuando falla.

La empresa quiere probar un proceso moderno con un servicio pequeño antes de migrar sistemas críticos. El valor del piloto estará en el flujo automatizado y observable, no en construir una aplicación grande.

## 2. Objetivo del piloto

Construir un servicio mínimo que permita comprobar que un cambio de código puede pasar por pruebas y análisis de calidad, convertirse en una imagen identificada por el commit, y desplegarse automáticamente en Kubernetes. Si las pruebas o la puerta de calidad fallan, el proceso debe detenerse antes de publicar. La aplicación tendrá métricas y el entorno contará con tableros y alertas para observar su estado.

La demo debe hacer visible el ciclo completo: provocar un fallo que SonarQube bloquee, corregirlo, desplegar una versión nueva sin intervención manual por SSH, observar la recuperación de un Pod y demostrar una reversión.

## 3. Arquitectura de partida

Se propone usar dos máquinas virtuales separadas en Azure, como pide la guía:

- **VM-TOOLS:** Jenkins, SonarQube, Docker, Prometheus, Grafana y métricas del sistema. Tamaño de referencia B4ms, 4 vCPU y 16 GB de RAM.
- **VM-K8S:** MicroK8s o k3s, la aplicación con dos réplicas, kube-state-metrics y métricas del sistema. Tamaño de referencia B2ms, 2 vCPU y 8 GB de RAM.
- **Repositorio:** GitHub o GitLab con rama principal protegida, ramas de funcionalidad y Pull/Merge Requests.
- **Registro:** GHCR o GitLab Container Registry; publicar imágenes con el SHA corto del commit, nunca con `latest`.
- **Flujo:** push/PR → webhook → Jenkins → pruebas/cobertura → SonarQube y Quality Gate → construcción/publicación de imagen → despliegue en Kubernetes → verificación y monitoreo.

El equipo ya tiene experiencia del laboratorio anterior con MicroK8s en Azure. Esa VM existente es una referencia útil para la práctica, pero **no se debe asumir todavía que cumple el trabajo final**: la guía pide dos VMs separadas y Ubuntu Server 22.04 LTS, mientras que el laboratorio previo usó una sola VM con Ubuntu 24.04. Antes de reutilizar recursos hay que comparar la configuración real con los requisitos y revisar el crédito disponible.

## 4. Requisitos que guían el diseño

- API con `GET /health`, `GET /ready`, `GET /version`, `GET /metrics`, `GET /api/items` y `POST /api/items`.
- Al menos cinco pruebas unitarias reales y cobertura mínima del 60 %.
- Dockerfile multietapa; imagen final sin herramientas de compilación y proceso sin privilegios.
- Configuración mediante variables de entorno y cero secretos en el repositorio o en su historial.
- Jenkinsfile versionado, webhook automático y Quality Gate que realmente detenga el pipeline.
- Deployment con dos réplicas, sondas y actualización gradual; demostrar `kubectl rollout undo`.
- Dos tableros de Grafana (infraestructura y aplicación) y tres alertas con datos reales.
- Desasignar las VMs desde Azure al terminar; los discos siguen generando costo. Configurar apagado automático y vigilar el presupuesto.

## 5. Reparto provisional del trabajo

Este reparto es por frentes con interfaces claras; todos deben revisar y poder explicar el resultado. El profesor ya autorizó que el equipo trabaje con cinco integrantes; asignen un frente principal a cada persona y compartan las decisiones de integración.

| Frente | Alcance principal | Resultado revisable |
|---|---|---|
| 1. Aplicación | API, variables de entorno, `/version`, métricas y pruebas | Código funcional, pruebas y reporte de cobertura |
| 2. Repositorio e imagen | Ramas/PR, Dockerfile multietapa, registro y etiquetas SHA | Repositorio ordenado e imagen publicada sin `latest` |
| 3. CI y calidad | Jenkins, webhook, etapas de pruebas, SonarQube y Quality Gate | Jenkinsfile que falla ante una puerta roja y pasa al corregir |
| 4. Kubernetes y entrega | VM-K8S, manifiestos, sondas, dos réplicas, despliegue y rollback | Actualización automática y reversión demostrables |
| 5. Infraestructura y monitoreo | VM-TOOLS/VM-K8S, Prometheus, Grafana, alertas, costos, evidencias y documento | Dos tableros, tres alertas, diagrama e inventario verificables |

El frente 5 es más amplio y deberá repartirse entre todos cuando llegue la integración. Para equilibrar la carga, quien tome ese frente puede compartir la preparación del documento con los responsables de aplicación, pipeline y Kubernetes, que aportarán sus decisiones y evidencias.
