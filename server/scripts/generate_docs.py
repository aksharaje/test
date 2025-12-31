import ast
import json
import os
import requests
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

# Constants
# Assuming the script is run from project root or server root - we'll try to locate paths relatively or via env
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SERVER_DIR = PROJECT_ROOT / "server"
SERVICES_DIR = SERVER_DIR / "app" / "services"
CLIENT_DOCS_DIR = PROJECT_ROOT / "client" / "src" / "assets" / "docs"

def load_env_file():
    """Simple .env loader to avoid external dependencies for this script."""
    env_path = SERVER_DIR / ".env"
    if not env_path.exists():
        print(f"No .env file found at {env_path}")
        return

    print(f"Loading .env from {env_path}")
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, value = line.split("=", 1)
                # Strip quotes if present
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                elif value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]
                
                # Only set if not already in env (prioritize real env vars)
                if key not in os.environ:
                    os.environ[key] = value

# Load env vars
load_env_file()

# OpenRouter Config
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_MODEL = "openai/gpt-3.5-turbo" # Using a faster/cheaper model for testing, can be swapped to gpt-oss-120b

# Ensure docs directory exists
CLIENT_DOCS_DIR.mkdir(parents=True, exist_ok=True)

# Service Categories Mapping - matches sidebar navigation structure
SECTION_MAPPING = {
    # Research (under Research section in sidebar)
    "CodeChatService": "Research",
    "KnowledgeBaseService": "Research",

    # Ideation (under Ideation section in sidebar)
    "IdeationService": "Ideation",
    "OpportunityLinkerService": "Ideation",  # Prioritized backlog from ideation

    # Feasibility (under Feasibility section in sidebar)
    "FeasibilityService": "Feasibility",
    "BusinessCaseService": "Feasibility",

    # Customer Experience (under Customer Experience section in sidebar)
    "ResearchPlannerService": "Customer Experience",
    "JourneyMapperService": "Customer Experience",
    "ExperienceGapAnalyzerService": "Customer Experience",
    "CXRecommenderService": "Customer Experience",

    # Backlog Authoring (under Backlog Authoring section in sidebar)
    "PrdGeneratorService": "Backlog Authoring",
    "StoryGeneratorService": "Backlog Authoring",

    # PI Planning (under PI Planning section in sidebar)
    "PiPlanningService": "PI Planning",

    # Development (under Development section in sidebar)
    "StoryToCodeService": "Development",

    # Core/Infrastructure services
    "GithubService": "Core",
    "FlowService": "Core",
    "SettingsService": "Core",
    "EmbeddingService": "Core",
    "OptimizeService": "Core",
    "JiraService": "Core",
    "FeedbackService": "Core",
    "LibraryService": "Core",
}

class ServiceParser:
    def __init__(self):
        self.services = []

    def parse_directory(self, directory: Path):
        """Scans the directory for python files and parses them."""
        if not directory.exists():
            print(f"Directory not found: {directory}")
            return

        for file_path in directory.glob("*.py"):
            # Skip __init__.py and other non-service files if needed
            if file_path.name == "__init__.py":
                continue
            
            self._parse_file(file_path)

    def _parse_file(self, file_path: Path):
        """Parses a single python file using AST."""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                source_code = f.read()
            
            tree = ast.parse(source_code)
            
            # Look for classes that look like services
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    # Heuristic: verify if it's a service (ends with Service or similar)
                    if "Service" in node.name or "Planner" in node.name:
                        self._process_service_class(node, file_path)
        
        except Exception as e:
            print(f"Error parsing {file_path}: {e}")

    def _process_service_class(self, class_node: ast.ClassDef, file_path: Path):
        """Extracts methods and docs from a service class."""
        service_info = {
            "name": class_node.name,
            "filename": file_path.name,
            "docstring": ast.get_docstring(class_node),
            "methods": []
        }

        for node in class_node.body:
            if isinstance(node, ast.FunctionDef) and not node.name.startswith("_"):
                # Public methods only usually
                # Extract args with type hints if possible
                args_info = []
                for arg in node.args.args:
                    if arg.arg == "self":
                        continue
                    
                    arg_data = {"name": arg.arg}
                    if arg.annotation:
                        try:
                            # Try to unparse the annotation to get string representation (e.g. "str", "Optional[int]")
                            arg_data["type"] = ast.unparse(arg.annotation)
                        except AttributeError:
                            # Python < 3.9 might not have unparse, fallback
                            arg_data["type"] = "Any"
                    else:
                        arg_data["type"] = "Any"
                    
                    args_info.append(arg_data)

                method_info = {
                    "name": node.name,
                    "docstring": ast.get_docstring(node),
                    "args": args_info,
                }
                service_info["methods"].append(method_info)
        
        # Only add if we found methods or it looks substantial
        if service_info["methods"]:
            self.services.append(service_info)

