# Lab 1: Docker Containerization & Cloud Deployment

## 🎯 Objective

Learn how to containerize a Node.js application using Docker and deploy it to multiple cloud platforms. This lab covers Docker best practices, multi-stage builds, security considerations, and production deployment strategies.

## 🧠 Learning Goals

By the end of this lab, you will be able to:

- Create optimized Docker images for Node.js applications
- Implement multi-stage Docker builds for production
- Configure Docker networking and environment variables
- Deploy containers to multiple cloud platforms (Heroku, AWS ECS, Azure ACI)
- Set up automated CI/CD pipelines for container deployment
- Implement container health checks and monitoring
- Apply Docker security best practices
- Use Docker Compose for local development

## 📚 Prerequisites

- Basic understanding of Node.js and Express.js
- Familiarity with command line operations
- Docker installed on your local machine
- Cloud platform account (AWS, Azure, or Heroku)
- Git for version control

## 🏗️ Lab Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Development   │    │   Docker Image   │    │  Cloud Platform │
│   Environment   │───▶│    Registry      │───▶│   Deployment    │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   Local Testing            Image Storage         Production App
```

## 📝 Instructions

### Part 1: Application Setup and Dockerization

#### Exercise 1: Create a Sample Node.js Application

1. **Initialize the project**

   ```bash
   mkdir docker-deployment-lab
   cd docker-deployment-lab
   npm init -y
   ```

2. **Install dependencies**

   ```bash
   npm install express helmet cors compression morgan
   npm install --save-dev nodemon
   ```

3. **Create a basic Express server** (`app.js`)

   - Implement health check endpoints
   - Add middleware for security and logging
   - Include environment configuration
   - Add graceful shutdown handling

4. **Test the application locally**
   ```bash
   npm start
   curl http://localhost:3000/health
   ```

#### Exercise 2: Create Production-Ready Dockerfile

1. **Write a multi-stage Dockerfile**

   - Use official Node.js Alpine image for smaller size
   - Implement build and production stages
   - Copy only necessary files
   - Run as non-root user for security
   - Set proper labels and metadata

2. **Create .dockerignore file**

   - Exclude development files
   - Ignore version control files
   - Skip unnecessary directories

3. **Build the Docker image**

   ```bash
   docker build -t node-docker-app:latest .
   docker images
   ```

4. **Run and test the container locally**
   ```bash
   docker run -p 3000:3000 node-docker-app:latest
   docker ps
   ```

#### Exercise 3: Advanced Docker Configuration

1. **Add health check to Dockerfile**

   - Implement HTTP health check
   - Configure check intervals and timeouts
   - Test health check functionality

2. **Create docker-compose.yml for development**

   - Set up application service
   - Add PostgreSQL database service
   - Configure environment variables
   - Set up volume mounting for development

3. **Test with Docker Compose**
   ```bash
   docker-compose up -d
   docker-compose logs
   docker-compose down
   ```

#### Exercise 4: Container Optimization

1. **Optimize image size**

   - Use multi-stage builds effectively
   - Remove unnecessary packages
   - Combine RUN commands
   - Use .dockerignore properly

2. **Implement security best practices**

   - Run as non-root user
   - Use specific Node.js version
   - Scan for vulnerabilities
   - Set resource limits

3. **Add build arguments and environment variables**
   - Configure build-time variables
   - Set runtime environment variables
   - Handle secrets securely

### Part 2: Container Registry and CI/CD

#### Exercise 5: Push to Container Registry

1. **Set up Docker Hub repository**

   - Create Docker Hub account
   - Create public repository
   - Configure authentication

2. **Tag and push image**

   ```bash
   docker tag node-docker-app:latest username/node-docker-app:latest
   docker push username/node-docker-app:latest
   ```

3. **Set up automated builds**
   - Connect GitHub repository
   - Configure build triggers
   - Set up build hooks

#### Exercise 6: GitHub Actions CI/CD Pipeline

1. **Create GitHub Actions workflow**

   - Set up build and test stages
   - Implement Docker image building
   - Add security scanning
   - Configure multi-platform builds

2. **Set up deployment automation**
   - Configure deployment to staging
   - Implement production deployment
   - Add rollback capabilities

### Part 3: Cloud Platform Deployment

#### Exercise 7: Heroku Container Deployment

1. **Set up Heroku CLI and login**

   ```bash
   heroku login
   heroku container:login
   ```

2. **Create Heroku application**

   ```bash
   heroku create your-app-name
   ```

3. **Deploy container to Heroku**

   ```bash
   heroku container:push web
   heroku container:release web
   ```

4. **Configure environment variables**

   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set PORT=80
   ```

