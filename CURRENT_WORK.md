# StockIQ - Current Work Context

> **Last Updated**: 2026-02-05 10:56 (Mac)
> **Active Console**: Mac Terminal

---

## 🎯 Current Focus

**Issue**: #10 - Kiwoom API & LLM Integration  
**Branch**: `feature/issue-10-kiwoom-llm`  
**Status**: 🚧 In Progress  
**Priority**: P0

### Quick Summary
Kiwoom API URL을 환경변수로 지원하고, LLM 클라이언트에 Claude(Anthropic)와 Novita(GLM-4) 지원을 추가하는 작업입니다.
현재 로컬에서 코드는 수정되었으며, 이를 Feature Branch로 분리하여 관리합니다.

### Modified Files
- `lib/providers/kiwoom-rest-provider.ts`: API URL 환경변수 처리
- `lib/providers/stock-service.ts`: baseUrl 환경변수 전달
- `services/ai-engine/llm_client.py`: Claude & Novita 지원 추가, Fallback 로직 개선
- `services/ai-engine/requirements.txt`: anthropic 패키지 추가

---

## 📋 Next Steps

1. [x] Create `CURRENT_WORK.md`
2. [ ] Switch to feature branch `feature/issue-10-kiwoom-llm`
3. [ ] Commit changes
4. [ ] Push to remote
5. [ ] Verify auto-context loading in new session

---

## 💡 Context for AI Agent

**When AI starts**: 
- Read this file first
- Checkout branch: `feature/issue-10-kiwoom-llm`
- Check git status for uncommitted changes

**GitHub Issue**: https://github.com/ihw33/StockIQ/issues/10
