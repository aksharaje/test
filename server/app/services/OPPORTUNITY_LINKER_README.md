# Opportunity Linker Service

## Overview

The Opportunity Linker is an AI-powered prioritization system that transforms raw ideas from the Ideation Engine into a prioritized backlog with actionable recommendations. It uses 4 specialized AI agents to analyze ideas across multiple dimensions and assign priority tiers.

## Architecture

### AI Agents

The system uses **openai/gpt-oss-120b** via OpenRouter API for all LLM calls. The workflow consists of 4 sequential agents:

#### Agent 7: Opportunity Mapping
Maps each idea to three opportunity dimensions:
- **Market Opportunity**: Estimated market size, confidence level, and rationale
- **Strategic Opportunity**: Connection strength and alignment with goals
- **Customer Opportunity**: Value delivered, target segment, and pain points addressed

#### Agent 8: Strategic Fit Scoring
Calculates a 0-10 strategic fit score based on:
- Directness of solution to core problem (not just symptoms)
- Whether it addresses root causes
- How well it prevents problem recurrence

#### Agent 9: Size Estimation
Assigns T-shirt sizes (S/M/L/XL) based on:
- **S**: Small opportunity (<$50K or <10% affected)
- **M**: Medium opportunity ($50K-$200K or 10-25% affected)
- **L**: Large opportunity ($200K-$500K or 25-50% affected)
- **XL**: Extra Large opportunity (>$500K or >50% affected)

Includes potential revenue estimate and confidence level.

#### Agent 10: Prioritization
Calculates final priority score using weighted average:
- **Impact**: 30%
- **Strategic Fit**: 25%
- **Effort**: 20%
- **Feasibility**: 15%
- **Risk**: 10%

Assigns priority tier based on score:
- **P0** (>=8.0): Execute Immediately
- **P1** (>=6.5): Next Quarter
- **P2** (>=5.0): Backlog
- **P3** (<5.0): Deprioritize

### Batch Processing

The service uses `ThreadPoolExecutor` with 5 concurrent workers to process ideas in parallel:

```python
# Process 5 ideas concurrently
self.batch_size = 5
self.executor = ThreadPoolExecutor(max_workers=5)

# Each idea goes through all 4 agents
for batch in batches:
    futures = [executor.submit(process_single_idea, idea) for idea in batch]
    results = [future.result(timeout=90) for future in futures]
```

## Database Schema

### prioritization_sessions
Tracks the overall prioritization session lifecycle.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Optional user ID |
| ideation_session_id | INTEGER | FK to ideation_sessions |
| status | VARCHAR | pending, mapping, completed, failed |
| progress_step | INTEGER | Current idea being processed |
| progress_message | VARCHAR | Human-readable progress |
| portfolio_summary | JSON | Aggregated portfolio metrics |
| error_message | VARCHAR | Error details if failed |
| processing_time_ms | INTEGER | Total processing time |
| created_at | TIMESTAMP | Session creation time |
| completed_at | TIMESTAMP | Session completion time |

### prioritized_ideas
Stores the output from all 4 AI agents for each idea.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| prioritization_session_id | INTEGER | FK to prioritization_sessions |
| generated_idea_id | INTEGER | FK to generated_ideas |
| market_opportunity | JSON | Agent 7 output (market) |
| strategic_opportunity | JSON | Agent 7 output (strategic) |
| customer_opportunity | JSON | Agent 7 output (customer) |
| strategic_fit_score | FLOAT | Agent 8 output (0-10) |
| strategic_fit_rationale | VARCHAR | Agent 8 reasoning |
| tshirt_size | VARCHAR | Agent 9 output (S/M/L/XL) |
| potential_revenue | VARCHAR | Agent 9 estimate |
| size_confidence | VARCHAR | Agent 9 confidence level |
| size_rationale | VARCHAR | Agent 9 reasoning |
| priority_score | FLOAT | Agent 10 output |
| priority_tier | VARCHAR | Agent 10 tier (P0/P1/P2/P3) |
| display_order | INTEGER | Original ordering |

## API Endpoints

### POST /api/v1/opportunity-linker/sessions
Create a new prioritization session and start background processing.

**Request Body:**
```json
{
  "ideation_session_id": 123
}
```

**Response:** 201 Created
```json
{
  "id": 456,
  "status": "pending",
  "message": "Prioritization session created. Processing started."
}
```

**Errors:**
- 404: Ideation session not found
- 400: Ideation session not completed or has no ideas

### GET /api/v1/opportunity-linker/sessions/{id}/status
Poll session status for progress updates.

**Response:** 200 OK
```json
{
  "id": 456,
  "status": "mapping",
  "progress_step": 15,
  "progress_message": "Processing batch: ideas 11-15 of 30",
  "error_message": null
}
```

### GET /api/v1/opportunity-linker/sessions/{id}
Get full session detail with all prioritized ideas.

