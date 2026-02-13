#!/bin/bash

#===============================================================================
# Faye Portfolio Manager - Development Quickstart
#===============================================================================
# This script sets up and runs the full development environment.
# It starts BOTH the backend API server AND the frontend dev server.
#
# Usage:
#   ./quickstart.sh              # Install deps (if needed) and start both servers
#   ./quickstart.sh --clean      # Clean install (removes node_modules first)
#   ./quickstart.sh --frontend   # Start only the frontend (Vite)
#   ./quickstart.sh --backend    # Start only the backend (Express)
#   ./quickstart.sh --build      # Build for production
#   ./quickstart.sh --help       # Show this help message
#
# Requirements:
#   - Node.js >= 20.0.0
#   - npm >= 10.0.0 (or pnpm)
#
# Architecture:
#   - Backend:  Express API on http://localhost:3000
#   - Frontend: Vite dev server on http://localhost:5173
#   - Frontend proxies /api/* requests to the backend
#===============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print with color
print_status() { echo -e "${BLUE}[*]${NC} $1"; }
print_success() { echo -e "${GREEN}[✓]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[✗]${NC} $1"; }

# Show help
show_help() {
    echo ""
    echo "Faye Portfolio Manager - Development Quickstart"
    echo ""
    echo "Usage: ./quickstart.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --clean      Remove node_modules and do a fresh install"
    echo "  --frontend   Start only the frontend dev server (Vite)"
    echo "  --backend    Start only the backend API server (Express)"
    echo "  --build      Build for production instead of starting dev servers"
    echo "  --help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./quickstart.sh              # Start both frontend and backend"
    echo "  ./quickstart.sh --clean      # Clean install and start both"
    echo "  ./quickstart.sh --frontend   # Start only Vite (assumes backend running)"
    echo "  ./quickstart.sh --backend    # Start only Express API"
    echo "  ./quickstart.sh --build      # Build for production"
    echo ""
    echo "Architecture:"
    echo "  Backend:  http://localhost:3000  (Express API + SQLite)"
    echo "  Frontend: http://localhost:5173  (Vite dev server)"
    echo "  Frontend proxies /api/* to backend automatically"
    echo ""
}

# Check Node.js version
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js >= 20.0.0"
        echo "  Download: https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        print_error "Node.js version must be >= 20.0.0 (found: $(node -v))"
        exit 1
    fi
    print_success "Node.js $(node -v) detected"
}

# Check for package manager
check_package_manager() {
    if command -v pnpm &> /dev/null; then
        PKG_MGR="pnpm"
    elif command -v npm &> /dev/null; then
        PKG_MGR="npm"
    else
        print_error "No package manager found. Please install npm or pnpm."
        exit 1
    fi
    print_success "Using $PKG_MGR as package manager"
}

# Install dependencies
install_deps() {
    if [ ! -d "node_modules" ] || [ "$CLEAN_INSTALL" = true ]; then
        if [ "$CLEAN_INSTALL" = true ] && [ -d "node_modules" ]; then
            print_status "Removing existing node_modules..."
            rm -rf node_modules
        fi
        
        print_status "Installing dependencies..."
        $PKG_MGR install
        print_success "Dependencies installed"
    else
        print_success "Dependencies already installed (use --clean for fresh install)"
    fi
}

# Ensure data directory exists for SQLite
ensure_data_dir() {
    if [ ! -d "data" ]; then
        print_status "Creating data directory for SQLite..."
        mkdir -p data
        print_success "Data directory created"
    fi
}

# Start backend server
start_backend() {
    print_status "Starting backend API server..."
    $PKG_MGR run server
}

# Start frontend dev server
start_frontend() {
    print_status "Starting frontend dev server..."
    $PKG_MGR run dev
}

# Start both servers concurrently
start_dev() {
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Faye Portfolio Manager - Development Environment${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}Backend API:${NC}  http://localhost:3000"
    echo -e "  ${CYAN}Frontend:${NC}     http://localhost:5173  ${YELLOW}← Open this in browser${NC}"
    echo ""
    echo -e "  ${BLUE}Database:${NC}     ./data/portfolio.db (SQLite)"
    echo ""
    echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop both servers"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""

    # Start backend in background, frontend in foreground
    # Use trap to kill backend when script exits
    $PKG_MGR run server &
    BACKEND_PID=$!
    
    # Give backend a moment to start
    sleep 2
    
    # Check if backend started successfully
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend failed to start. Check for errors above."
        exit 1
    fi
    
    print_success "Backend started (PID: $BACKEND_PID)"
    
    # Trap to clean up backend when frontend stops
    trap "echo ''; print_status 'Shutting down...'; kill $BACKEND_PID 2>/dev/null; print_success 'Servers stopped'; exit 0" INT TERM
    
    # Start frontend (this blocks)
    $PKG_MGR run dev
    
    # If frontend exits, kill backend
    kill $BACKEND_PID 2>/dev/null
}

# Build for production
build_prod() {
    print_status "Building for production..."
    $PKG_MGR run build
    print_success "Build complete! Output in ./dist/"
    echo ""
    echo "To run in production mode:"
    echo "  JWT_SECRET=your-secret-here NODE_ENV=production $PKG_MGR run start"
    echo ""
    echo "Or use Docker:"
    echo "  docker-compose up -d"
    echo ""
}

#===============================================================================
# Main
#===============================================================================

CLEAN_INSTALL=false
BUILD_MODE=false
FRONTEND_ONLY=false
BACKEND_ONLY=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --clean)
            CLEAN_INSTALL=true
            shift
            ;;
        --build)
            BUILD_MODE=true
            shift
            ;;
        --frontend)
            FRONTEND_ONLY=true
            shift
            ;;
        --backend)
            BACKEND_ONLY=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $arg"
            show_help
            exit 1
            ;;
    esac
done

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Faye Portfolio Manager - Development Quickstart      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# Run checks
check_node
check_package_manager

# Install dependencies
install_deps

# Ensure data directory exists
ensure_data_dir

# Determine what to start
if [ "$BUILD_MODE" = true ]; then
    build_prod
elif [ "$FRONTEND_ONLY" = true ]; then
    echo ""
    print_warning "Starting frontend only - make sure backend is running separately!"
    echo ""
    start_frontend
elif [ "$BACKEND_ONLY" = true ]; then
    echo ""
    print_warning "Starting backend only - run frontend separately with: $PKG_MGR run dev"
    echo ""
    start_backend
else
    start_dev
fi
