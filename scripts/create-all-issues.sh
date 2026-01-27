#!/bin/bash

echo "🚀 Creating StockIQ GitHub Issues..."

# Foundation Issues (Priority P0)
echo "📦 Creating Foundation Issues..."

gh issue create --title "Configure ESLint, Prettier, and Husky" \
  --body "Setup code quality tools

## Tasks
- [ ] Install and configure ESLint
- [ ] Setup Prettier
- [ ] Configure Husky for pre-commit hooks
- [ ] Add lint-staged

Estimated: 2 hours" \
  --label "P1-High,frontend" \
  -R ihw33/StockIQ

gh issue create --title "Setup Supabase project and authentication" \
  --body "Create Supabase project and configure authentication

## Tasks
- [ ] Create Supabase project
- [ ] Configure Auth settings
- [ ] Setup environment variables
- [ ] Test authentication flow

Estimated: 4 hours" \
  --label "P0-Critical,backend" \
  -R ihw33/StockIQ

gh issue create --title "Design database schema" \
  --body "Create database schema for StockIQ

## Tables to create
- [ ] users
- [ ] watchlist
- [ ] news
- [ ] news_summaries
- [ ] notes
- [ ] price_alerts

Estimated: 3 hours" \
  --label "P0-Critical,backend" \
  -R ihw33/StockIQ

gh issue create --title "Implement authentication pages" \
  --body "Create auth pages with Supabase

## Pages
- [ ] Login page
- [ ] Signup page
- [ ] Password reset page
- [ ] Profile page

Estimated: 6 hours" \
  --label "P0-Critical,frontend" \
  -R ihw33/StockIQ

gh issue create --title "Create base layout components" \
  --body "Build core layout components

## Components
- [ ] Header with navigation
- [ ] Sidebar for desktop
- [ ] Mobile navigation
- [ ] Footer

Estimated: 5 hours" \
  --label "P0-Critical,frontend" \
  -R ihw33/StockIQ

gh issue create --title "Setup shadcn/ui component library" \
  --body "Install and configure shadcn/ui

## Tasks
- [ ] Install shadcn/ui CLI
- [ ] Add essential components
- [ ] Configure theme
- [ ] Test components

Estimated: 2 hours" \
  --label "P0-Critical,frontend" \
  -R ihw33/StockIQ

# Data Integration Issues
echo "📊 Creating Data Integration Issues..."

gh issue create --title "Design Provider Interface pattern" \
  --body "Create abstract interface for data providers

## Tasks
- [ ] Define ITickerProvider interface
- [ ] Create Provider Factory
- [ ] Implement error handling
- [ ] Add fallback mechanism

Estimated: 3 hours" \
  --label "P0-Critical,backend" \
  -R ihw33/StockIQ

gh issue create --title "Integrate Korea Investment Securities API" \
  --body "Implement KIS API provider

## Features
- [ ] Real-time quotes
- [ ] Historical data
- [ ] Company info
- [ ] Market data

Estimated: 6 hours" \
  --label "P0-Critical,backend" \
  -R ihw33/StockIQ

gh issue create --title "Setup news collection system" \
  --body "Implement news aggregation

## Tasks
- [ ] Integrate Naver News API
- [ ] Setup RSS parser
- [ ] Create news scheduler
- [ ] Store in database

Estimated: 6 hours" \
  --label "P0-Critical,backend" \
  -R ihw33/StockIQ

gh issue create --title "Configure Bull Queue with Redis" \
  --body "Setup job queue system

## Tasks
- [ ] Setup Upstash Redis
- [ ] Configure Bull Queue
- [ ] Create job processors
- [ ] Add monitoring

Estimated: 3 hours" \
  --label "P0-Critical,backend" \
  -R ihw33/StockIQ

gh issue create --title "Build dashboard page" \
  --body "Create main dashboard UI

## Features
- [ ] Watchlist cards
- [ ] Market overview
- [ ] News feed
- [ ] Quick stats

Estimated: 6 hours" \
  --label "P0-Critical,frontend" \
  -R ihw33/StockIQ

gh issue create --title "Implement stock detail page" \
  --body "Create stock detail view

## Features
- [ ] Price chart
- [ ] Company info
- [ ] News section
- [ ] Technical indicators

Estimated: 5 hours" \
  --label "P0-Critical,frontend" \
  -R ihw33/StockIQ

