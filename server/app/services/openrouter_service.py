import httpx
import json
from typing import List, Dict, Any, Optional
from app.core.config import settings

class OpenRouterService:
    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = "https://openrouter.ai/api/v1"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "http://localhost:4200", # Client URL
            "X-Title": settings.PROJECT_NAME,
            "Content-Type": "application/json"
        }

    async def chat(self, messages: List[Dict[str, str]], model: Optional[str] = None, temperature: float = 0.7, max_tokens: Optional[int] = None, response_format: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        model = model or settings.OPENROUTER_MODEL
        async with httpx.AsyncClient() as client:
            payload = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
            }
            if max_tokens:
                payload["max_tokens"] = max_tokens
            if response_format:
                payload["response_format"] = response_format

            try:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload,
                    timeout=60.0
                )
                response.raise_for_status()
                data = response.json()
                
                if not data or "choices" not in data or len(data["choices"]) == 0:
                    raise Exception("Invalid response from OpenRouter")
                    
                return {
                    "content": data["choices"][0]["message"]["content"],
                    "model": data["model"],
                    "usage": data.get("usage", {})
                }
            except Exception as e:
                print(f"OpenRouter API error: {str(e)}")
                # Fallback or re-raise
                raise e

openrouter_service = OpenRouterService()
