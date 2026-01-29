import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class MockLLMClient:
    """
    Simulates LLM responses for development when API is unavailable.
    """
    def __init__(self):
        print("[System] Using Mock LLM Client (Development Mode)")

    async def a_analyze_text(self, system_prompt: str, user_text: str) -> str:
        # Return context-aware mock responses based on keywords
        if "market movers" in user_text.lower() or "briefing" in system_prompt.lower():
            return """
            **[Mock AI Morning Briefing]**
            *   **Market Sentiment**: Neutral to Bullish.
            *   **Key Driver**: Inflation data expectation.
            *   **Action**: Watch NVDA for breakout above $150.
            """
        elif "analyze" in user_text.lower():
            return "**[Mock Analysis]** The stock shows strong consolidation patterns. RSI is neutral (50). Recommended Action: Wait for breakout."
        else:
            return f"**[Mock Response]** Received: {user_text[:50]}..."

class LLMClient:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.novita_api_key = os.getenv("NOVITA_API_KEY")
        self.use_mock = False 

        # Initialize Novita LLM if API key is available
        if self.novita_api_key:
            try:
                self.novita_llm = ChatOpenAI(
                    model="glm-4",
                    api_key=self.novita_api_key,
                    base_url="https://api.novita.ai/v3/openai"
                )
            except Exception as e:
                print(f"Error initializing Novita LLM: {e}")
        
        if not self.api_key:
            print("Warning: GEMINI_API_KEY not found. Switching to Mock Mode.")
            self.use_mock = True
        else:
            try:
                # Initialize Gemini Pro
                self.llm = ChatGoogleGenerativeAI(
                    model="gemini-pro", 
                    google_api_key=self.api_key,
                    temperature=0.7,
                    convert_system_message_to_human=True,
                    max_retries=0
                )
            except Exception as e:
                print(f"Error initializing real LLM: {e}. Switching to Mock Mode.")
                self.use_mock = True

    async def a_analyze_text(self, system_prompt: str, user_text: str, model: str = "claude") -> str:
        """
        Async version for FastAPI integration with model selection.
        """
        if self.use_mock:
            mock = MockLLMClient()
            return await mock.a_analyze_text(system_prompt, user_text)

        # Model selection logic
        client = self.llm # Default fallback
        
        if model in ["glm", "prometheus"]:
            if hasattr(self, "novita_llm"):
                client = self.novita_llm
            else:
                print(f"Warning: {model} requested but Novita client not initialized. Using Gemini.")
        elif model in ["claude", "atlas"]:
            if hasattr(self, "claude_llm"):
                client = self.claude_llm
            else:
                # Fallback to Gemini as "before"
                pass

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_text)
        ]
        try:
            response = await client.ainvoke(messages)
            return response.content
        except Exception as e:
            print(f"LLM API Error ({model}): {e}. Falling back to Mock.")
            mock = MockLLMClient()
            return await mock.a_analyze_text(system_prompt, user_text)
