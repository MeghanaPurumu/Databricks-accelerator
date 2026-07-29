from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class AuditEntry(BaseModel):
    id: str  # Sequence ID
    governance_decision_id: str  # Unique Governance Decision ID (e.g. GD-10293)
    timestamp: datetime
    user_email: str
    schema_name: str
    table_name: str
    column_name: str
    previous_tag: Optional[str] = None
    new_tag: Optional[str] = None
    decision: str  # APPROVE, REJECT, MODIFY, ESCALATE, MERGE, REQ_INFO, DRAFT
    comments: Optional[str] = None
    
    # Enhanced audit attributes
    ai_recommendation: str
    confidence_score: float
    approval_duration: str  # e.g. "45s"
    approval_method: str  # e.g. "Manual Steward Review", "Bulk Approval"
    approval_source: str  # e.g. "Steward Portal Workspace UI"