**Response:** 200 OK
```json
{
  "session": {
    "id": 456,
    "status": "completed",
    "portfolio_summary": {
      "by_tier": {"p0": 5, "p1": 10, "p2": 8, "p3": 7},
      "by_category": {"quick_wins": 12, "strategic_bets": 8, ...},
      "by_effort": {"S": 5, "M": 15, "L": 8, "XL": 2},
      "top_p0_recommendations": [78, 82, 91]
    },
    "processing_time_ms": 45230
  },
  "ideas": [
    {
      "id": 78,
      "title": "Real-time collaboration",
      "description": "Enable multiple users to edit simultaneously",
      "market_opportunity": {
        "estimated_market_size": "$500K annually",
        "confidence_level": "High",
        "rationale": "Large enterprise need..."
      },
      "strategic_fit_score": 8.5,
      "tshirt_size": "L",
      "priority_score": 8.7,
      "priority_tier": "P0"
    }
  ]
}
```

### GET /api/v1/opportunity-linker/sessions
List all prioritization sessions.

**Query Parameters:**
- `user_id` (optional): Filter by user

**Response:** 200 OK
```json
[
  {
    "id": 456,
    "ideation_session_id": 123,
    "status": "completed",
    "created_at": "2025-12-22T10:30:00Z"
  }
]
```

### DELETE /api/v1/opportunity-linker/sessions/{id}
Delete a prioritization session and all its prioritized ideas.

**Response:** 204 No Content

**Errors:**
- 404: Session not found

## Usage Examples

### Python Backend

```python
from app.services.opportunity_linker_service import opportunity_linker_service
from app.core.db import get_session

# Create session
with get_session() as db:
    session = opportunity_linker_service.create_session(
        db=db,
        ideation_session_id=123,
        user_id=1
    )

    # Process in background
    opportunity_linker_service.process_session(db, session.id)

    # Get results
    detail = opportunity_linker_service.get_session_detail(db, session.id)
    print(f"P0 ideas: {detail['session']['portfolio_summary']['by_tier']['p0']}")
```

### TypeScript Frontend

```typescript
import { OpportunityLinkerService } from './opportunity-linker.service';

// Create session
const session = await service.createSession({
  ideationSessionId: 123
});

// Poll for completion
let status = await service.pollSessionStatus(session.id);
while (status?.status !== 'completed' && status?.status !== 'failed') {
  await new Promise(resolve => setTimeout(resolve, 2000));
  status = await service.pollSessionStatus(session.id);
}

// Get full results
const detail = await service.getSessionDetail(session.id);
console.log('Ideas by tier:', detail.ideas.filter(i => i.priorityTier === 'P0'));
```

## Performance Considerations

- **Batch Size**: Default 5 ideas processed concurrently
- **Timeout**: 90 seconds per idea (all 4 agents)
- **Retry Logic**: LLM calls retry once on timeout with 2-second backoff
- **JSON Validation**: Enforces `response_format: {"type": "json_object"}` for all LLM calls
- **Cleanup**: Handles model quirks (double braces, prefix characters)

### Typical Processing Times

- **Single Idea**: ~15-20 seconds (4 agent calls)
- **10 Ideas**: ~30-40 seconds (2 batches)
- **50 Ideas**: ~2-3 minutes (10 batches)
- **100 Ideas**: ~4-5 minutes (20 batches)

## Testing

```bash
# Run all opportunity linker tests
python3 -m pytest tests/test_opportunity_linker*.py -v

# Run specific test
python3 -m pytest tests/test_opportunity_linker_service.py::test_agent_10_prioritization_p0_tier -v
```

### Test Coverage

- ✅ Session creation and validation
- ✅ All 4 AI agents with mocked LLM calls
- ✅ Priority tier cutoffs (P0/P1/P2/P3)
- ✅ Weighted average formula
- ✅ JSON cleanup and error handling
- ✅ Timeout and retry logic
- ✅ Portfolio summary generation
- ✅ API endpoints (CRUD operations)

## Error Handling

The service handles several error scenarios:

1. **Ideation Session Not Found**: Returns 404
2. **Ideation Session Not Completed**: Returns 400
3. **No Ideas in Session**: Returns validation error
4. **LLM Timeout**: Retries once, then fails individual idea
5. **Invalid JSON Response**: Attempts cleanup, logs error
6. **Individual Idea Failure**: Continues processing remaining ideas

All errors are logged and stored in `error_message` field for debugging.

## Configuration

Required environment variables:

```bash
OPENROUTER_API_KEY=your_api_key_here
OPENROUTER_MODEL=openai/gpt-oss-120b  # Required model
```

Service configuration in `opportunity_linker_service.py`:

```python
self.batch_size = 5  # Process 5 ideas concurrently
self.executor = ThreadPoolExecutor(max_workers=5)
```

## Future Enhancements

- [ ] Export to CSV/Excel format
- [ ] Custom priority formula weights
- [ ] Historical trend analysis
- [ ] Integration with project management tools
- [ ] Custom tier definitions
- [ ] Multi-model LLM support for comparison
