# SDLC Agent System

A comprehensive set of AI agents to automate the software development lifecycle.

## Prerequisites

Before running the application, ensure you have the following installed:

### 1. Python (Backend)
- **Mac:**
  ```bash
  brew install python@3.11
  ```
- **Windows:**
  Download and install Python 3.11 from [python.org](https://www.python.org/downloads/). Ensure you check "Add Python to PATH" during installation.

### 2. Node.js (Frontend)
- **Mac:**
  ```bash
  brew install node
  ```
- **Windows:**
  Download and install Node.js (LTS version) from [nodejs.org](https://nodejs.org/).

### 3. PostgreSQL (Database)
- **Mac:**
  ```bash
  brew install postgresql@14
  brew services start postgresql@14
  ```
- **Windows:**
  Download and install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/).

## Setup Instructions

### 1. Clone the Repository
```bash
git clone <repository-url>
cd ps-prototype
```

### 2. Backend Setup
Navigate to the server directory and set up the Python environment:

```bash
cd server
```

**Create a virtual environment:**
- **Mac/Linux:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```
- **Windows:**
  ```bash
  python -m venv venv
  .\venv\Scripts\activate
  ```

**Install dependencies:**
```bash
pip install -r requirements.txt
```

**Environment Configuration:**
Create a `.env` file in the `server` directory with the following variables:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ps_prototype

# AI API Keys (Required for AI features)
OPENAI_API_KEY=your_openai_key
GOOGLE_API_KEY=your_google_key
OPENROUTER_API_KEY=your_openrouter_key

# Jira Integration (Optional)
JIRA_CLIENT_ID=your_jira_client_id
JIRA_CLIENT_SECRET=your_jira_client_secret
JIRA_REDIRECT_URI=http://localhost:8000/api/integrations/jira/oauth/callback
```

**Initialize Database:**
```bash
python init_db.py
```

**Start the Server:**
```bash
uvicorn app.main:app --reload --port 8000
```
The server will start at `http://localhost:8000`.

### 3. Frontend Setup
Open a new terminal window and navigate to the client directory:

```bash
cd client
```

**Install dependencies:**
```bash
npm install
```

**Start the Application:**
```bash
npm start
```
The application will open at `http://localhost:4200`.

## Development Workflow

### Pushing Code
1.  **Stage changes:**
    ```bash
    git add .
    ```
2.  **Commit changes:**
    ```bash
    git commit -m "Description of changes"
    ```
3.  **Push to repository:**
    ```bash
    git push origin main
    ```

## Troubleshooting

-   **Port Conflicts:** Ensure ports `8000` (backend) and `4200` (frontend) are free.
-   **Database Connection:** Verify PostgreSQL is running and the `DATABASE_URL` in `.env` is correct.
-   **Missing Modules:** If you see `ModuleNotFoundError`, ensure your virtual environment is activated and you've run `pip install -r requirements.txt`.
