from pydantic import BaseModel
from typing import Optional

class SyncRequest(BaseModel):
    session_cookie: str
    username: str

class SyncResponse(BaseModel):
    status: str
    message: str
    submissions_added: int
    error: Optional[str] = None
