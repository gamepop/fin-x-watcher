#!/bin/bash
# Financial Sentinel - Backend Restart Script
# Restarts the backend server using Python 3.12 virtual environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔄 Restarting Financial Sentinel Backend..."
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Error: Virtual environment not found!"
    echo "   Run: python3.12 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Stop existing backend
echo "Stopping existing backend..."
if [ -f "backend.pid" ]; then
    OLD_PID=$(cat backend.pid)
    if kill -0 "$OLD_PID" 2>/dev/null; then
        kill "$OLD_PID" 2>/dev/null || true
        echo "✓ Stopped process $OLD_PID"
    fi
    rm -f backend.pid
fi

# Kill any other backend processes
pkill -f "python.*api_server" 2>/dev/null || true
pkill -f "uvicorn.*api_server" 2>/dev/null || true

# Free port 8000
lsof -ti:8000 | xargs kill -9 2>/dev/null || true

sleep 2

# Start backend with virtual environment
echo "Starting backend with Python 3.12..."
source venv/bin/activate

# Verify Python version
PYTHON_VERSION=$(python --version)
echo "Using: $PYTHON_VERSION"

# Start the server
python api_server.py > backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > backend.pid

sleep 3

# Verify it's running
if kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "✓ Backend started successfully (PID: $BACKEND_PID)"
    echo "📝 Logs: $SCRIPT_DIR/backend.log"
    echo "🌐 URL: http://localhost:8000"
    echo ""
    
    # Test health endpoint
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Health check passed!"
        echo ""
        echo "View logs: tail -f backend.log"
    else
        echo "⚠️  Backend started but health check failed. Check logs: tail -f backend.log"
    fi
else
    echo "❌ Backend failed to start. Check logs: tail -f backend.log"
    exit 1
fi

