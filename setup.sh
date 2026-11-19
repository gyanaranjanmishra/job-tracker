#!/bin/bash
# Job Tracker Setup Script for WSL2
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Job Tracker - ATS Optimizer        ║"
echo "║   Setup Script for WSL2              ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Check Node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install it first:"
  echo "   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "   sudo apt-get install -y nodejs"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "❌ Node.js 18+ required. Current: $(node -v)"
  exit 1
fi

echo "✓ Node.js $(node -v) detected"

# Install deps
echo ""
echo "📦 Installing dependencies..."
npm install

# Setup .env.local
if [ ! -f .env.local ] || grep -q "your_api_key_here" .env.local; then
  echo ""
  echo "🔑 Anthropic API Key Setup"
  echo "   Get your key at: https://console.anthropic.com"
  echo ""
  echo "   (Press Enter to skip and run in demo mode with sample data.)"
  read -p "   Paste your API key here: " API_KEY
  cp .env.example .env.local
  sed -i "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$API_KEY|" .env.local
  if [ -n "$API_KEY" ]; then echo "✓ API key saved to .env.local"; else echo "✓ Demo mode (no key set)"; fi
fi

# Create data directory
mkdir -p data
echo "✓ Data directory ready (your jobs/resume stored here)"

echo ""
echo "✅ Setup complete!"
echo ""
echo "▶  Start the app:"
echo "   npm run dev"
echo ""
echo "   Then open: http://localhost:3000"
echo ""
echo "📝 First steps:"
echo "   1. Go to 'My Resume' tab → paste your resume"
echo "   2. Add jobs in 'Pipeline' tab"
echo "   3. Use 'ATS Analyzer' to optimize your resume per job"
echo "   4. Generate cover letters in 'Cover Letter' tab"
echo ""
