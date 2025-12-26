import sys
import os
import ast
from pathlib import Path
import pytest

# Add strategies to find the script
SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
sys.path.append(str(SCRIPTS_DIR))

# Import the specific classes we want to test
# We might need to handle imports inside generate_docs.py that might fail if dependencies aren't met,
# but since it only imports standard libs + requests, it should be fine.
try:
    from generate_docs import ServiceParser, SECTION_MAPPING
except ImportError:
    pytest.fail("Could not import generate_docs. Make sure server/scripts/generate_docs.py exists.")

class TestDocsGenerator:
    def test_section_mapping_coverage(self):
        """Ensure critical services are mapped."""
        assert "ResearchPlannerService" in SECTION_MAPPING
        assert SECTION_MAPPING["ResearchPlannerService"] == "Customer Experience"

    def test_parse_simple_class(self, tmp_path):
        """Test that ServiceParser correctly extracts class info and args."""
        
        # Create a dummy python file
        d = tmp_path / "services"
        d.mkdir()
        p = d / "test_service.py"
        source_code = """
class TestService:
    \"\"\"This is a test service.\"\"\"
    
    def do_something(self, name: str, count: int = 1):
        \"\"\"Does something useful.\"\"\"
        pass
"""
        p.write_text(source_code)
        
        parser = ServiceParser()
        parser.parse_directory(d)
        
        assert len(parser.services) == 1
        service = parser.services[0]
        
        assert service["name"] == "TestService"
        assert service["docstring"] == "This is a test service."
        
        methods = service["methods"]
        assert len(methods) == 1
        
        method = methods[0]
        assert method["name"] == "do_something"
        assert method["docstring"] == "Does something useful."
        
        # Check args extraction
        args = method["args"]
        assert len(args) == 2
        
        assert args[0]["name"] == "name"
        assert args[0]["type"] == "str"
        
        assert args[1]["name"] == "count"
        assert args[1]["type"] == "int"

    def test_parse_complex_types(self, tmp_path):
        """Test parsing of complex type hints like List[int] or Optional[dict]."""
        d = tmp_path / "services"
        d.mkdir()
        p = d / "complex_service.py"
        source_code = """
from typing import List, Optional, Dict

class ComplexService:
    def process_data(self, ids: List[int], config: Optional[Dict[str, str]] = None):
        pass
"""
        p.write_text(source_code)
        
        parser = ServiceParser()
        parser.parse_directory(d)
        
        service = parser.services[0]
        args = service["methods"][0]["args"]
        
        # Note: ast.unparse might vary slightly by python version (spacing), verify robustness
        assert args[0]["name"] == "ids"
        assert "List" in args[0]["type"]
        assert "int" in args[0]["type"]
        
        assert args[1]["name"] == "config"
        assert "Optional" in args[1]["type"]
