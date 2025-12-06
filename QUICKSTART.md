# PS Prototype - Quick Start Guide

## Prerequisites

### Mac

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js 20+
brew install node

# Install Python 3.11+
brew install python@3.11

# Install PostgreSQL
brew install postgresql@15
brew services start postgresql@15
```

### Windows

1. **Node.js 20+**: Download from https://nodejs.org/
2. **Python 3.11+**: Download from https://www.python.org/downloads/
3. **PostgreSQL 15+**: Download from https://www.postgresql.org/download/windows/

Or use winget:
```powershell
winget install OpenJS.NodeJS
winget install Python.Python.3.11
winget install PostgreSQL.PostgreSQL
```

---

## Getting Started

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repo-url>
cd ps-prototype

# Install frontend dependencies
cd client
npm install
cd ..

# Set up Python virtual environment
cd server
python3 -m venv venv

# Activate virtual environment
# Mac/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
cd ..
```

### 2. Set Up Database

```bash
# Create the database
createdb ps_prototype

# Or on Windows (if psql is in PATH):
# psql -U postgres -c "CREATE DATABASE ps_prototype;"
```

### 3. Configure Environment Variables

Create `server/.env`:

```bash
# Database
DATABASE_URL=postgresql://YOUR_USERNAME@localhost:5432/ps_prototype

# AI (required for AI features)
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# Jira Integration (optional)
JIRA_CLIENT_ID=
JIRA_CLIENT_SECRET=
JIRA_REDIRECT_URI=http://localhost:8000/api/integrations/jira/oauth/callback
```

**Note:** Replace `YOUR_USERNAME` with your system username (Mac) or `postgres` (Windows default).

### 4. Run Database Migrations

```bash
cd server
source venv/bin/activate  # Mac/Linux
# venv\Scripts\activate   # Windows

alembic upgrade head
cd ..
```

### 5. Start the Servers

**Terminal 1 - Backend (Python):**
```bash
cd server
source venv/bin/activate  # Mac/Linux
# venv\Scripts\activate   # Windows

uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Frontend (Angular):**
```bash
cd client
npm start
```

### 6. Open the App

- **Frontend:** http://localhost:4200
- **API Docs:** http://localhost:8000/docs

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Angular 21, TypeScript, spartan/ui, Tailwind CSS |
| Backend | Python 3.11+, FastAPI, SQLModel, Pydantic |
| Database | PostgreSQL with pgvector |
| AI | OpenRouter API |

---

## Common Commands

### Frontend (client/)

```bash
npm start           # Start dev server (http://localhost:4200)
npm run build       # Production build
npm test            # Run tests
```

### Backend (server/)

```bash
# Always activate venv first!
source venv/bin/activate  # Mac/Linux
# venv\Scripts\activate   # Windows

uvicorn app.main:app --reload --port 8000   # Start dev server
pytest                                        # Run tests
alembic upgrade head                         # Run migrations
alembic revision --autogenerate -m "msg"     # Create migration
```

---

## Troubleshooting

### "Database does not exist"

```bash
createdb ps_prototype
```

### "Permission denied" on Mac

```bash
# If PostgreSQL user doesn't exist
createuser -s $(whoami)
```

### Python command not found

```bash
# Mac - use python3 explicitly
python3 -m venv venv

# Windows - ensure Python is in PATH, or use:
py -3.11 -m venv venv
```

### "Module not found" errors (Python)

```bash
# Make sure venv is activated and dependencies installed
source venv/bin/activate
pip install -r requirements.txt
```

### Port already in use

```bash
# Find and kill process on port 8000 (Mac/Linux)
lsof -ti:8000 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENROUTER_API_KEY` | For AI features | OpenRouter API key |
| `JIRA_CLIENT_ID` | For Jira | Jira OAuth client ID |
| `JIRA_CLIENT_SECRET` | For Jira | Jira OAuth client secret |
| `JIRA_REDIRECT_URI` | For Jira | OAuth callback URL |
