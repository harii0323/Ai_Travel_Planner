# Jenkins CI/CD Integration TODO

## Completed
- [x] Create TODO.md with steps
- [x] Create Jenkinsfile
- [x] Create Dockerfile.backend
- [x] Create Dockerfile.frontend
- [x] Create docker-compose.yml
- [x] Create .dockerignore
- [x] Create frontend/nginx.conf & .htaccess
- [x] Update backend/package.json (add lint/test scripts + devDeps)
- [x] Update frontend/package.json (add lint/test scripts)

## Remaining Steps
1. Install Docker if needed: `docker --version`
2. Test stack: `docker-compose up --build` (visit http://localhost:3000, API localhost:5000)
3. User: Setup Jenkins server (Docker/local/CloudBees), create pipeline job from Jenkinsfile, add GitHub webhook
4. Configure Jenkins credentials: dockerhub, MongoDB URI, JWT secret, Render/AWS vars
5. Test pipeline on push/PR
6. Optional: Add .github/workflows for GitHub Actions too

