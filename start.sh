#!/bin/bash
# Curalink Quick Start Script

echo "🏥 Starting Curalink AI Medical Research Assistant..."
echo ""

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
  echo "⚠️  MongoDB is not running. Starting MongoDB..."
  mongod --fork --logpath /tmp/mongod.log --dbpath /usr/local/var/mongodb 2>/dev/null || \
  brew services start mongodb-community 2>/dev/null || \
  echo "   Please start MongoDB manually: mongod"
fi

# Check backend .env
if [ ! -f "backend/.env" ]; then
  cp backend/.env.example backend/.env
  echo "⚠️  Created backend/.env - please add your HuggingFace API key!"
fi

echo "🚀 Starting backend on http://localhost:5000"
cd backend && npm run dev &
BACKEND_PID=$!

echo "🎨 Starting frontend on http://localhost:5173"
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Curalink is starting up!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:5000"
echo "   Health:   http://localhost:5000/api/health"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait and cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
