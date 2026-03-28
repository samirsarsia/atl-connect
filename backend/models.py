from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_history: list = []
    user_location: str = ""
    user_lat: float = None
    user_lng: float = None


class ChatResponse(BaseModel):
    reply: str
    resources_cited: list = []       # RAG resource names (have lat/lng in DB)
    live_resources: list = []        # Serper results with addresses (need geocoding)
