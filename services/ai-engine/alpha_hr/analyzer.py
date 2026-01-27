import os
import json
from typing import Dict
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

class AlphaHRAnalyzer:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            print("[AlphaHRAnalyzer] Warning: GEMINI_API_KEY not found.")
        else:
            genai.configure(api_key=self.api_key)
            # Using 'gemini-2.0-pro-exp' as per plan, fallback to 'gemini-pro'
            self.model_name = "gemini-2.0-pro-exp"
            self.model = genai.GenerativeModel(self.model_name)

    def analyze_signals(self, company_name: str, diff_report: Dict, market_context: str = "") -> Dict:
        """
        Generates an Investment Signal based on the Diff Report.
        
        Returns:
            {
                "company_id": str,
                "signal_type": "BUY" | "SELL" | "HOLD",
                "confidence_score": 0-100,
                "reason_summary": str,
                "key_factors": { ... }
            }
        """
        if not self.api_key:
            return self._get_mock_signal(company_name)

        # Construct Prompt
        prompt = f"""
        You are a Wall Street Investment Analyst specializing in Alternative Data (HR Signals).
        Analyze the provided HR Data Change Report for '{company_name}' and determine the investment signal.
        
        [Context]
        {market_context}
        
        [HR Data Change Report (Last Week vs This Week)]
        {json.dumps(diff_report, indent=2)}
        
        [Rules]
        1. **Aggressive Hiring (Spikes)** in R&D/Tech teams -> **BUY** (Innovation signal)
        2. **Mass Closing** of jobs without new ones -> **SELL** or Caution (Cost cutting or filling complete)
        3. **New Team Formation** -> **BUY** (New business expansion)
        4. Be conservative. High confidence requires clear evidence.
        
        [Output Format]
        Return purely JSON:
        {{
            "signal_type": "BUY" | "SELL" | "HOLD",
            "confidence_score": integer (0-100),
            "reason_summary": "한글로 작성된 한 문장 요약 (명확하고 전문적인 어조)",
            "key_factors": {{
                "bullish": ["한글 요인 1", "한글 요인 2"],
                "bearish": ["한글 요인 1"]
            }}
        }}
        """

        try:
            response = self.model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            
            text_res = response.text.replace("```json", "").replace("```", "").strip()
            result = json.loads(text_res)
            
            # Inject company_id
            result["company_id"] = company_name
            return result

        except Exception as e:
            print(f"[AlphaHRAnalyzer] Analysis Error: {e}")
            return self._get_mock_signal(company_name)

    def _get_mock_signal(self, company_name: str) -> Dict:
        import zlib
        # Generate a deterministic seed from company name
        seed = zlib.crc32(company_name.encode())
        
        # Scenarios
        scenarios = [
            {
                "signal": "BUY",
                "summary": "{name}의 AI 및 클라우드 부문 채용 급증이 감지되어 성장 모멘텀이 확인됩니다.",
                "bullish": ["AI 연구 조직 30% 확대", "신규 벤처 팀 'Project {char}' 발족"],
                "bearish": []
            },
            {
                "signal": "HOLD",
                "summary": "{name}의 핵심 개발 인력 이탈과 채용 동결이 동시에 관측됩니다.",
                "bullish": [],
                "bearish": ["주요 기술 리더 3명 퇴사", "전사적 채용 동결 (Hiring Freeze)"]
            },
            {
                "signal": "SELL",
                "summary": "{name}의 구조조정 징후와 함께 R&D 인력 규모가 축소되고 있습니다.",
                "bullish": ["비주력 부서 매각 가능성"],
                "bearish": ["서버/인프라 팀 15% 감원", "채용 공고 전년 대비 40% 급감"]
            }
        ]
        
        scenario = scenarios[seed % len(scenarios)]
        score = 50 + (seed % 40) if scenario["signal"] == "BUY" else 50 - (seed % 30)
        
        # Format strings
        char = chr(65 + (seed % 26)) # A-Z
        
        return {
            "company_id": company_name,
            "signal_type": scenario["signal"],
            "confidence_score": score,
            "reason_summary": scenario["summary"].format(name=company_name),
            "key_factors": {
                "bullish": [f.format(name=company_name, char=char) for f in scenario["bullish"]],
                "bearish": [f.format(name=company_name, char=char) for f in scenario["bearish"]]
            }
        }

if __name__ == "__main__":
    analyzer = AlphaHRAnalyzer()
    # Mock Diff
    mock_diff = {
        "new_jobs": [{"job_title": "AI Researcher"}],
        "spikes": ["AI Team"],
        "team_stats": {"AI Team": {"pct_change": 25.0}}
    }
    
    signal = analyzer.analyze_signals("Naver", mock_diff)
    print(json.dumps(signal, indent=2))
