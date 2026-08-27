pipeline {
  agent any

  environment {
    APP_VERSION = "${env.BUILD_NUMBER}"
    FRONTEND_URL = credentials('ai-travel-frontend-url')
    DATABASE_URL = credentials('ai-travel-postgres-url')
    JWT_SECRET = credentials('ai-travel-jwt-secret')
    GOOGLE_MAPS_API_KEY = credentials('ai-travel-google-maps-api-key')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install') {
      parallel {
        stage('Backend dependencies') {
          steps {
            dir('backend') {
              sh 'npm ci'
            }
          }
        }
        stage('Frontend dependencies') {
          steps {
            dir('frontend') {
              sh 'npm ci'
            }
          }
        }
      }
    }

    stage('Test and Build') {
      parallel {
        stage('Backend checks') {
          steps {
            dir('backend') {
              sh 'npm test'
            }
          }
        }
        stage('Frontend build') {
          steps {
            dir('frontend') {
              sh 'CI=true npm run build'
            }
          }
        }
      }
    }

    stage('Docker Build') {
      steps {
        sh 'docker compose build'
      }
    }

    stage('Deploy') {
      when {
        branch 'main'
      }
      steps {
        sh '''
          cat > backend/.env.docker <<EOF
NODE_ENV=production
PORT=5000
FRONTEND_URL=${FRONTEND_URL}
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}
EOF
          docker compose up -d --remove-orphans
        '''
      }
    }
  }

  post {
    always {
      sh 'docker compose ps || true'
    }
  }
}
