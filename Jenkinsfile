pipeline {
    agent any
    
    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhub-credentials')
        MONGODB_URI = credentials('mongodb-uri')
        JWT_SECRET = credentials('jwt-secret')
        RENDER_SERVICE_ID_BACKEND = 'your-render-backend-id' // or AWS vars
        RENDER_API_KEY = credentials('render-api-key')
        NODE_ENV = 'production'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Lint Backend') {
            steps {
                dir('backend') {
                    sh 'npm install'
                    sh 'npm run lint'
                }
            }
        }
        
        stage('Test Backend') {
            steps {
                dir('backend') {
                    sh 'npm test'
                }
            }
        }
        
        stage('Lint Frontend') {
            steps {
                dir('frontend') {
                    sh 'npm install'
                    sh 'npm run lint'
                }
            }
        }
        
        stage('Test Frontend') {
            steps {
                dir('frontend') {
                    sh 'npm test'
                }
            }
        }
        
        stage('Build Docker Images') {
            steps {
                script {
                    def backendImage = docker.build("yourusername/ai-travel-planner-backend:${env.BUILD_ID}")
                    def frontendImage = docker.build("yourusername/ai-travel-planner-frontend:${env.BUILD_ID}")
                    
                    docker.withRegistry('https://index.docker.io/v1/', DOCKERHUB_CREDENTIALS) {
                        backendImage.push()
                        frontendImage.push()
                    }
                }
            }
        }
        
        stage('Integration Test') {
            steps {
                script {
                    sh 'docker-compose -f docker-compose.test.yml up -d'
                    sh 'sleep 30' // wait for services
                    sh 'curl -f http://localhost:5000/api/health || exit 1'
                    sh 'docker-compose -f docker-compose.test.yml down'
                }
            }
        }
        
        stage('Deploy to Render') {
            when { branch 'main' }
            steps {
                script {
                    // Render CLI deploy (install render-cli)
                    sh '''
                        curl -L https://rendercli.com/install.sh | bash
                        render deploy --service $RENDER_SERVICE_ID_BACKEND --env MONGODB_URI=$MONGODB_URI,JWT_SECRET=$JWT_SECRET
                    '''
                    // Frontend similar
                }
            }
        }
        
        stage('Deploy to AWS EC2') {
            when { branch 'develop' }
            steps {
                sh './aws-deploy.sh $EC2_IP $DOMAIN'
            }
        }
    }
    
    post {
        always {
            sh 'docker system prune -f'
            junit '**/test-results.xml'
            archiveArtifacts artifacts: 'backend/coverage/**, frontend/build/**'
        }
    }
}

