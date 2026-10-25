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
              bat 'npm ci'
            }
          }
        }
        stage('Frontend dependencies') {
          steps {
            dir('frontend') {
              bat 'npm ci'
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
              bat 'npm test'
            }
          }
        }
        stage('Frontend build') {
          environment {
            CI = 'true'
          }
          steps {
            dir('frontend') {
              bat 'set "CI=true" && npm run build'
            }
          }
        }
      }
    }

    stage('Docker Build') {
      steps {
        bat 'docker compose build'
      }
    }

    stage('Deploy') {
      when {
        branch 'main'
      }
      steps {
        writeFile file: 'backend/.env.docker', text: """NODE_ENV=production
PORT=5000
FRONTEND_URL=${env.FRONTEND_URL}
DATABASE_URL=${env.DATABASE_URL}
JWT_SECRET=${env.JWT_SECRET}
GOOGLE_MAPS_API_KEY=${env.GOOGLE_MAPS_API_KEY}
"""
        bat 'docker compose up -d --remove-orphans'
      }
    }
  }

  post {
    always {
      bat 'docker compose ps || exit /b 0'
    }
  }
}
