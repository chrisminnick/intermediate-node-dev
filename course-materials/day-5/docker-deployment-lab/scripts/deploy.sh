#!/bin/bash

# ==============================================================================
# Docker Deployment Lab - Deployment Scripts
# ==============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="node-docker-app"
CONTAINER_NAME="docker-lab-container"
PORT=3000
NETWORK_NAME="docker-lab-network"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    log_success "Docker is running"
}

# Clean up existing containers and networks
cleanup() {
    log_info "Cleaning up existing containers and networks..."
    
    # Stop and remove container if exists
    if docker ps -a --format 'table {{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_info "Stopping and removing existing container: ${CONTAINER_NAME}"
        docker stop ${CONTAINER_NAME} >/dev/null 2>&1 || true
        docker rm ${CONTAINER_NAME} >/dev/null 2>&1 || true
    fi
    
    # Remove network if exists
    if docker network ls --format 'table {{.Name}}' | grep -q "^${NETWORK_NAME}$"; then
        log_info "Removing existing network: ${NETWORK_NAME}"
        docker network rm ${NETWORK_NAME} >/dev/null 2>&1 || true
    fi
}

# Build Docker image
build_image() {
    log_info "Building Docker image: ${IMAGE_NAME}:latest"
    
    if docker build -t ${IMAGE_NAME}:latest \
        --build-arg NODE_ENV=production \
        --build-arg VERSION=$(date +%Y%m%d-%H%M%S) \
        --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
        --build-arg VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown") \
        .; then
        log_success "Docker image built successfully"
    else
        log_error "Failed to build Docker image"
        exit 1
    fi
}

# Create Docker network
create_network() {
    log_info "Creating Docker network: ${NETWORK_NAME}"
    docker network create ${NETWORK_NAME} >/dev/null 2>&1 || true
    log_success "Docker network created"
}

# Run container
run_container() {
    log_info "Running Docker container: ${CONTAINER_NAME}"
    
    docker run -d \
        --name ${CONTAINER_NAME} \
        --network ${NETWORK_NAME} \
        -p ${PORT}:3000 \
        -e NODE_ENV=production \
        -e PORT=3000 \
        -e HOST=0.0.0.0 \
        --restart unless-stopped \
        --health-cmd="node healthcheck.js" \
        --health-interval=30s \
        --health-timeout=10s \
        --health-retries=3 \
        --health-start-period=40s \
        ${IMAGE_NAME}:latest
    
    log_success "Container started successfully"
}

# Wait for container to be healthy
wait_for_health() {
    log_info "Waiting for container to be healthy..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        local health_status=$(docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_NAME} 2>/dev/null || echo "unknown")
        
        case $health_status in
            "healthy")
                log_success "Container is healthy!"
                return 0
                ;;
            "unhealthy")
                log_error "Container is unhealthy"
                docker logs ${CONTAINER_NAME} --tail 20
                exit 1
                ;;
            "starting"|"unknown")
                log_info "Container health status: ${health_status} (attempt ${attempt}/${max_attempts})"
                sleep 5
                ;;
        esac
        
        attempt=$((attempt + 1))
    done
    
    log_error "Container failed to become healthy within the timeout period"
    docker logs ${CONTAINER_NAME} --tail 20
    exit 1
}

# Test the deployed application
test_application() {
    log_info "Testing the deployed application..."
    
    local base_url="http://localhost:${PORT}"
    
    # Test health endpoint
    if curl -f -s "${base_url}/health" >/dev/null; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
        exit 1
    fi
    
    # Test main endpoint
    if curl -f -s "${base_url}/" | grep -q "Welcome to Docker Deployment Lab"; then
        log_success "Main endpoint test passed"
    else
        log_error "Main endpoint test failed"
        exit 1
    fi
    
    # Test API endpoint
    if curl -f -s "${base_url}/api/info" | grep -q "Docker Deployment Lab"; then
        log_success "API endpoint test passed"
    else
        log_error "API endpoint test failed"
        exit 1
    fi
    
    log_success "All tests passed!"
}

# Show container information
show_info() {
    log_info "Container Information:"
    echo "===================="
    docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    
    log_info "Application URLs:"
    echo "Main application: http://localhost:${PORT}"
    echo "Health check: http://localhost:${PORT}/health"
    echo "API info: http://localhost:${PORT}/api/info"
    echo ""
    
    log_info "Useful commands:"
    echo "View logs: docker logs ${CONTAINER_NAME} -f"
    echo "Stop container: docker stop ${CONTAINER_NAME}"
    echo "Start container: docker start ${CONTAINER_NAME}"
    echo "Remove container: docker rm ${CONTAINER_NAME}"
    echo "Execute shell: docker exec -it ${CONTAINER_NAME} sh"
}

# Main deployment function
deploy() {
    log_info "Starting Docker deployment..."
    
    check_docker
    cleanup
    build_image
    create_network
    run_container
    wait_for_health
    test_application
    show_info
    
    log_success "Deployment completed successfully! 🚀"
}

# Script usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  deploy     - Full deployment (default)"
    echo "  build      - Build Docker image only"
    echo "  run        - Run container only"
    echo "  test       - Test application endpoints"
    echo "  cleanup    - Clean up containers and networks"
    echo "  logs       - Show container logs"
    echo "  status     - Show container status"
    echo "  help       - Show this help message"
    echo ""
}

# Command handling
case "${1:-deploy}" in
    "deploy")
        deploy
        ;;
    "build")
        check_docker
        build_image
        ;;
    "run")
        check_docker
        cleanup
        create_network
        run_container
        wait_for_health
        show_info
        ;;
    "test")
        test_application
        ;;
    "cleanup")
        cleanup
        log_success "Cleanup completed"
        ;;
    "logs")
        docker logs ${CONTAINER_NAME} -f
        ;;
    "status")
        docker ps --filter "name=${CONTAINER_NAME}"
        docker inspect ${CONTAINER_NAME} --format='Health: {{.State.Health.Status}}'
        ;;
    "help")
        usage
        ;;
    *)
        log_error "Unknown command: $1"
        usage
        exit 1
        ;;
esac