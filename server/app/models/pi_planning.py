from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Relationship, Column, JSON

class PiSessionBase(SQLModel):
    integration_id: int = Field(foreign_key="integrations.id")
    name: str
    description: Optional[str] = None
    project_keys: List[str] = Field(default=[], sa_column=Column(JSON))
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    sprint_count: int = 4
    sprint_length_weeks: int = 2
    plannable_issue_type: str = "feature"
    custom_issue_type_name: Optional[str] = None
    holiday_config_id: Optional[int] = None
    include_ip_sprint: bool = True
    current_version: str = "1.0"
    status: str = "draft"
    created_by: Optional[int] = None

class PiSession(PiSessionBase, table=True):
    __tablename__ = "pi_sessions"
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    boards: List["PiSessionBoard"] = Relationship(back_populates="session")
    sprints: List["PiSprint"] = Relationship(back_populates="session")
    features: List["PiFeature"] = Relationship(back_populates="session")

class PiSessionBoardBase(SQLModel):
    session_id: int = Field(foreign_key="pi_sessions.id")
    jira_board_id: int
    name: str
    board_type: str = "scrum"
    default_velocity: Optional[int] = None

class PiSessionBoard(PiSessionBoardBase, table=True):
    __tablename__ = "pi_session_boards"
    id: Optional[int] = Field(default=None, primary_key=True)
    
    session: PiSession = Relationship(back_populates="boards")

class PiSprintBase(SQLModel):
    session_id: int = Field(foreign_key="pi_sessions.id")
    sprint_number: int
    name: str
    start_date: datetime
    end_date: datetime
    working_days: int
    total_days: int
    holidays: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    is_ip_sprint: bool = False

class PiSprint(PiSprintBase, table=True):
    __tablename__ = "pi_sprints"
    id: Optional[int] = Field(default=None, primary_key=True)
    
    session: PiSession = Relationship(back_populates="sprints")

class PiFeatureBase(SQLModel):
    session_id: int = Field(foreign_key="pi_sessions.id")
    jira_issue_id: Optional[str] = None
    jira_issue_key: Optional[str] = None
    title: str
    description: Optional[str] = None
    issue_type: Optional[str] = None
    priority: Optional[str] = None
    priority_order: Optional[int] = None
    total_points: Optional[int] = None
    estimated_sprints: int = 1
    dependencies: List[Dict[str, Any]] = Field(default=[], sa_column=Column(JSON))
    labels: List[str] = Field(default=[], sa_column=Column(JSON))
    project_key: Optional[str] = None
    status: Optional[str] = None

class PiFeature(PiFeatureBase, table=True):
    __tablename__ = "pi_features"
    id: Optional[int] = Field(default=None, primary_key=True)
    
    session: PiSession = Relationship(back_populates="features")
    assignment: Optional["PiFeatureAssignment"] = Relationship(back_populates="feature")

class PiFeatureAssignmentBase(SQLModel):
    feature_id: int = Field(foreign_key="pi_features.id")
    board_id: int = Field(foreign_key="pi_session_boards.id")
    start_sprint_num: int
    end_sprint_num: int
    allocated_points: Optional[int] = None
    ai_rationale: Optional[str] = None
    is_manual_override: bool = False

class PiFeatureAssignment(PiFeatureAssignmentBase, table=True):
    __tablename__ = "pi_feature_assignments"
    id: Optional[int] = Field(default=None, primary_key=True)
    
    feature: PiFeature = Relationship(back_populates="assignment")

class HolidayConfigBase(SQLModel):
    name: str
    calendar_type: str = "us"
    country_codes: List[str] = Field(default=[], sa_column=Column(JSON))
    is_default: bool = False

class HolidayConfig(HolidayConfigBase, table=True):
    __tablename__ = "holiday_configs"
    id: Optional[int] = Field(default=None, primary_key=True)