5. **Test deployment and monitor logs**
   ```bash
   heroku open
   heroku logs --tail
   ```

#### Exercise 8: AWS ECS Deployment

1. **Set up AWS CLI and configure credentials**

   ```bash
   aws configure
   ```

2. **Create ECR repository**

   ```bash
   aws ecr create-repository --repository-name node-docker-app
   ```

3. **Push image to ECR**

   ```bash
   aws ecr get-login-password | docker login --username AWS --password-stdin [account-id].dkr.ecr.[region].amazonaws.com
   docker tag node-docker-app:latest [account-id].dkr.ecr.[region].amazonaws.com/node-docker-app:latest
   docker push [account-id].dkr.ecr.[region].amazonaws.com/node-docker-app:latest
   ```

4. **Create ECS cluster and service**

   - Set up task definition
   - Configure service with load balancer
   - Set up auto-scaling policies

5. **Deploy and monitor**
   - Verify deployment status
   - Check application logs
   - Test application endpoints

#### Exercise 9: Azure Container Instances Deployment

1. **Set up Azure CLI and login**

   ```bash
   az login
   ```

2. **Create resource group**

   ```bash
   az group create --name docker-lab-rg --location eastus
   ```

3. **Create container registry**

   ```bash
   az acr create --resource-group docker-lab-rg --name dockerlabreg --sku Basic
   ```

4. **Push image to Azure Container Registry**

   ```bash
   az acr login --name dockerlabreg
   docker tag node-docker-app:latest dockerlabreg.azurecr.io/node-docker-app:latest
   docker push dockerlabreg.azurecr.io/node-docker-app:latest
   ```

5. **Deploy to Azure Container Instances**
   ```bash
   az container create \
     --resource-group docker-lab-rg \
     --name node-docker-app \
     --image dockerlabreg.azurecr.io/node-docker-app:latest \
     --dns-name-label node-docker-app-unique \
     --ports 3000
   ```

### Part 4: Monitoring and Maintenance

#### Exercise 10: Container Monitoring and Logging

1. **Set up application monitoring**

   - Implement health check endpoints
   - Add metrics collection
   - Configure log aggregation

2. **Monitor container performance**

   - Track CPU and memory usage
   - Monitor network traffic
   - Set up alerting

3. **Implement log management**
   - Configure structured logging
   - Set up log rotation
   - Integrate with cloud logging services

## 📋 Deliverables

### Required Submissions

1. **Dockerfile and Configuration Files**

   - Production-ready Dockerfile
   - docker-compose.yml for development
   - .dockerignore file
   - Environment configuration files

2. **Application Code**

   - Complete Node.js application
   - Health check endpoints
   - Error handling middleware
   - Configuration management

3. **CI/CD Pipeline**

   - GitHub Actions workflow
   - Deployment scripts
   - Configuration for multiple environments

4. **Cloud Deployment Evidence**

   - Screenshots of successful deployments
   - Application URLs for each platform
   - Monitoring dashboards
   - Performance metrics

5. **Documentation**
   - Deployment instructions for each platform
   - Troubleshooting guide
   - Performance optimization notes
   - Security considerations

### Bonus Challenges

- **Container Orchestration**: Deploy using Kubernetes
- **Blue-Green Deployment**: Implement zero-downtime deployment
- **Multi-Region Deployment**: Deploy to multiple regions
- **Container Scanning**: Integrate security vulnerability scanning
- **Performance Testing**: Load test containerized application

## 🔍 Testing Checklist

### Local Testing

