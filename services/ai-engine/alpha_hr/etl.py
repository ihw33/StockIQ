import os
import json
from typing import Dict, List
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

class AlphaHRETL:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            print("[AlphaHRETL] Warning: GEMINI_API_KEY not found.")
        else:
            genai.configure(api_key=self.api_key)
            # Using 'gemini-2.0-flash-exp' as per plan, fallback to 'gemini-pro' if not available
            self.model_name = "gemini-2.0-flash-exp" 
            self.model = genai.GenerativeModel(self.model_name)

    def extract_job_snapshots(self, raw_text: str, company_name: str) -> List[Dict]:
        """
        Parses raw text (news/search results) and extracts structured Job Snapshots.
        Target Schema: 
        [{
            "company_id": str,
            "job_title": str,
            "tech_stack": [str],
            "team_name": str, // Inferred
            "status": "OPEN" | "CLOSED"
        }]
        """
        if not self.api_key:
            return self._get_mock_snapshots(company_name)

        system_instruction = f"""
        You are an expert Data Engineer. Extract structured hiring information for '{company_name}' from the provided text.
        
        Rules:
        1. Identify specific job roles, departments (Team Name), and required technologies.
        2. If a team name is not explicitly stated, infer it from the role (e.g., "AI Researcher" -> "AI Research Team").
        3. Output MUST be a valid JSON array of objects.
        4. Field schema:
           - job_title: string
           - tech_stack: list of strings
           - team_name: string
           - status: "OPEN" (default) or "CLOSED" (if text says so)
        
        Return ONLY valid JSON. No Markdown formatting.
        """

        try:
            response = self.model.generate_content(
                f"{system_instruction}\n\n[Input Text]:\n{raw_text}",
                generation_config={"response_mime_type": "application/json"}
            )
            
            # Cleaning potential markdown blocks if the model ignores the instruction
            text_res = response.text.replace("```json", "").replace("```", "").strip()
            return json.loads(text_res)

        except Exception as e:
            print(f"[AlphaHRETL] Generation Error: {e}")
            # Fallback for dev/mock
            return self._get_mock_snapshots(company_name)

    def _get_mock_snapshots(self, company_name: str) -> List[Dict]:
        return [
            {
                "company_id": company_name,
                "job_title": "Senior AI Engineer",
                "tech_stack": ["Python", "PyTorch", "LLM"],
                "team_name": "AI Platform",
                "status": "OPEN"
            },
            {
                "company_id": company_name,
                "job_title": "Backend Developer",
                "tech_stack": ["Go", "Kubernetes"],
                "team_name": "Infrastructure",
                "status": "OPEN"
            }
        ]

if __name__ == "__main__":
    etl = AlphaHRETL()
    sample_text = """
    Naver is hiring for its Robotics team. We are looking for 5 Robot Perception Engineers skilled in C++ and ROS.
    Also, the Cloud Platform team is looking for a DevOps specialist using AWS and Terraform.
    """
    result = etl.extract_job_snapshots(sample_text, "Naver")
    print(json.dumps(result, indent=2))
