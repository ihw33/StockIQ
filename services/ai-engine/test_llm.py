import asyncio
from llm_client import LLMClient

async def test_llm_connection():
    print("--- Testing Gemini API Connection ---")
    try:
        client = LLMClient()
        print("Client initialized. Sending test prompt...")
        
        system_prompt = "You are a helpful AI trading assistant."
        user_prompt = "Say 'Hello, Human! Ready to trade?' if you can hear me."
        
        response = await client.a_analyze_text(system_prompt, user_prompt)
        print(f"\n[AI Response]: {response}")
        
    except Exception as e:
        print(f"\n[FAILED]: {e}")

if __name__ == "__main__":
    asyncio.run(test_llm_connection())
