
import os
import ast
import sys

def has_snake_case_fields(class_node):
    """Check if a class has any snake_case annotated assignments."""
    for node in class_node.body:
        if isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name):
                name = node.target.id
                # Check for snake_case (contains underscore and is lowercase)
                if '_' in name and name.islower() and not name.startswith('_'):
                    return True
    return False

def has_alias_config(class_node):
    """Check if a class has a Config class with alias_generator."""
    # Check for inner Config class
    for node in class_node.body:
        if isinstance(node, ast.ClassDef) and node.name == 'Config':
            for item in node.body:
                if isinstance(item, ast.Assign):
                    for target in item.targets:
                        if isinstance(target, ast.Name) and target.id == 'alias_generator':
                            return True
    
    # Check for model_config assignment (Pydantic v2 style, though project seems to use v1/SQLModel style)
    for node in class_node.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == 'model_config':
                    return True
    return False

def check_file(filepath):
    """Parse file and check for problematic models."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        tree = ast.parse(content)
        
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                # Check if it inherits from SQLModel or BaseModel
                bases = [base.id for base in node.bases if isinstance(base, ast.Name)]
                if 'SQLModel' in bases or 'BaseModel' in bases:
                    # If it has snake_case fields but NO alias config
                    if has_snake_case_fields(node) and not has_alias_config(node):
                        print(f"[{os.path.basename(filepath)}] Class '{node.name}' has snake_case fields but NO alias generator config.")
                        
    except Exception as e:
        print(f"Error processing {filepath}: {e}")

def main():
    models_dir = "/Users/ryanchin/ps-prototype/server/app/models"
    print(f"Scanning {models_dir} for missing alias configurations...\n")
    
    for filename in sorted(os.listdir(models_dir)):
        if filename.endswith(".py") and filename != "__init__.py":
            check_file(os.path.join(models_dir, filename))

if __name__ == "__main__":
    main()
