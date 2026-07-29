from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class ClassificationItem(BaseModel):
    id: str
    schema_name: str
    table_name: str
    column_name: str
    data_type: str
    suggested_tag: str
    native_classification: Optional[str] = None
    ontology_match: Optional[str] = None
    similar_columns: List[str] = []
    confidence_score: float
    supervisor_recommendation: str
    ai_explanation: str
    sample_values: List[str] = []
    status: str  # PENDING, APPROVED, REJECTED, ESCALATED, DRAFT, ESCALATED_EXPERT, REQ_INFO
    submitted_time: datetime
    
    # Enhanced attributes
    priority: str  # Critical, High, Medium, Low
    category: str  # PII, PHI, Financial
    domain: str  # Claims, Finance, Clinical Trials, HR, Billing
    concept_match: Optional[str] = None
    concept_confidence: float = 0.0
    similar_columns_metrics: List[Dict[str, Any]] = []
    governance_timeline: List[Dict[str, Any]] = []

