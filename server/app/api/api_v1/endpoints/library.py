from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from sqlmodel import Session
from app.core.db import get_session
from app.models.library import LibraryBook, LibraryPage, LibraryIntegration
from app.services.library_service import library_service

router = APIRouter()

@router.get("/books", response_model=List[LibraryBook])
def list_books(
    session: Session = Depends(get_session)
) -> Any:
    return library_service.list_books(session)

@router.post("/books", response_model=LibraryBook)
def create_book(
    payload: Dict[str, int],
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
) -> Any:
    kb_id = payload.get("knowledgeBaseId")
    if not kb_id:
        raise HTTPException(status_code=400, detail="knowledgeBaseId is required")
        
    book = library_service.create_book(session, kb_id)
    
    # Trigger background generation
    background_tasks.add_task(library_service.generate_book_content, session, book.id, kb_id)
    
    return book

@router.delete("/books/{id}")
def delete_book(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    if not library_service.delete_book(session, id):
        raise HTTPException(status_code=404, detail="Book not found")
    return Response(status_code=204)

@router.get("/books/{id}", response_model=LibraryBook)
def get_book(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    book = library_service.get_book(session, id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book

@router.get("/books/{id}/pages", response_model=List[Dict[str, Any]])
def get_book_pages(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    return library_service.get_book_pages(session, id)

@router.get("/pages/{id}", response_model=LibraryPage)
def get_page(
    id: int,
    session: Session = Depends(get_session)
) -> Any:
    page = library_service.get_page(session, id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page
