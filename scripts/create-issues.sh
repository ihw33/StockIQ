#!/bin/bash

# StockIQ GitHub Issues Creation Script

echo "Creating Foundation Issues (Week 1-2)..."

# F01-F05: Project Setup
gh issue create --title "Setup Next.js project with TypeScript" \
  --body "Initialize Next.js 14 project with TypeScript, Tailwind CSS, and App Router" \
  --label "P0-Critical,frontend" \
  --milestone 1 \
  -R ihw33/StockIQ

gh issue create --title "Configure ESLint, Prettier, and Husky" \
  --body "Setup code quality tools: ESLint, Prettier, and Git hooks with Husky" \
  --label "P1-High,frontend" \
  --milestone 1 \
  -R ihw33/StockIQ

# F06-F09: Database & Auth
gh issue create --title "Setup Supabase project and authentication" \
  --body "Create Supabase project, configure authentication, and setup database schema" \
  --label "P0-Critical,backend" \
  --milestone 1 \
  -R ihw33/StockIQ

gh issue create --title "Implement authentication pages" \
  --body "Create login, signup, and password reset pages with Supabase Auth" \
  --label "P0-Critical,frontend" \
  --milestone 1 \
  -R ihw33/StockIQ

# F10-F13: UI Components
gh issue create --title "Create base layout components" \
  --body "Implement Header, Sidebar, Footer, and main layout structure" \
  --label "P0-Critical,frontend" \
  --milestone 1 \
  -R ihw33/StockIQ

gh issue create --title "Setup shadcn/ui component library" \
  --body "Install and configure shadcn/ui components for the project" \
  --label "P0-Critical,frontend" \
  --milestone 1 \
  -R ihw33/StockIQ

echo "Creating Core Data Integration Issues (Week 3-4)..."

# D01-D05: API Providers
gh issue create --title "Design and implement Provider Interface pattern" \
  --body "Create abstract interface for multiple stock data providers" \
  --label "P0-Critical,backend" \
  --milestone 2 \
  -R ihw33/StockIQ

gh issue create --title "Integrate Korea Investment Securities API" \
  --body "Implement KIS API provider for real-time Korean stock data" \
  --label "P0-Critical,backend" \
  --milestone 2 \
  -R ihw33/StockIQ

# D09-D12: News System
gh issue create --title "Setup news collection system" \
  --body "Integrate Naver News API and implement news collection scheduler" \
  --label "P0-Critical,backend" \
  --milestone 2 \
  -R ihw33/StockIQ

gh issue create --title "Configure Bull Queue with Redis" \
  --body "Setup job queue system for background tasks using Bull and Upstash Redis" \
  --label "P0-Critical,backend" \
  --milestone 2 \
  -R ihw33/StockIQ

# D15-D18: Dashboard
gh issue create --title "Develop dashboard page" \
  --body "Create main dashboard with watchlist cards and market overview" \
  --label "P0-Critical,frontend" \
  --milestone 2 \
  -R ihw33/StockIQ

gh issue create --title "Implement stock detail page" \
  --body "Create stock detail page with charts and real-time data" \
  --label "P0-Critical,frontend" \
  --milestone 2 \
  -R ihw33/StockIQ

echo "Creating AI Intelligence Issues (Week 5-6)..."

# A01-A05: AI Integration
gh issue create --title "Integrate Claude API for news summarization" \
  --body "Setup Claude API and implement news summarization engine" \
  --label "P0-Critical,AI,backend" \
  --milestone 3 \
  -R ihw33/StockIQ

gh issue create --title "Implement AI prompt templates" \
  --body "Create multi-level prompt system for different summarization needs" \
  --label "P0-Critical,AI" \
  --milestone 3 \
  -R ihw33/StockIQ

gh issue create --title "Build AI cost management system" \
  --body "Implement cost tracking and limiting for AI API usage" \
  --label "P0-Critical,AI,backend" \
  --milestone 3 \
  -R ihw33/StockIQ

# A13-A17: Smart Notes
gh issue create --title "Create smart note editor" \
  --body "Implement markdown-based note editor with auto-save" \
  --label "P0-Critical,frontend" \
  --milestone 3 \
  -R ihw33/StockIQ

gh issue create --title "Integrate TradingView charts" \
  --body "Add TradingView widget for advanced charting capabilities" \
  --label "P0-Critical,frontend" \
  --milestone 3 \
  -R ihw33/StockIQ

echo "Creating User Experience Issues (Week 7-8)..."

# U01-U04: Alerts
gh issue create --title "Implement price alert system" \
  --body "Create price alerts with email notifications" \
  --label "P0-Critical,backend" \
  --milestone 4 \
  -R ihw33/StockIQ

# U05-U07: Export
gh issue create --title "Add export functionality" \
  --body "Implement PDF and Excel export features for notes and data" \
  --label "P1-High,frontend" \
  --milestone 4 \
  -R ihw33/StockIQ

# U13-U17: Mobile
gh issue create --title "Optimize for mobile devices" \
  --body "Ensure responsive design and PWA support" \
  --label "P0-Critical,frontend" \
  --milestone 4 \
  -R ihw33/StockIQ

# U18-U20: Performance
gh issue create --title "Performance optimization" \
  --body "Implement code splitting, lazy loading, and image optimization" \
  --label "P1-High,frontend" \
  --milestone 4 \
  -R ihw33/StockIQ

echo "Creating Testing & Documentation Issues..."

gh issue create --title "Write comprehensive tests" \
  --body "Create unit tests, integration tests, and E2E tests" \
  --label "P1-High" \
  --milestone 4 \
  -R ihw33/StockIQ

gh issue create --title "API documentation" \
  --body "Document all API endpoints and create developer guide" \
  --label "P0-Critical" \
  --milestone 4 \
  -R ihw33/StockIQ

echo "Done! Created core issues for StockIQ project"