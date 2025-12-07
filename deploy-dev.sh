#!/bin/bash
# Financial Sentinel - Development Deploy Script
# Deploys backend and frontend in development mode (no build, hot reload)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Financial Sentinel - Development Deploy"
echo "==========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Stop existing services
echo "Stopping existing services..."
pkill -f "python.*api_server" 2>/dev/null || true
pkill -f "next.*dev" 2>/dev/null || true
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2
print_status "Services stopped"
echo ""

# Deploy Backend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Deploying Backend (Dev Mode)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

VENV_CREATED=false
if [ ! -d "venv" ]; then
    print_warning "Virtual environment not found. Creating..."
    python3.12 -m venv venv
    VENV_CREATED=true
    print_status "Virtual environment created"
fi

source venv/bin/activate

# CRITICAL FIX: Always install dependencies, especially if venv was just created
print_status "Installing/updating Python dependencies..."
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt
if [ $? -eq 0 ]; then
    print_status "Backend dependencies installed successfully"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi

# Verify critical dependencies before starting
print_status "Verifying dependencies..."
python -c "import fastapi, google.adk" 2>/dev/null
if [ $? -ne 0 ]; then
    print_error "Critical dependencies missing. Cannot start backend."
    exit 1
fi

python api_server.py > backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > backend.pid
sleep 3
print_status "Backend started (PID: $BACKEND_PID)"
echo ""

# Deploy Frontend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Deploying Frontend (Dev Mode)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd frontend
if [ ! -d "node_modules" ]; then
    print_warning "Frontend dependencies not found. Installing..."
    npm install
    print_status "Frontend dependencies installed"
fi

npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid
sleep 3
print_status "Frontend started (PID: $FRONTEND_PID)"
cd ..

echo ""
echo "✅ Development servers running!"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  Logs: tail -f backend.log frontend.log"