- [ ] Application starts successfully in container
- [ ] Health check endpoints respond correctly
- [ ] Environment variables are properly configured
- [ ] Container logs are accessible
- [ ] Resource usage is within acceptable limits

### Cloud Platform Testing

- [ ] Application is accessible via public URL
- [ ] SSL/TLS certificates are properly configured
- [ ] Auto-scaling works as expected
- [ ] Monitoring and alerting are functional
- [ ] Backup and recovery procedures are tested

### Security Testing

- [ ] Container runs as non-root user
- [ ] No sensitive data in image layers
- [ ] Security scanning passes without critical issues
- [ ] Network access is properly restricted
- [ ] Secrets management is implemented correctly

## 🚨 Common Issues and Solutions

### Build Issues

- **Problem**: Large image size
- **Solution**: Use multi-stage builds, Alpine images, and proper .dockerignore

### Runtime Issues

- **Problem**: Container exits immediately
- **Solution**: Check application logs, verify entry point, ensure proper signal handling

### Deployment Issues

- **Problem**: Service unavailable after deployment
- **Solution**: Verify port configuration, check health checks, review security groups

### Performance Issues

- **Problem**: Slow application response
- **Solution**: Optimize container resources, implement caching, check network configuration

## 📚 Learning Resources

### Essential Documentation

- [Docker Documentation](https://docs.docker.com/) - Official Docker documentation
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/) - Development best practices
- [Node.js Docker Guide](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/) - Official Node.js containerization guide
- [Multi-stage Builds](https://docs.docker.com/develop/dev-best-practices/#use-multi-stage-builds) - Advanced Docker techniques

### Cloud Platform Resources

- [Heroku Container Registry](https://devcenter.heroku.com/articles/container-registry-and-runtime) - Heroku container deployment
- [AWS ECS Documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/docker-basics.html) - Amazon ECS guide
- [Azure Container Instances](https://learn.microsoft.com/en-us/azure/container-instances/) - Azure ACI documentation
- [Google Cloud Run](https://cloud.google.com/run/docs) - Google Cloud container platform

### Security and Best Practices

- [Docker Security](https://docs.docker.com/engine/security/) - Container security guidelines
- [OWASP Container Security](https://owasp.org/www-project-container-security/) - Security best practices
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker) - Security benchmarking

### Monitoring and Observability

- [Container Monitoring Best Practices](https://docs.docker.com/config/containers/logging/) - Logging configuration
- [Prometheus Monitoring](https://prometheus.io/docs/guides/node-exporter/) - Metrics collection
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/) - Visualization

## 🎓 Assessment Criteria

### Technical Implementation (40%)

- Dockerfile follows best practices and security guidelines
- Application is properly containerized and functional
- Multi-stage builds are implemented effectively
- Container optimization techniques are applied

### Cloud Deployment (30%)

- Successful deployment to at least two cloud platforms
- Proper configuration of environment variables and secrets
- Implementation of health checks and monitoring
- Evidence of successful application access

### CI/CD Pipeline (20%)

- Automated build and deployment pipeline
- Proper testing integration
- Security scanning implementation
- Multiple environment support

### Documentation and Best Practices (10%)

- Clear deployment instructions
- Troubleshooting documentation
- Security considerations documented
- Performance optimization notes

## 🔄 Next Steps

After completing this lab, consider exploring:

1. **Container Orchestration**: Learn Kubernetes for complex deployments
2. **Service Mesh**: Implement Istio or Linkerd for microservices
3. **Infrastructure as Code**: Use Terraform or CloudFormation
4. **Advanced Monitoring**: Implement distributed tracing
5. **Container Security**: Advanced security scanning and policies

## 💡 Pro Tips

- Always use specific version tags instead of `latest` in production
- Implement proper health checks for container orchestration
- Use environment variables for configuration, never hardcode values
- Regular security scanning should be part of your CI/CD pipeline
- Monitor container resource usage and set appropriate limits
- Keep container images small and focused on single responsibility
- Implement graceful shutdown handling for clean deployments

---

**🎯 Success Metrics**: Upon completion, you should have a fully containerized Node.js application deployed to multiple cloud platforms with automated CI/CD pipelines and comprehensive monitoring.
