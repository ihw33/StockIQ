import os
import requests
from typing import List, Dict
from datetime import datetime
import json

class AlphaHRCollector:
    def __init__(self):
        self.api_key = os.getenv("PERPLEXITY_API_KEY")
        if self.api_key:
            print(f"[AlphaHRCollector] API Key loaded: {self.api_key[:4]}***")
        else:
            print("[AlphaHRCollector] Warning: PERPLEXITY_API_KEY not found.")
        self.base_url = "https://api.perplexity.ai/chat/completions"
        self.model = "sonar-reasoning-pro"  # As requested in spec

    def search_hr_data(self, company_name: str) -> Dict:
        """
        Uses Perplexity API to search for recent HR/Hiring news and job postings.
        """
        if not self.api_key:
            print("[AlphaHRCollector] Warning: PERPLEXITY_API_KEY not found.")
            # Return mock data if key is missing (for development)
            return self._get_mock_data(company_name)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # Prompt designed to get factual data + citations
        messages = [
            {
                "role": "system",
                "content": "You are an expert HR Data Researcher. Find detailed recruitment status, open positions, and team expansion news."
            },
            {
                "role": "user",
                "content": f"Search for the latest (last 1 week) job postings, recruitment news, and team expansion/restructuring updates for '{company_name}'. Focus on technical roles and new business units. Include citations."
            }
        ]

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.1
        }

        try:
            print(f"[AlphaHRCollector] Searching Perplexity for {company_name}...")
            response = requests.post(self.base_url, json=payload, headers=headers)
            response.raise_for_status()
            
            data = response.json()
            content = data['choices'][0]['message']['content']
            citations = data.get('citations', [])
            
            return {
                "company": company_name,
                "collected_at": datetime.now().isoformat(),
                "raw_content": content,
                "citations": citations,
                "source": "perplexity_api"
            }

        except Exception as e:
            print(f"[AlphaHRCollector] Error searching {company_name}: {e}")
            return self._get_mock_data(company_name)

    def _get_mock_data(self, company_name: str) -> Dict:
        """
        Returns mock data for testing/demo purposes.
        """
        import random
        # Create varied mock content
        templates = [
            f"{company_name} is aggressively hiring for their 'AI Platform' division. Found 15 open positions.",
            f"{company_name} has posted new roles for 'Quantum Computing' research.",
            f"Reports suggest {company_name} is restructuring its mobile division, closing 5 positions.",
            f"{company_name} is looking for a VP of Engineering for their new 'Cloud' initiative."
        ]
        
        content = "\n".join(random.sample(templates, k=2))
        
        return {
            "company": company_name,
            "collected_at": datetime.now().isoformat(),
            "raw_content": f"Mock Search Results for {company_name}:\n{content}",
            "citations": ["https://mock-source.com/news/1"],
            "source": "mock_generator (Demo Mode)"
        }

if __name__ == "__main__":
    # Simple test
    collector = AlphaHRCollector()
    result = collector.search_hr_data("Naver")
    print(json.dumps(result, indent=2, ensure_ascii=False))