class DocumentationGenerator:
    def __init__(self, services: List[Dict]):
        self.services = services

    def generate_all(self):
        """Generates documentation for identified services."""
        manifest = []
        
        for service in self.services:
            print(f"Generating docs for {service['name']}...")
            doc_content = self._generate_single_doc(service)
            
            if doc_content:
                filename = f"{self._camel_to_kebab(service['name'])}.md"
                output_path = CLIENT_DOCS_DIR / filename
                
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(doc_content)
                
                manifest.append({
                    "name": service["name"],
                    "filename": filename,
                    "category": SECTION_MAPPING.get(service["name"], "General"),
                    "summary": self._extract_summary(doc_content)
                })
        
        # Write manifest
        with open(CLIENT_DOCS_DIR / "manifest.json", "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)
        
        print(f"Documentation generation complete. {len(manifest)} files generated.")

    def _camel_to_kebab(self, name: str) -> str:
        """Converts CamelCase to kebab-case."""
        import re
        s1 = re.sub('(.)([A-Z][a-z]+)', r'\1-\2', name)
        return re.sub('([a-z0-9])([A-Z])', r'\1-\2', s1).lower()

    def _extract_summary(self, content: str) -> str:
        """Extracts a brief summary from the generated markdown."""
        lines = content.split('\n')
        for line in lines:
            if line.strip() and not line.startswith('#'):
                return line.strip()[:150] + "..."
        return "No summary available."

    def _generate_single_doc(self, service: Dict) -> str:
        """Calls LLM to generate documentation."""
        if not OPENROUTER_API_KEY:
            # Fallback for when API key is not present (e.g. initial testing)
            return self._generate_fallback_doc(service)

        prompt = self._build_prompt(service)
        
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://productstudio.app", 
                    "X-Title": "Product Studio Docs Generator"
                },
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": "You are a technical writer creating user-friendly documentation for product managers."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.5
                },
                timeout=60
            )
            
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
            
        except Exception as e:
            print(f"Error calling LLM for {service['name']}: {e}")
            return self._generate_fallback_doc(service)

    def _build_prompt(self, service: Dict) -> str:
        """Constructs the prompt for the LLM."""
        return f"""
        You are an expert Technical Writer and Product Manager. Your goal is to write clear, user-friendly documentation for a Product Management application. 
        The audience is **non-technical Product Managers**. 
        
        **Instructions**:
        1. **Title**: Convert the technical service name '{service['name']}' into a friendly human title (e.g., "ResearchPlannerService" -> "Research Planner"). Do NOT use CamelCase in the title or text.
        2. **Tone**: specific, professional, yet accessible. Avoid jargon like "instantiating classes", "sessions" (unless referring to a specific work session concept), "DTOs", etc.
        3. **Functionality**: Describe what the user *achieves*, not what the code *does*.
        
        **Source Code Info**:
        - **Docstring**: {service.get('docstring', 'None')}
        - **Methods**: {json.dumps(service['methods'], indent=2)}
        
        Please format the output in Markdown as follows:
        
        # [Human Readable Title]
        
        ## Overview
        [A purely business-focused explanation. Why would a PM use this? What value does it drive? Don't mention "Service" or "Class".]
        
        ## Key Capabilities
        [Bulleted list of high-level actions a user can take. Use action verbs like "Create", "Analyze", "Track". Application terms only, no code terms.]
        
        ## How to Use
        [Narrative description of the workflow. E.g. "Start by defining your objective..."]
        
        ## Configuration & Fields
        [Analyze the inputs to the public methods. Translate them into the form fields a user would fill out.
         **CRITICAL RULES FOR FIELDS**:
         - **STRICTLY FORBIDDEN**: Do NOT use the words "ID", "IDs", "Id", "Pk", or "Fk" in any Field Name.
         - **Mapping Rules**: 
           - `knowledge_base_ids` -> "**Connected Knowledge Base**" (Singular or collective noun)
           - `user_id` -> "**Owner**" or "**User**"
           - `session_id` -> "**Session Reference**" (or omit if it's internal)
         - **Filter Internal Fields**: Exclude fields that are clearly internal logic (e.g. `db`, `session` object, `api_key`, `request`). Only list fields the user provides.
         - **Focus on Purpose**: Explain what the data *does* for the user.
         
         Format for each relevant field (omit if no user inputs):
         - **Field Name**: [Friendly UI Label, e.g. "Connected Knowledge Base"]
         - **Purpose**: [What is this data used for? Is it optional?]
         - **Example**: [Realistic business content]
        ]
        """

    def _generate_fallback_doc(self, service: Dict) -> str:
        """Generates a basic template if LLM fails or no key."""
        md = f"# {service['name']}\n\n"
        md += "## Overview\n"
        md += f"Service file: `{service['filename']}`\n\n"
        if service['docstring']:
            md += f"{service['docstring']}\n\n"
        
        md += "## Methods\n"
        for method in service['methods']:
            md += f"### {method['name']}\n"
            if method['docstring']:
                md += f"{method['docstring']}\n"
            md += "\n"
        
        md += "> [!NOTE]\n> This documentation was auto-generated without AI enhancement.\n"
        return md

def main():
    print("Starting documentation generation...")
    parser = ServiceParser()
    parser.parse_directory(SERVICES_DIR)
    
    print(f"Found {len(parser.services)} services.")
    
    generator = DocumentationGenerator(parser.services)
    generator.generate_all()

if __name__ == "__main__":
    main()
