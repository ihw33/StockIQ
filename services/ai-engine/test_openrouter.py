"""
Quick test script for OpenRouter LLM integration
"""
import asyncio
import sys
import os
from dotenv import load_dotenv

# Load environment first
load_dotenv('/Users/m4_macbook/Projects/Stockiq/.env.local')

print(f"🔑 OPENROUTER_API_KEY loaded: {os.getenv('OPENROUTER_API_KEY')[:20]}...")

sys.path.append('/Users/m4_macbook/Projects/Stockiq/services/ai-engine')

from llm_client import LLMClient

async def test_openrouter():
    print("\n🧪 Testing OpenRouter LLM Integration...\n")
    
    client = LLMClient()
    
    # Check which clients are available
    print(f"✅ Has claude_openrouter: {hasattr(client, 'claude_openrouter')}")
    print(f"✅ Has gemini_openrouter: {hasattr(client, 'gemini_openrouter')}")
    print(f"✅ Has gpt4_openrouter: {hasattr(client, 'gpt4_openrouter')}")
    
    system_prompt = "You are a helpful assistant. Answer concisely in Korean."
    user_text = "OpenRouter가 정상 작동하는지 짧게 한 문장으로만 확인해주세요."
    
    print("\n📤 Sending test query...")
    response = await client.a_analyze_text(system_prompt, user_text, model="auto")
    
    print("\n✅ Response:")
    print(response)
    print("\n🎉 OpenRouter test complete!")

if __name__ == "__main__":
    asyncio.run(test_openrouter())
