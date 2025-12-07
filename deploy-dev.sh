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
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
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

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3.12 -m venv venv
fi

source venv/bin/activate
python api_server.py > backend.log 2>&1 &
echo $! > backend.pid
sleep 3
print_status "Backend started (PID: $(cat backend.pid))"
echo ""

# Deploy Frontend
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Deploying Frontend (Dev Mode)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi

npm run dev > ../frontend.log 2>&1 &
echo $! > ../frontend.pid
sleep 3
print_status "Frontend started (PID: $(cat ../frontend.pid))"
cd ..

echo ""
echo "✅ Development servers running!"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  Logs: tail -f backend.log frontend.log"