# AI Features
echo "🤖 Creating AI Intelligence Issues..."

gh issue create --title "Integrate Claude API" \
  --body "Setup Claude API for AI features

## Tasks
- [ ] Configure API client
- [ ] Setup rate limiting
- [ ] Error handling
- [ ] Cost tracking

Estimated: 3 hours" \
  --label "P0-Critical,AI,backend" \
  -R ihw33/StockIQ

gh issue create --title "Build news summarization engine" \
  --body "Implement AI news summary

## Features
- [ ] Headline filtering
- [ ] 3-line summary
- [ ] Sentiment analysis
- [ ] Keyword extraction

Estimated: 5 hours" \
  --label "P0-Critical,AI" \
  -R ihw33/StockIQ

gh issue create --title "Create prompt template system" \
  --body "Design multi-level prompts

## Templates
- [ ] Headline screening
- [ ] Standard summary
- [ ] Deep analysis
- [ ] Investment insights

Estimated: 4 hours" \
  --label "P0-Critical,AI" \
  -R ihw33/StockIQ

gh issue create --title "Implement AI cost management" \
  --body "Track and limit AI costs

## Features
- [ ] Usage tracking
- [ ] Daily budget limits
- [ ] Model selection logic
- [ ] Alert system

Estimated: 3 hours" \
  --label "P0-Critical,AI,backend" \
  -R ihw33/StockIQ

gh issue create --title "Build smart note editor" \
  --body "Create intelligent note system

## Features
- [ ] Markdown editor
- [ ] Auto-save
- [ ] Templates
- [ ] Note-news linking

Estimated: 5 hours" \
  --label "P0-Critical,frontend" \
  -R ihw33/StockIQ

gh issue create --title "Integrate TradingView charts" \
  --body "Add advanced charting

## Tasks
- [ ] Setup TradingView widget
- [ ] Configure indicators
- [ ] Add drawing tools
- [ ] Save preferences

Estimated: 3 hours" \
  --label "P0-Critical,frontend" \
  -R ihw33/StockIQ

# UX Features
echo "✨ Creating User Experience Issues..."

gh issue create --title "Implement alert system" \
  --body "Create price and news alerts

## Features
- [ ] Price alerts
- [ ] News alerts
- [ ] Email notifications
- [ ] In-app notifications

Estimated: 4 hours" \
  --label "P0-Critical,backend" \
  -R ihw33/StockIQ

gh issue create --title "Add export functionality" \
  --body "Export data and notes

## Formats
- [ ] PDF export
- [ ] Excel download
- [ ] Notion integration
- [ ] CSV export

Estimated: 4 hours" \
  --label "P1-High,frontend" \
  -R ihw33/StockIQ

gh issue create --title "Mobile optimization" \
  --body "Optimize for mobile devices

## Tasks
- [ ] Responsive design
- [ ] Touch gestures
- [ ] PWA setup
- [ ] Offline support

Estimated: 5 hours" \
  --label "P0-Critical,frontend" \
  -R ihw33/StockIQ

gh issue create --title "Performance optimization" \
  --body "Improve app performance

## Tasks
- [ ] Code splitting
- [ ] Lazy loading
- [ ] Image optimization
- [ ] Caching strategy

Estimated: 4 hours" \
  --label "P1-High,frontend" \
  -R ihw33/StockIQ

# Testing & Documentation
echo "📚 Creating Testing & Documentation Issues..."

gh issue create --title "Write tests" \
  --body "Create comprehensive test suite

## Coverage
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests with Playwright
- [ ] API tests

Estimated: 8 hours" \
  --label "P1-High" \
  -R ihw33/StockIQ

gh issue create --title "Create API documentation" \
  --body "Document all endpoints

## Tasks
- [ ] Document REST APIs
- [ ] Add request/response examples
- [ ] Create Postman collection
- [ ] Write integration guide

Estimated: 4 hours" \
  --label "P0-Critical" \
  -R ihw33/StockIQ

gh issue create --title "Write user guide" \
  --body "Create user documentation

## Sections
- [ ] Getting started
- [ ] Feature guides
- [ ] FAQ
- [ ] Troubleshooting

Estimated: 4 hours" \
  --label "P1-High" \
  -R ihw33/StockIQ

echo "✅ Done! Created 25 core issues for StockIQ project"
echo "📊 View issues at: https://github.com/ihw33/StockIQ/issues"