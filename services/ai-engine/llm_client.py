import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
import anthropic
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
            *   **Action**: Watch NVDA for breakout above .
            """
        elif "analyze" in user_text.lower():
            return "**[Mock Analysis]** The stock shows strong consolidation patterns. RSI is neutral (50). Recommended Action: Wait for breakout."
        else:
            return f"**[Mock Response]** Received: {user_text[:50]}..."

class LLMClient:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.novita_api_key = os.getenv("NOVITA_API_KEY")
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
        self.use_mock = False 

        # Initialize Anthropic Claude if API key is available
        if self.anthropic_api_key:
            try:
                self.claude_llm = ChatAnthropic(
                    model="claude-3-5-sonnet-20240620",
                    anthropic_api_key=self.anthropic_api_key,
                    temperature=0.7,
                    max_retries=2
                )
            except Exception as e:
                print(f"Error initializing Anthropic LLM: {e}")

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
        
        if not self.api_key and not hasattr(self, "claude_llm"):
            print("Warning: Neither GEMINI_API_KEY nor ANTHROPIC_API_KEY found. Switching to Mock Mode.")
            self.use_mock = True
        elif self.api_key:
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
                if not hasattr(self, "claude_llm"):
                    print(f"Error initializing Gemini LLM: {e}. Switching to Mock Mode.")
                    self.use_mock = True
                else:
                    print(f"Error initializing Gemini LLM: {e}. Using Claude as primary.")

    async def a_analyze_text(self, system_prompt: str, user_text: str, model: str = "claude") -> str:
        """
        Async version for FastAPI integration with model selection.
        """
        if self.use_mock:
            mock = MockLLMClient()
            return await mock.a_analyze_text(system_prompt, user_text)

        # Model selection logic
        client = getattr(self, "llm", None) # Default fallback
        
        if model in ["glm", "prometheus"]:
            if hasattr(self, "novita_llm"):
                client = self.novita_llm
            else:
                print(f"Warning: {model} requested but Novita client not initialized. Using Gemini.")
        elif model in ["claude", "atlas"]:
            if hasattr(self, "claude_llm"):
                client = self.claude_llm
            else:
                print(f"Warning: {model} requested but Claude client not initialized. Using Gemini.")
        
        if client is None:
             if hasattr(self, "claude_llm"):
                 client = self.claude_llm
             elif hasattr(self, "llm"):
                 client = self.llm
             else:
                 mock = MockLLMClient()
                 return await mock.a_analyze_text(system_prompt, user_text)

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
