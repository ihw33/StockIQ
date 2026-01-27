import asyncio
import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from strategies.morning import MorningIntelligence

async def test_morning_strategy():
    print("--- Testing Morning Intelligence Strategy ---")
    
    strategy = MorningIntelligence()
    result = await strategy.generate_briefing()
    
    print("\n[Result Status]:", result['status'])
    print("\n[Generated Briefing]:")
    print("---------------------------------------------------")
    print(result['briefing_content'])
    print("---------------------------------------------------")

if __name__ == "__main__":
    asyncio.run(test_morning_strategy())
