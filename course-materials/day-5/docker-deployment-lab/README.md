# Docker Deployment Lab - README

This directory contains a complete solution for the Docker Deployment Lab from Day 5 of the Intermediate Node.js Development course.

## 🚀 Quick Start

1. **Prerequisites**

   - Docker Desktop installed and running
   - Node.js 18+ (for local development)
   - Git (for version control)

2. **One-Command Deployment**

   ```bash
   ./scripts/deploy.sh
   ```

3. **Access the Application**
   - Main App: http://localhost:3000
   - Health Check: http://localhost:3000/health
   - API Info: http://localhost:3000/api/info

## 📁 Project Structure

```
docker-deployment-lab/
├── app.js                 # Main Express application
├── healthcheck.js         # Docker health check script
├── package.json           # Node.js dependencies
├── Dockerfile            # Multi-stage production build
├── docker-compose.yml    # Development environment
├── .dockerignore         # Docker build exclusions
├── .gitignore           # Git exclusions
├── scripts/
│   └── deploy.sh        # Automated deployment script
├── .github/
│   └── workflows/
│       └── docker-deploy.yml  # CI/CD pipeline
└── tests/
    └── app.test.js      # Comprehensive test suite
```

## 🐳 Docker Commands

### Basic Operations

```bash
# Build the image
docker build -t node-docker-app .

# Run the container
docker run -d -p 3000:3000 --name docker-lab-container node-docker-app

# View logs
docker logs docker-lab-container -f

# Stop and remove
docker stop docker-lab-container
docker rm docker-lab-container
```

### Using the Deployment Script

```bash
# Full deployment
./scripts/deploy.sh

# Build only
./scripts/deploy.sh build

# Run only (assumes image exists)
./scripts/deploy.sh run

# Test endpoints
./scripts/deploy.sh test

# Cleanup
./scripts/deploy.sh cleanup

# View logs
./scripts/deploy.sh logs

# Check status
./scripts/deploy.sh status
```

## 🔧 Development Environment

Start the full development stack with Docker Compose:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild and start
docker-compose up --build -d
```

### Services Included:

- **app**: Main Node.js application (port 3000)
- **postgres**: PostgreSQL database (port 5432)
- **redis**: Redis cache (port 6379)
- **nginx**: Reverse proxy (port 80)
- **prometheus**: Metrics collection (port 9090)
- **grafana**: Monitoring dashboard (port 3001)

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🏗️ CI/CD Pipeline

The project includes a GitHub Actions workflow (`.github/workflows/docker-deploy.yml`) that:

1. **Build & Test**: Installs dependencies and runs tests
2. **Security Scan**: Scans for vulnerabilities
3. **Docker Build**: Creates optimized production image
4. **Security Scan**: Scans Docker image for vulnerabilities
5. **Deploy**: Supports multiple cloud platforms:
   - Heroku Container Registry
   - AWS Elastic Container Service (ECS)
   - Azure Container Instances (ACI)

### Required Secrets:

- `HEROKU_API_KEY`
- `HEROKU_APP_NAME`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AZURE_CREDENTIALS`

## 🔒 Security Features

### Application Security:

- **Helmet**: Security headers middleware
- **CORS**: Cross-origin resource sharing protection
- **Rate Limiting**: Prevents abuse
- **Input Validation**: Sanitizes user input
- **Security Headers**: Comprehensive header protection

### Container Security:

- **Non-root User**: Runs as unprivileged user
- **Minimal Base Image**: Uses Alpine Linux
- **Multi-stage Build**: Reduces attack surface
- **Health Checks**: Monitors container health
- **Vulnerability Scanning**: Automated security scanning

## 📊 Monitoring & Observability

### Health Checks:

- **Application Health**: `/health` endpoint
- **Docker Health**: Built-in health check
- **Dependency Health**: Database and cache status

### Logging:

- **Structured Logging**: JSON format with Winston
- **Request Logging**: All HTTP requests logged
- **Error Tracking**: Error details and stack traces
- **Performance Metrics**: Response times and throughput

### Metrics (with Docker Compose):

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and alerting
- **Node.js Metrics**: Application performance metrics
- **System Metrics**: Container resource usage

## 🌐 Cloud Deployment

### Heroku

```bash
# Build and push to Heroku Container Registry
heroku container:push web -a your-app-name
heroku container:release web -a your-app-name
```

### AWS ECS

1. Create ECS cluster and task definition
2. Push image to ECR
3. Deploy using ECS service

### Azure Container Instances

```bash
az container create \
  --resource-group myResourceGroup \
  --name docker-lab-app \
  --image myregistry.azurecr.io/node-docker-app:latest \
  --ports 3000
```

## 🐛 Troubleshooting

### Common Issues:

1. **Port Already in Use**

   ```bash
   # Find process using port 3000
   lsof -i :3000
   # Kill the process
   kill -9 <PID>
   ```

2. **Docker Daemon Not Running**

   ```bash
   # Start Docker Desktop
   open -a Docker
   ```

3. **Image Build Failures**

   ```bash
   # Clean Docker cache
   docker system prune -a
   # Rebuild with no cache
   docker build --no-cache -t node-docker-app .
   ```

4. **Container Won't Start**
   ```bash
   # Check logs
   docker logs docker-lab-container
   # Run interactively for debugging
   docker run -it node-docker-app sh
   ```

### Debugging Commands:

```bash
# Execute shell in running container
docker exec -it docker-lab-container sh

# Inspect container configuration
docker inspect docker-lab-container

# View container resource usage
docker stats docker-lab-container

# Check network configuration
docker network ls
docker network inspect docker-lab-network
```

## 📚 Learning Objectives

This lab demonstrates:

1. **Docker Fundamentals**: Containerization concepts and best practices
2. **Multi-stage Builds**: Optimizing image size and security
3. **Production Deployment**: Real-world deployment strategies
4. **CI/CD Integration**: Automated testing and deployment
5. **Security Best Practices**: Container and application security
6. **Monitoring & Logging**: Observability in containerized environments
7. **Cloud Deployment**: Multi-platform deployment strategies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is part of the Intermediate Node.js Development course materials and is intended for educational purposes.

---

**Happy Containerizing! 🐳**
