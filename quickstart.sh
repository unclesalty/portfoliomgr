#!/bin/bash

#===============================================================================
# Faye Portfolio Manager - Development Quickstart
#===============================================================================
# This script sets up and runs the development environment with a single command.
#
# Usage:
#   ./quickstart.sh          # Install deps (if needed) and start dev server
#   ./quickstart.sh --clean  # Clean install (removes node_modules first)
#   ./quickstart.sh --help   # Show this help message
#
# Requirements:
#   - Node.js >= 20.0.0
#   - npm >= 10.0.0 (or pnpm)
#===============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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
    echo "  --clean     Remove node_modules and do a fresh install"
    echo "  --build     Build for production instead of starting dev server"
    echo "  --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./quickstart.sh              # Start development server"
    echo "  ./quickstart.sh --clean      # Clean install and start"
    echo "  ./quickstart.sh --build      # Build for production"
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

# Start development server
start_dev() {
    print_status "Starting development server..."
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Faye Portfolio Manager${NC}"
    echo -e "${GREEN}  Development Server${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "  ${BLUE}Local:${NC}   http://localhost:5173"
    echo -e "  ${BLUE}Network:${NC} http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost"):5173"
    echo ""
    echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop the server"
    echo ""
    
    $PKG_MGR run dev
}

# Build for production
build_prod() {
    print_status "Building for production..."
    $PKG_MGR run build
    print_success "Build complete! Output in ./dist/"
    echo ""
    echo "To preview the production build:"
    echo "  $PKG_MGR run preview"
    echo ""
}

#===============================================================================
# Main
#===============================================================================

CLEAN_INSTALL=false
BUILD_MODE=false

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
echo -e "${BLUE}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Faye Portfolio Manager - Development Quickstart  ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

# Run checks
check_node
check_package_manager

# Install dependencies
install_deps

# Start dev server or build
if [ "$BUILD_MODE" = true ]; then
    build_prod
else
    start_dev
fi
