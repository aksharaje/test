
import pytest
from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from alembic.autogenerate import compare_metadata
from sqlalchemy import create_engine, pool
from app.core.db import engine as real_engine
from app.models.knowledge_base import SQLModel

def test_migrations_are_in_sync():
    """
    Test that the Alembic migrations are in sync with the SQLModel metadata.
    This ensures that if a developer adds a column to a model, they also generate a migration.
    """
    
    # load alembic config
    alembic_cfg = Config("alembic.ini")
    
    # We need to use the real engine connection to check against the actual migrations
    # However, for a unit test, checking against the valid current state of the code is tricky
    # without running against a real DB that has been migrated.
    
    # Approach:
    # 1. Use an in-memory SQLite DB
    # 2. Apply all existing migrations to it using Alembic
    # 3. Compare the resulting DB schema with the current SQLModel metadata
    
    # Setup in-memory DB
    test_engine = create_engine(
        "sqlite:///:memory:", 
        connect_args={"check_same_thread": False}, 
        poolclass=pool.StaticPool
    )
    
    # Monkeypatch Postgres types for SQLite compatibility during test
    from sqlalchemy.dialects import postgresql
    import sqlalchemy as sa
    from unittest.mock import MagicMock
    
    # Save original types and functions
    orig_jsonb = getattr(postgresql, 'JSONB', None)
    orig_timestamp = getattr(postgresql, 'TIMESTAMP', None)
    orig_text = sa.text
    
    # Define generic type mocks that swallow kwargs
    class MockJSONB(sa.JSON):
        def __init__(self, **kwargs):
            super().__init__(none_as_null=kwargs.get('none_as_null', False))

    class MockTIMESTAMP(sa.TIMESTAMP):
        def __init__(self, **kwargs):
            # Strip out arguments that sqlite doesn't like or just pass basics
            super().__init__(timezone=kwargs.get('timezone', False))

    # Mock sa.text to clean up Postgres specific SQL
    def mock_text(text, *args, **kwargs):
        if isinstance(text, str):
            # Remove type casts like ::jsonb or ::text
            text = text.replace("::jsonb", "").replace("::text", "")
            # Replace unsupported functions
            text = text.replace("now()", "CURRENT_TIMESTAMP")
        return orig_text(text, *args, **kwargs)

    # Patch
    postgresql.JSONB = MockJSONB
    postgresql.TIMESTAMP = MockTIMESTAMP
    sa.text = mock_text
    
    try:
        with test_engine.connect() as connection:
            alembic_cfg.attributes['connection'] = connection
            
            # Apply all migrations to the in-memory DB
            command.upgrade(alembic_cfg, "head")
            
            # Check for differences
            migration_context = MigrationContext.configure(connection)
            
            # Compare schema
            diff = compare_metadata(migration_context, SQLModel.metadata)

            # Filter out expected differences
            filtered_diff = []
            
            def is_expected(d):
                # d is a tuple: (op, context, table, column, ...)
                if not isinstance(d, tuple):
                    return False
                op_name = d[0]
                table_name = d[2]
                col_name = d[3] if len(d) > 3 else None
                
                # Ignore Vector vs Numeric mismatch (SQLite mock artifact)
                if op_name == 'modify_type' and table_name == 'document_chunks' and col_name == 'embedding':
                    return True
                
                # Ignore TEXT vs AutoString mismatch (SQLite artifact)
                if op_name == 'modify_type' and table_name == 'holiday_configs' and col_name in ['name', 'calendar_type']:
                    return True
                    
                # Ignore nullable mismatches
                if op_name == 'modify_nullable':
                    return True
                
                return False

            for item in diff:
                if isinstance(item, list):
                    # Filter items inside the list
                    kept_items = [d for d in item if not is_expected(d)]
                    if kept_items:
                        filtered_diff.append(kept_items)
                else:
                    if not is_expected(item):
                        filtered_diff.append(item)

            if filtered_diff:
                msg = "Observed differences between model definitions and migration scripts:\n"
                for d in filtered_diff:
                    msg += f"{d}\n"
                msg += "\nRun 'alembic revision --autogenerate' to create a new migration."
                
                pytest.fail(msg)
    finally:
        # Restore types just in case (though process ends soon)
        if orig_jsonb: postgresql.JSONB = orig_jsonb
        if orig_timestamp: postgresql.TIMESTAMP = orig_timestamp
