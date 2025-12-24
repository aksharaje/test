import hmac
import hashlib
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
from sqlmodel import Session, select
from app.core.db import get_session
from app.core.config import settings
from app.services.library_service import library_service
from app.services.settings_service import settings_service
from app.models.library import LibraryBook

router = APIRouter()

@router.post("/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
    # 1. Verify Signature (if configured)
    payload_body = await request.body()
    
    # Try getting secret from DB first, fall back to Env
    secret = settings_service.get_setting(session, "GITHUB_WEBHOOK_SECRET")
    if not secret:
        secret = settings.GITHUB_WEBHOOK_SECRET
        
    if secret:
        signature = request.headers.get("X-Hub-Signature-256")
        if not signature:
            raise HTTPException(status_code=401, detail="Missing signature")
        
        expected_signature = "sha256=" + hmac.new(secret.encode(), payload_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

    payload = await request.json()
    
    # Check for push event
    if request.headers.get("X-GitHub-Event") != "push":
        return {"result": "ignored"}
        
    ref = payload.get("ref")
    if ref != "refs/heads/main":
        return {"result": "ignored_branch"}

    # Extract Commit Info
    head_commit = payload.get("head_commit", {})
    commit_hash = head_commit.get("id")
    message = head_commit.get("message")
    added = head_commit.get("added", [])
    removed = head_commit.get("removed", [])
    modified = head_commit.get("modified", [])
    
    # Generate Change Summary
    change_summary = f"Commit: {message}\n\n"
    if added: change_summary += f"**Added**: {', '.join(added)}\n"
    if modified: change_summary += f"**Modified**: {', '.join(modified)}\n"
    if removed: change_summary += f"**Removed**: {', '.join(removed)}\n"
    
    # Find all 'ready' books to update
    # In a real app, we might map repos to books. Here we update all books.
    
    # We need a session, but can't depend on dependency injection for background tasks easily here
    # without a specific scoping. We'll instantiate a session inside the background task wrapper.
    background_tasks.add_task(trigger_updates, commit_hash, change_summary)
    
    return {"result": "ok"}

def trigger_updates(commit_hash: str, change_summary: str):
    from app.core.db import engine
    with Session(engine) as session:
        books = session.exec(select(LibraryBook).where(LibraryBook.status == "ready")).all()
        for book in books:
            print(f"Triggering update for book {book.id}")
            # Re-generation logic
            library_service.generate_book_content(
                session, 
                book.id, 
                book.knowledge_base_id,
                commit_hash=commit_hash,
                change_summary=change_summary
            )
