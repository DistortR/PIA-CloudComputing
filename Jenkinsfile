pipeline {
    agent { label 'medisur-ci' }

    options {
        skipDefaultCheckout()
        disableConcurrentBuilds()
    }

    environment {
        RELEASE_VERSION = '1.0.0'
    }

    stages {
        stage('Checkout') {
            steps {
                deleteDir()
                checkout scm
                sh 'git log -1 --format=%H'
            }
        }

        stage('Pruebas y cobertura') {
            steps {
                sh '''
                    test "$(bun --version)" = "1.4.3"
                    bun test
                    test -s coverage/lcov.info
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'coverage/lcov.info', allowEmptyArchive: true
                }
            }
        }

        stage('SonarQube') {
            when {
                anyOf {
                    branch 'main'
                    branch 'demo/quality-gate'
                }
            }
            steps {
                script {
                    env.SONAR_PROJECT_KEY = env.BRANCH_NAME == 'main' ? 'medisur' : 'medisur-demo'
                    def scannerHome = tool 'SonarScanner'
                    withSonarQubeEnv('SonarQube') {
                        // Community Build analiza la rama principal de cada proyecto.
                        withEnv(["SCANNER_HOME=${scannerHome}", "BRANCH_NAME="]) {
                            sh '''
                                "$SCANNER_HOME/bin/sonar-scanner" -Dsonar.projectKey="$SONAR_PROJECT_KEY"
                            '''
                        }
                    }
                }
            }
        }

        stage('Quality Gate') {
            when {
                anyOf {
                    branch 'main'
                    branch 'demo/quality-gate'
                }
            }
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true, webhookSecretId: 'sonar-webhook'
                }
            }
        }

        stage('Construir imagen') {
            when { branch 'main' }
            steps {
                script {
                    env.IMAGE_REF = sh(
                        script: 'bash scripts/build-image.sh "$RELEASE_VERSION"',
                        returnStdout: true
                    ).trim()
                }
            }
        }

        stage('Publicar en GHCR') {
            when { branch 'main' }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'ghcr-publisher',
                    usernameVariable: 'GHCR_USER',
                    passwordVariable: 'GHCR_TOKEN'
                )]) {
                    sh '''
                        set +x
                        DOCKER_CONFIG="$(mktemp -d)"
                        export DOCKER_CONFIG
                        trap 'rm -rf -- "$DOCKER_CONFIG"' EXIT
                        printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
                        docker push "$IMAGE_REF"
                    '''
                }
                echo "Imagen publicada: ${env.IMAGE_REF}"
            }
        }
    }
}
