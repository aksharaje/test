import os
from typing import List, Optional
import math
from openai import OpenAI
from app.core.config import settings

class EmbeddingService:
    def __init__(self):
        self._client: Optional[OpenAI] = None

    @property
    def client(self) -> OpenAI:
        if not self._client:
            api_key = os.getenv("OPENROUTER_API_KEY")
            if not api_key:
                raise ValueError("OPENROUTER_API_KEY environment variable is required for embeddings")
            self._client = OpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1"
            )
        return self._client

    def split_text_into_chunks(self, text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> List[dict]:
        """
        Split text into chunks with overlap, respecting sentence/paragraph boundaries.
        Returns a list of dicts with content and metadata.
        """
        chunks = []
        position = 0
        start_char = 0
        text_length = len(text)

        while start_char < text_length:
            end_char = min(start_char + chunk_size, text_length)

            # Try to break at a sentence or paragraph boundary
            if end_char < text_length:
                search_text = text[start_char:end_char]

                # Look for paragraph break
                paragraph_break = search_text.rfind('\n\n')
                if paragraph_break > chunk_size * 0.5:
                    end_char = start_char + paragraph_break + 2
                else:
                    # Look for sentence break
                    sentence_break = max(
                        search_text.rfind('. '),
                        search_text.rfind('.\n'),
                        search_text.rfind('! '),
                        search_text.rfind('? ')
                    )
                    if sentence_break > chunk_size * 0.5:
                        end_char = start_char + sentence_break + 2

            content = text[start_char:end_char].strip()

            if len(content) > 0:
                chunks.append({
                    "content": content,
                    "metadata": {
                        "position": position,
                        "startChar": start_char,
                        "endChar": end_char
                    }
                })
                position += 1

            # Move start position (with overlap)
            start_char = end_char - chunk_overlap
            if start_char >= text_length:
                break
            if end_char >= text_length:
                break

        return chunks

    def generate_embeddings(self, texts: List[str], model: str = "text-embedding-3-small") -> List[List[float]]:
        """
        Generate embeddings for a list of texts.
        """
        if not texts:
            return []

        # Batch requests to avoid rate limits
        batch_size = 100
        all_embeddings = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            response = self.client.embeddings.create(
                model=model,
                input=batch
            )
            embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(embeddings)

        return all_embeddings

    def generate_query_embedding(self, query: str, model: str = "text-embedding-3-small") -> List[float]:
        """
        Generate a single embedding for a query.
        """
        response = self.client.embeddings.create(
            model=model,
            input=query
        )
        return response.data[0].embedding

    def estimate_token_count(self, text: str) -> int:
        """
        Estimate token count (rough approximation: ~4 chars per token).
        """
        return math.ceil(len(text) / 4)

embedding_service = EmbeddingService()
