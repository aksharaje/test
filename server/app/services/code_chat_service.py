import os
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc, col
from app.models.code_chat import CodeChatSession, CodeChatMessage
from app.models.knowledge_base import KnowledgeBase
from app.services.knowledge_base_service import knowledge_base_service
from openai import OpenAI

class CodeChatService:
    def __init__(self):
        self._client: Optional[OpenAI] = None

    @property
    def client(self) -> OpenAI:
        if not self._client:
            from app.core.config import settings
            api_key = settings.OPENROUTER_API_KEY
            if not api_key:
                raise ValueError("OPENROUTER_API_KEY environment variable is required")
            self._client = OpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1"
            )
        return self._client

    def get_system_prompt(self) -> str:
        return """You are an AI assistant specialized in analyzing and explaining codebases. Your role is to help Product Managers and other non-technical stakeholders understand technical systems.

CORE CAPABILITIES:
1. **Logic Extraction**: Interpret code to explain business rules in plain English
2. **Flow Explanation**: Trace function calls to explain end-to-end flows
3. **Integration Analysis**: Identify API calls, data payloads, and external system integrations
4. **Effort Estimation**: Provide T-Shirt sizing (Small/Medium/Large/XL) for potential changes

RESPONSE GUIDELINES:
- Explain technical concepts in clear, non-technical language
- When referencing code, cite the specific file and relevant line numbers
- Structure responses with clear headings and bullet points when appropriate
- If you cannot find relevant code for a question, explicitly state this rather than guessing
- Use markdown formatting for code snippets, lists, and emphasis
- When providing effort estimates, explain the rationale based on the code complexity

CITATION FORMAT:
When referencing code, use this format: [filename:line_number] or [filename:start_line-end_line]

SECURITY:
- Never expose API keys, passwords, secrets, or credentials found in the code
- Mask sensitive values if they appear in code snippets
- Focus on business logic, not security-sensitive implementation details

CONTEXT HANDLING:
You will receive relevant code snippets from the selected knowledge bases. Use these to provide accurate, grounded answers. If the context doesn't contain information needed to answer a question, say so clearly."""

    def get_code_knowledge_bases(self, session: Session) -> List[KnowledgeBase]:
        # Filter KBs that are ready and likely contain code
        # For now, just return all ready KBs as we don't have strict type filtering in python model yet
        # In Node.js it checked for github source or extensions.
        # We can replicate that if needed, but simpler to return all ready KBs for now.
        return session.exec(select(KnowledgeBase).where(KnowledgeBase.status == "ready").order_by(desc(KnowledgeBase.createdAt))).all()

    def create_session(self, session: Session, data: Dict[str, Any]) -> CodeChatSession:
        if not data.get("knowledgeBaseIds"):
            raise ValueError("At least one knowledge base must be selected")
            
        chat_session = CodeChatSession(
            user_id=data.get("userId"),
            knowledge_base_ids=data["knowledgeBaseIds"],
            title=data.get("title") or "New Chat"
        )
        session.add(chat_session)
        session.commit()
        session.refresh(chat_session)
        return chat_session

    def get_session(self, session: Session, session_id: int) -> Optional[Dict[str, Any]]:
        chat_session = session.get(CodeChatSession, session_id)
        if not chat_session:
            return None
            
        messages = session.exec(
            select(CodeChatMessage)
            .where(CodeChatMessage.session_id == session_id)
            .order_by(CodeChatMessage.created_at)
        ).all()
        
        # Get KB info
        kbs = []
        if chat_session.knowledge_base_ids:
            kbs = session.exec(
                select(KnowledgeBase)
                .where(col(KnowledgeBase.id).in_(chat_session.knowledge_base_ids))
            ).all()
            
        return {
            "session": chat_session,
            "messages": messages,
            "knowledgeBases": kbs
        }

    def list_sessions(self, session: Session, user_id: Optional[int] = None) -> List[CodeChatSession]:
        query = select(CodeChatSession)
        if user_id:
            query = query.where(CodeChatSession.user_id == user_id)
        query = query.order_by(desc(CodeChatSession.updated_at))
        return session.exec(query).all()

    def delete_session(self, session: Session, session_id: int) -> bool:
        chat_session = session.get(CodeChatSession, session_id)
        if not chat_session:
            return False
            
        # Delete messages first to avoid FK constraint violation
        messages = session.exec(select(CodeChatMessage).where(CodeChatMessage.session_id == session_id)).all()
        for msg in messages:
            session.delete(msg)
            
        session.delete(chat_session)
        session.commit()
        return True

    def update_session_knowledge_bases(self, session: Session, session_id: int, kb_ids: List[int]) -> Optional[CodeChatSession]:
        chat_session = session.get(CodeChatSession, session_id)
        if not chat_session:
            return None
            
        chat_session.knowledge_base_ids = kb_ids
        chat_session.updated_at = datetime.utcnow()
        session.add(chat_session)
        session.commit()
        session.refresh(chat_session)
        return chat_session

    def send_message(self, session: Session, session_id: int, user_message: str) -> Dict[str, CodeChatMessage]:
        start_time = time.time()
        
        chat_session = session.get(CodeChatSession, session_id)
        if not chat_session:
            raise ValueError(f"Session {session_id} not found")
            
        # Save user message
        user_msg = CodeChatMessage(
            session_id=session_id,
            role="user",
            content=user_message,
            citations=[]
        )
        session.add(user_msg)
        session.commit()
        session.refresh(user_msg)
        
        # Search for context
        search_results = []
        for kb_id in chat_session.knowledge_base_ids:
            results = knowledge_base_service.search(session, kb_id, user_message, limit=8)
            search_results.extend(results)
            
        # Sort by similarity (if we had it) or just take top results
        # Since we append, we might have too many. Limit to top 10 overall?
        search_results = search_results[:10]
        
        context_parts = []
        for i, r in enumerate(search_results):
            location = r.get("metadata", {}).get("path") or r["documentName"]
            context_parts.append(f"[Source {i+1}: {location}]\\n{r['content']}")
            
        context_text = ""
        if context_parts:
            context_text = f"\\n\\nRelevant code context from the codebase:\\n\\n" + "\\n\\n---\\n\\n".join(context_parts)
        else:
            context_text = "\\n\\n[No relevant code context found for this query]"
            
        # Build message history
        messages = session.exec(
            select(CodeChatMessage)
            .where(CodeChatMessage.session_id == session_id)
            .order_by(CodeChatMessage.created_at)
        ).all()
        
        history = [{"role": "system", "content": self.get_system_prompt()}]
        
        # Add recent messages (limit to last 20)
        recent_messages = messages[-21:-1] # Exclude current user message which we just added
        for msg in recent_messages:
            history.append({"role": msg.role, "content": msg.content})
            
        # Add current message with context
        history.append({"role": "user", "content": f"{user_message}{context_text}"})
        
        # Call LLM
        from app.core.config import settings
        model = settings.OPENROUTER_MODEL
        response = self.client.chat.completions.create(
            model=model,
            messages=history,
            max_tokens=4096,
            temperature=0.3
        )
        
        response_content = response.choices[0].message.content
        response_time_ms = (time.time() - start_time) * 1000
        
        # Build citations
        citations = []
        for r in search_results:
            citations.append({
                "documentId": r["documentId"],
                "documentName": r["documentName"],
                "filePath": r.get("metadata", {}).get("path"),
                "content": r["content"][:200] + "..." if len(r["content"]) > 200 else r["content"],
                "similarity": r.get("similarity", 0)
            })
            
        # Save assistant message
        assistant_msg = CodeChatMessage(
            session_id=session_id,
            role="assistant",
            content=response_content,
            citations=citations,
            metadata_={
                "model": model,
                "promptTokens": response.usage.prompt_tokens,
                "completionTokens": response.usage.completion_tokens,
                "responseTimeMs": response_time_ms,
                "chunksSearched": len(search_results)
            }
        )
        session.add(assistant_msg)
        
        # Update session title if first message or still default
        if len(messages) <= 1 or chat_session.title == "New Chat":
            title = user_message[:50] + "..." if len(user_message) > 50 else user_message
            chat_session.title = title
            
        chat_session.updated_at = datetime.utcnow()
        session.add(chat_session)
        session.commit()
        session.refresh(assistant_msg)
        
        return {
            "userMsg": user_msg,
            "assistantMsg": assistant_msg
        }

code_chat_service = CodeChatService()
