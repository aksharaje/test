from sqlmodel import Session, create_engine, select
from app.core.config import settings
from app.models.prd import GeneratedPrd

def update_prd_user_ids():
    """Update all PRDs with user_id=None to user_id=1"""
    engine = create_engine(str(settings.DATABASE_URL))
    
    with Session(engine) as db:
        # Find all PRDs with no user_id
        statement = select(GeneratedPrd).where(GeneratedPrd.user_id == None)
        prds = db.exec(statement).all()
        
        print(f"Found {len(prds)} PRDs with user_id=None")
        
        if len(prds) == 0:
            print("No PRDs to update")
            return
            
        # Update them to user_id=1
        for prd in prds:
            print(f"Updating PRD {prd.id}: {prd.title}")
            prd.user_id = 1
            db.add(prd)
        
        db.commit()
        print(f"✓ Updated {len(prds)} PRDs to user_id=1")

if __name__ == "__main__":
    update_prd_user_ids()
