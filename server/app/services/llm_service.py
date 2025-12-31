"""
Simple LLM service for general-purpose JSON generation.
"""

import json
import os
from typing import Any, Optional
from openai import OpenAI


class LlmService:
    _client: Optional[OpenAI] = None

    def _get_client(self) -> OpenAI:
        if self._client is None:
            api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENROUTER_API_KEY or OPENAI_API_KEY environment variable not set")
            self._client = OpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1"
            )
        return self._client

    async def generate_json(
        self,
        prompt: str,
        system_message: str = "You are a helpful assistant that returns only valid JSON.",
        model: str = "openai/gpt-4o-mini"
    ) -> Any:
        """
        Generate a JSON response from the LLM.

        Args:
            prompt: The user prompt
            system_message: The system message
            model: The model to use

        Returns:
            Parsed JSON response
        """
        client = self._get_client()

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        content = response.choices[0].message.content
        if not content:
            return []

        try:
            result = json.loads(content)
            # If result is a dict with a single key that's a list, return the list
            if isinstance(result, dict):
                if "mappings" in result:
                    return result["mappings"]
                elif len(result) == 1:
                    first_value = list(result.values())[0]
                    if isinstance(first_value, list):
                        return first_value
            return result
        except json.JSONDecodeError:
            return []


# Singleton instance
llm_service = LlmService()
