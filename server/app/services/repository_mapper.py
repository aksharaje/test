import os
import json
from typing import List, Dict, Any
from pydantic import BaseModel

class FeatureDomain(BaseModel):
    name: str
    description: str
    related_files: List[str]
    entry_points: List[str]

class RepositoryMapper:
    def __init__(self, root_dir: str):
        self.root_dir = root_dir
        self.ignore_dirs = {'.git', 'venv', '__pycache__', 'node_modules', '.idea', '.vscode'}

    def scan_structure(self) -> Dict[str, Any]:
        """
        Scans the repository to build a file tree and identify potential entry points.
        """
        file_tree = []
        entry_points = []
        
        for root, dirs, files in os.walk(self.root_dir):
            dirs[:] = [d for d in dirs if d not in self.ignore_dirs]
            
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, self.root_dir)
                file_tree.append(rel_path)
                
                # Simple heuristic for entry points
                if "routes" in file or "main.py" in file or "controller" in file:
                    entry_points.append(rel_path)
                    
        return {
            "files": file_tree,
            "potential_entry_points": entry_points
        }

    def map_features(self, client: Any, model: str) -> List[FeatureDomain]:
        """
        Uses LLM to group files into Functional Domains.
        """
        structure = self.scan_structure()
        files_str = "\n".join(structure["files"][:500]) # Limit for context
        
        prompt = f"""
        Analyze this file list from a software project and group the files into "Functional Domains" (Features).
        Ignore utility/config files unless critical.
        
        Goal: Identify high-level features for a Product Manager documentation.
        Examples: "Authentication", "Order Management", "Payment Processing".
        
        Files:
        {files_str}
        
        Return JSON object with a "domains" key:
        {{
            "domains": [
                {{
                    "name": "Feature Name",
                    "description": "What this feature does",
                    "related_files": ["path/to/file1", "path/to/file2"],
                    "entry_points": ["path/to/route"]
                }}
            ]
        }}
        """
        
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            data = json.loads(response.choices[0].message.content)
            
            # Handle both {"domains": [...]} and [...] formats
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict):
                items = data.get("domains", data.get("features", []))
            else:
                items = []
                
            return [FeatureDomain(**item) for item in items]
        except Exception as e:
            print(f"Error identifying domains: {e}")
            return []
