#!/bin/bash

# Run this from the root of your atl-connect repo
# Usage: bash setup.sh

echo "🏗️  Setting up ATL Connect..."

# ── Create folder structure ──
mkdir -p backend data frontend

# ── .gitignore ──
cat > .gitignore << 'EOF'
.env
venv/
__pycache__/
*.pyc
chroma_db/
.DS_Store
EOF

# ── .env ──
cat > .env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-your-key-here
EOF

# ── backend/requirements.txt ──
cat > backend/requirements.txt << 'EOF'
fastapi==0.115.0
uvicorn==0.30.0
anthropic==0.40.0
chromadb==0.5.0
sentence-transformers==3.0.0
python-dotenv==1.0.1
pydantic==2.9.0
EOF

# ── backend/models.py ──
cat > backend/models.py << 'PYEOF'
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_history: list = []
    user_location: str = ""


class ChatResponse(BaseModel):
    reply: str
    resources_cited: list = []
PYEOF

# ── backend/prompts.py ──
cat > backend/prompts.py << 'PYEOF'
SYSTEM_PROMPT = """You are ATL Connect, a warm and helpful community resource \
navigator for Atlanta, Georgia.

Your job is to help residents — especially those facing hardship — find the \
right local resources for their situation.

When a user describes their situation:

1. IDENTIFY their core needs (food, housing, jobs, transit, financial help, \
healthcare, etc.)
2. Use ONLY the resource data provided in the user message to recommend options.
3. Prioritize by: urgency of need, proximity if location given, eligibility match.
4. Give a clear ACTION PLAN with numbered steps — not just a list of places. \
Tell them exactly what to do FIRST, then NEXT.
5. Include practical details: address, hours, what to bring, phone number.
6. If transit info is available, include how to get there via MARTA.
7. If multiple resources work together, connect them: \
"Get groceries at [X] TODAY, then visit [Y] this week for job help."

Rules:
- NEVER invent or hallucinate resources. Only use what's provided.
- If no matching resource exists, say so honestly and suggest calling 211 \
(dial 2-1-1) for additional help.
- Be sensitive — people may be in crisis. Be kind, practical, and concise.
- Keep responses focused. No walls of text.
- End by asking if they need help with anything else.
- If the user greets you or asks what you can do, briefly introduce yourself \
and list the categories you can help with: Food, Housing, Jobs & Training, \
Transit, Financial Help, Healthcare, and Legal Aid.

Respond in the same language the user writes in. If they write in Spanish, \
respond in Spanish."""
PYEOF

# ── backend/rag.py ──
cat > backend/rag.py << 'PYEOF'
import json
import chromadb
from chromadb.utils import embedding_functions

ef = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

chroma_client = chromadb.PersistentClient(path="./chroma_db")
COLLECTION_NAME = "atl_resources"


def get_collection():
    return chroma_client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )


def load_resources_into_db(json_path="../data/resources.json"):
    """Load resource data from JSON into ChromaDB. Run once via seed_db.py."""
    with open(json_path, "r") as f:
        resources = json.load(f)

    collection = get_collection()
    documents, metadatas, ids = [], [], []

    for r in resources:
        doc = (
            f"{r['name']}. {r['description']}. "
            f"Categories: {', '.join(r['category'])}. "
            f"Services: {r['services']}. "
            f"Location: {r['address']}. "
            f"Eligibility: {r['eligibility']}."
        )
        documents.append(doc)
        metadatas.append({
            "name": r["name"],
            "category": ", ".join(r["category"]),
            "address": r["address"],
            "phone": r.get("phone", "N/A"),
            "hours": r.get("hours", "N/A"),
            "services": r.get("services", ""),
            "eligibility": r.get("eligibility", "Open to all"),
            "description": r["description"],
            "transit_access": r.get("transit_access", "N/A"),
            "lat": str(r.get("lat", "")),
            "lng": str(r.get("lng", "")),
        })
        ids.append(r["id"])

    collection.upsert(documents=documents, metadatas=metadatas, ids=ids)
    print(f"Loaded {len(resources)} resources into ChromaDB.")


def get_relevant_resources(query, n_results=5):
    """Query ChromaDB for resources relevant to the user's message."""
    collection = get_collection()
    results = collection.query(query_texts=[query], n_results=n_results)
    resources = []
    if results and results["metadatas"]:
        for metadata in results["metadatas"][0]:
            resources.append(metadata)
    return resources


def get_all_resources():
    """Return all resources from the database."""
    collection = get_collection()
    results = collection.get()
    return results["metadatas"] if results["metadatas"] else []
PYEOF

# ── backend/main.py ──
cat > backend/main.py << 'PYEOF'
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import anthropic

from models import ChatRequest, ChatResponse
from rag import get_relevant_resources, get_all_resources
from prompts import SYSTEM_PROMPT

load_dotenv()

app = FastAPI(title="ATL Connect")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    # 1 — Retrieve relevant resources via RAG
    relevant_resources = get_relevant_resources(req.message)

    # 2 — Format resource context
    resource_context = "\n\n".join(
        f"**{r['name']}**\n"
        f"Category: {r['category']}\n"
        f"Address: {r['address']}\n"
        f"Phone: {r['phone']}\n"
        f"Hours: {r['hours']}\n"
        f"Services: {r['services']}\n"
        f"Eligibility: {r['eligibility']}\n"
        f"Transit: {r.get('transit_access', 'N/A')}\n"
        f"Description: {r['description']}"
        for r in relevant_resources
    )

    # 3 — Build messages
    messages = list(req.conversation_history)

    location_line = (
        f"User's location: {req.user_location}\n" if req.user_location else ""
    )

    messages.append({
        "role": "user",
        "content": (
            f"User's question: {req.message}\n\n"
            f"{location_line}"
            f"Here are the relevant Atlanta community resources I found:\n\n"
            f"{resource_context}\n\n"
            f"Use ONLY these resources in your response. "
            f"Do not make up any resources."
        ),
    })

    # 4 — Call Claude
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=messages,
    )

    reply = response.content[0].text

    return ChatResponse(
        reply=reply,
        resources_cited=[r["name"] for r in relevant_resources],
    )


@app.get("/resources")
def list_resources(category: str = None):
    """Browse all resources, optionally filtered by category."""
    resources = get_all_resources()
    if category:
        resources = [
            r for r in resources
            if category.lower() in r.get("category", "").lower()
        ]
    return {"resources": resources}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
PYEOF

# ── data/resources.json ──
cat > data/resources.json << 'JSONEOF'
[
  {
    "id": "food_001",
    "name": "Atlanta Community Food Bank - Main Distribution Center",
    "category": ["food", "emergency"],
    "description": "Largest food bank in metro Atlanta. Provides free groceries through direct distribution and partner agencies. No appointment needed for open distribution days.",
    "address": "3400 N Desert Dr NW, Atlanta, GA 30344",
    "lat": 33.7573,
    "lng": -84.4483,
    "phone": "(404) 892-9822",
    "hours": "Mon-Fri 8:30am-5pm, Open distribution Sat 9am-12pm",
    "eligibility": "Open to all Atlanta residents. No ID required for emergency food.",
    "services": "Groceries, baby formula, diapers, hygiene products, SNAP application assistance",
    "languages": "English, Spanish",
    "transit_access": "MARTA Bus Route 83, 0.3mi walk from Bankhead Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "food_002",
    "name": "Open Hand Atlanta",
    "category": ["food", "health"],
    "description": "Prepares and delivers free nutritious meals to people with chronic illnesses including HIV/AIDS, cancer, and diabetes. Also offers nutrition education.",
    "address": "176 Ottley Dr NE, Atlanta, GA 30324",
    "lat": 33.8095,
    "lng": -84.3678,
    "phone": "(404) 872-6947",
    "hours": "Mon-Fri 8am-4pm",
    "eligibility": "Individuals with serious or chronic illness. Referral from doctor or case manager.",
    "services": "Home-delivered meals, nutrition counseling, cooking classes",
    "languages": "English",
    "transit_access": "MARTA Bus Route 36, near Lindbergh Center Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "food_003",
    "name": "Hosea Helps - Feed the Hungry",
    "category": ["food", "emergency"],
    "description": "Community organization providing free hot meals, groceries, and emergency food assistance to families and individuals in need across metro Atlanta.",
    "address": "1559 Bishop Eddie Long Blvd, Lithonia, GA 30058",
    "lat": 33.7123,
    "lng": -84.1052,
    "phone": "(404) 755-3353",
    "hours": "Mon-Fri 9am-5pm, food distributions vary - call ahead",
    "eligibility": "Open to all. No documentation required.",
    "services": "Hot meals, grocery boxes, holiday meal distributions, emergency food",
    "languages": "English",
    "transit_access": "Limited MARTA access, bus connections from Indian Creek Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "food_004",
    "name": "Salvation Army Red Shield Services - Atlanta",
    "category": ["food", "housing", "emergency"],
    "description": "Provides emergency food boxes, hot meals, utility assistance, and shelter referrals. Walk-ins accepted for food assistance.",
    "address": "780 Marietta St NW, Atlanta, GA 30318",
    "lat": 33.7666,
    "lng": -84.4069,
    "phone": "(404) 486-2900",
    "hours": "Mon-Fri 9am-3pm",
    "eligibility": "Open to all in need. Bring ID if available but not required.",
    "services": "Emergency food boxes, hot meals, utility bill assistance, shelter referrals, clothing",
    "languages": "English, Spanish",
    "transit_access": "MARTA Bus Route 1, near Bankhead MARTA Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "housing_001",
    "name": "Atlanta Mission - My Sister's House",
    "category": ["housing", "emergency", "women"],
    "description": "Emergency shelter for women and children experiencing homelessness. Provides safe shelter, meals, case management, and recovery programs.",
    "address": "921 Howell Mill Rd NW, Atlanta, GA 30318",
    "lat": 33.7812,
    "lng": -84.4103,
    "phone": "(404) 367-2493",
    "hours": "Intake daily 8am-8pm",
    "eligibility": "Women and children experiencing homelessness. Must be sober at intake.",
    "services": "Emergency shelter, meals, case management, recovery programs, job readiness",
    "languages": "English",
    "transit_access": "MARTA Bus Route 1, 0.2mi walk",
    "last_verified": "2026-03-15"
  },
  {
    "id": "housing_002",
    "name": "Gateway Center",
    "category": ["housing", "emergency"],
    "description": "Comprehensive homeless services center providing emergency shelter, transitional housing, and workforce development for men experiencing homelessness.",
    "address": "275 Pryor St SW, Atlanta, GA 30303",
    "lat": 33.7477,
    "lng": -84.3918,
    "phone": "(404) 215-6600",
    "hours": "24/7 intake available",
    "eligibility": "Adult men experiencing homelessness",
    "services": "Emergency shelter, transitional housing, job training, substance abuse treatment, mental health services",
    "languages": "English",
    "transit_access": "0.3mi from Garnett MARTA Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "housing_003",
    "name": "Atlanta Housing Authority",
    "category": ["housing", "financial"],
    "description": "Administers public housing and Housing Choice Voucher (Section 8) programs for low-income Atlanta residents. Provides affordable housing options.",
    "address": "230 John Wesley Dobbs Ave NE, Atlanta, GA 30303",
    "lat": 33.7556,
    "lng": -84.3795,
    "phone": "(404) 892-4700",
    "hours": "Mon-Fri 8:30am-5pm",
    "eligibility": "Low-income Atlanta residents. Income limits apply based on family size.",
    "services": "Public housing, Section 8 vouchers, affordable housing referrals, homeownership programs",
    "languages": "English",
    "transit_access": "Near Peachtree Center MARTA Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "housing_004",
    "name": "Nicholas House",
    "category": ["housing", "emergency"],
    "description": "Provides emergency and transitional shelter for families with children experiencing homelessness. Focus on keeping families together.",
    "address": "830 Boulevard SE, Atlanta, GA 30312",
    "lat": 33.7372,
    "lng": -84.3716,
    "phone": "(404) 622-1022",
    "hours": "Intake Mon-Fri 9am-5pm, call first",
    "eligibility": "Families with minor children experiencing homelessness.",
    "services": "Family shelter, case management, financial literacy, children's programs, housing placement",
    "languages": "English",
    "transit_access": "MARTA Bus Route 21, near King Memorial Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "jobs_001",
    "name": "WorkSource Atlanta - C.T. Martin Natatorium Center",
    "category": ["jobs", "training"],
    "description": "City-run career center offering free job search assistance, resume help, interview prep, computer access, and connections to local employers.",
    "address": "3201 M.L.K. Jr Dr SW, Atlanta, GA 30311",
    "lat": 33.7417,
    "lng": -84.4528,
    "phone": "(404) 546-3000",
    "hours": "Mon-Fri 8am-5pm",
    "eligibility": "Atlanta residents 18+. Free services, no income requirements.",
    "services": "Job search, resume writing, interview prep, computer lab, GED referrals, employer connections",
    "languages": "English, Spanish",
    "transit_access": "MARTA Bus Route 71, near Ashby MARTA Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "jobs_002",
    "name": "Goodwill of North Georgia Career Center - Atlanta",
    "category": ["jobs", "training", "education"],
    "description": "Free career services including job training, digital skills classes, financial coaching, and job placement assistance.",
    "address": "2201 Glenwood Ave SE, Atlanta, GA 30316",
    "lat": 33.7400,
    "lng": -84.3350,
    "phone": "(404) 420-9900",
    "hours": "Mon-Fri 9am-5pm",
    "eligibility": "Open to all. Priority for unemployed and underemployed individuals.",
    "services": "Job training, digital literacy, financial coaching, career counseling, job placement",
    "languages": "English",
    "transit_access": "MARTA Bus Route 21",
    "last_verified": "2026-03-15"
  },
  {
    "id": "jobs_003",
    "name": "Year Up Atlanta",
    "category": ["jobs", "training", "education"],
    "description": "Free one-year professional training program for young adults 18-29. Includes technical skills training, internship placement, and a weekly stipend.",
    "address": "235 Peachtree St NE, Suite 2050, Atlanta, GA 30303",
    "lat": 33.7596,
    "lng": -84.3880,
    "phone": "(404) 521-0710",
    "hours": "Mon-Fri 9am-5pm, application cycles vary",
    "eligibility": "Ages 18-29, high school diploma or GED, US work authorization, low to moderate income.",
    "services": "Tech skills training (IT, software dev, cybersecurity), professional development, internship, weekly stipend, mentorship",
    "languages": "English",
    "transit_access": "Adjacent to Peachtree Center MARTA Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "finance_001",
    "name": "United Way of Greater Atlanta - 211",
    "category": ["financial", "general", "emergency"],
    "description": "Free, confidential helpline connecting Atlanta residents to local resources for financial assistance, utilities, rent, food, and more. Available 24/7.",
    "address": "40 Courtland St NE, Suite 300, Atlanta, GA 30303",
    "lat": 33.7569,
    "lng": -84.3871,
    "phone": "211 (dial 2-1-1)",
    "hours": "24/7 phone line. Walk-in Mon-Fri 9am-5pm.",
    "eligibility": "Open to all residents of metro Atlanta.",
    "services": "Resource referrals, utility assistance, rent assistance, food referrals, crisis support",
    "languages": "English, Spanish, 150+ languages via interpreter",
    "transit_access": "Near Peachtree Center MARTA Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "finance_002",
    "name": "Consumer Credit Counseling Service of Greater Atlanta",
    "category": ["financial", "education"],
    "description": "Nonprofit offering free financial counseling, debt management plans, housing counseling, and bankruptcy education.",
    "address": "100 Edgewood Ave NE, Suite 1800, Atlanta, GA 30303",
    "lat": 33.7537,
    "lng": -84.3801,
    "phone": "(404) 527-7630",
    "hours": "Mon-Thu 8am-6pm, Fri 8am-5pm",
    "eligibility": "Open to all. Free initial consultation.",
    "services": "Budget counseling, debt management, homebuyer education, foreclosure prevention, bankruptcy counseling",
    "languages": "English, Spanish",
    "transit_access": "Near Five Points MARTA Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "finance_003",
    "name": "Atlanta Prosperity Center - United Way",
    "category": ["financial", "education"],
    "description": "Free financial coaching and tax preparation services for low-to-moderate income families. Helps build savings and improve credit.",
    "address": "40 Courtland St NE, Atlanta, GA 30303",
    "lat": 33.7569,
    "lng": -84.3871,
    "phone": "(404) 527-7200",
    "hours": "Mon-Fri 9am-5pm, tax season extended hours Jan-Apr",
    "eligibility": "Household income under $60,000/year.",
    "services": "Free tax prep (VITA), financial coaching, credit building, savings programs, benefits screening",
    "languages": "English, Spanish",
    "transit_access": "Near Peachtree Center MARTA Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "transit_001",
    "name": "MARTA Reduced Fare Program",
    "category": ["transit", "financial"],
    "description": "Half-price fares on all MARTA bus and rail service for seniors, people with disabilities, and Medicare cardholders.",
    "address": "2424 Piedmont Rd NE, Atlanta, GA 30324",
    "lat": 33.8199,
    "lng": -84.3672,
    "phone": "(404) 848-5000",
    "hours": "Mon-Fri 8am-5pm for enrollment",
    "eligibility": "Seniors 65+, persons with disabilities, Medicare cardholders. Must apply with ID and proof.",
    "services": "50% reduced fares on bus and rail, paratransit eligibility",
    "languages": "English",
    "transit_access": "Lindbergh Center MARTA Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "transit_002",
    "name": "MARTA Mobility (Paratransit)",
    "category": ["transit", "disability"],
    "description": "Door-to-door shared ride service for people with disabilities who cannot use regular MARTA bus or rail service.",
    "address": "2424 Piedmont Rd NE, Atlanta, GA 30324",
    "lat": 33.8199,
    "lng": -84.3672,
    "phone": "(404) 848-5826",
    "hours": "Service hours match MARTA bus/rail. Reservations 1-3 days in advance.",
    "eligibility": "Must be certified through ADA paratransit eligibility process. Application required.",
    "services": "Door-to-door transportation, wheelchair accessible vehicles, personal care attendant rides free",
    "languages": "English",
    "transit_access": "Picks up from your location",
    "last_verified": "2026-03-15"
  },
  {
    "id": "health_001",
    "name": "Grady Memorial Hospital - Primary Care Center",
    "category": ["health", "emergency"],
    "description": "Atlanta's safety-net hospital providing medical care regardless of ability to pay. Offers primary care, specialty clinics, and emergency services.",
    "address": "80 Jesse Hill Jr Dr SE, Atlanta, GA 30303",
    "lat": 33.7535,
    "lng": -84.3832,
    "phone": "(404) 616-1000",
    "hours": "ER 24/7. Primary care clinic Mon-Fri 8am-5pm.",
    "eligibility": "Open to all. Sliding scale fees based on income. No one turned away for inability to pay.",
    "services": "Primary care, emergency care, mental health, dental, pharmacy, specialty clinics",
    "languages": "English, Spanish, interpreter services",
    "transit_access": "Adjacent to Georgia State MARTA Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "health_002",
    "name": "Good Samaritan Health Center",
    "category": ["health"],
    "description": "Nonprofit community health center providing affordable primary care, dental, vision, and behavioral health to uninsured and underinsured Atlanta residents.",
    "address": "1015 Donald Lee Hollowell Pkwy NW, Atlanta, GA 30318",
    "lat": 33.7708,
    "lng": -84.4264,
    "phone": "(404) 523-6571",
    "hours": "Mon-Thu 8am-5pm, Fri 8am-12pm",
    "eligibility": "Primarily serves uninsured/underinsured. Sliding scale fees starting at $20.",
    "services": "Primary care, dental, vision, behavioral health, pharmacy, diabetes management",
    "languages": "English, Spanish",
    "transit_access": "MARTA Bus Route 1, near Bankhead Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "health_003",
    "name": "Mercy Care - Downtown Atlanta",
    "category": ["health", "homeless"],
    "description": "Federally qualified health center specializing in care for people experiencing homelessness. No insurance or ID required.",
    "address": "114 Nassau St NW, Atlanta, GA 30303",
    "lat": 33.7578,
    "lng": -84.3968,
    "phone": "(678) 843-8600",
    "hours": "Mon-Fri 8am-5pm",
    "eligibility": "Open to all, specializes in serving homeless and uninsured populations. No ID required.",
    "services": "Primary care, dental, behavioral health, substance abuse, HIV services, street medicine",
    "languages": "English, Spanish",
    "transit_access": "Near Five Points MARTA Station, 0.4mi walk",
    "last_verified": "2026-03-15"
  },
  {
    "id": "legal_001",
    "name": "Atlanta Legal Aid Society",
    "category": ["legal", "housing"],
    "description": "Free civil legal services for low-income residents. Handles eviction defense, domestic violence, public benefits, and consumer issues.",
    "address": "54 Ellis St NE, Atlanta, GA 30303",
    "lat": 33.7569,
    "lng": -84.3876,
    "phone": "(404) 524-5811",
    "hours": "Mon-Fri 9am-5pm. Intake line opens 9am.",
    "eligibility": "Income at or below 200% federal poverty level. Must be a resident of metro Atlanta.",
    "services": "Eviction defense, domestic violence protection orders, SNAP/Medicaid appeals, consumer debt defense",
    "languages": "English, Spanish, interpreter available",
    "transit_access": "Near Peachtree Center MARTA Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "legal_002",
    "name": "Georgia Legal Services Program - Atlanta Office",
    "category": ["legal"],
    "description": "Free legal help for low-income Georgians on civil matters including housing, family law, public benefits, and consumer protection.",
    "address": "104 Marietta St NW, Suite 250, Atlanta, GA 30303",
    "lat": 33.7572,
    "lng": -84.3941,
    "phone": "(404) 206-5175",
    "hours": "Mon-Fri 8:30am-5pm",
    "eligibility": "Low-income Georgia residents. Income screening required.",
    "services": "Housing law, family law, public benefits, consumer protection, elder law",
    "languages": "English, Spanish",
    "transit_access": "Near Five Points MARTA Station",
    "last_verified": "2026-03-15"
  },
  {
    "id": "education_001",
    "name": "Atlanta Public Schools Adult Education",
    "category": ["education", "jobs"],
    "description": "Free GED preparation classes, English language classes (ESOL), and adult literacy programs for Atlanta residents.",
    "address": "2930 Forrest Hill Dr SW, Atlanta, GA 30315",
    "lat": 33.7072,
    "lng": -84.4094,
    "phone": "(404) 802-2220",
    "hours": "Mon-Thu 8am-8pm (day and evening classes available)",
    "eligibility": "Atlanta residents 16+ who are not enrolled in high school.",
    "services": "GED prep, ESOL/English classes, adult literacy, digital skills, career pathway counseling",
    "languages": "English, Spanish, multilingual support",
    "transit_access": "MARTA Bus Route 83",
    "last_verified": "2026-03-15"
  }
]
JSONEOF

# ── data/seed_db.py ──
cat > data/seed_db.py << 'PYEOF'
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from rag import load_resources_into_db

if __name__ == "__main__":
    load_resources_into_db(
        os.path.join(os.path.dirname(__file__), "resources.json")
    )
    print("Database seeded successfully!")
PYEOF

# ── frontend/index.html ──
cat > frontend/index.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ATL Connect</title>
  <link rel="stylesheet" href="style.css" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
</head>
<body>
  <div class="app">
    <header class="header">
      <div class="logo">
        <span class="logo-icon">📍</span>
        <h1>ATL Connect</h1>
      </div>
      <p class="tagline">Your AI guide to Atlanta community resources</p>
    </header>

    <div class="categories">
      <button class="cat-btn" data-query="I need help finding food near me">🍎 Food</button>
      <button class="cat-btn" data-query="I need help with housing or shelter">🏠 Housing</button>
      <button class="cat-btn" data-query="I'm looking for job training and career help">💼 Jobs</button>
      <button class="cat-btn" data-query="I need help with bills and financial assistance">💰 Financial</button>
      <button class="cat-btn" data-query="I need affordable healthcare or a doctor">🏥 Health</button>
      <button class="cat-btn" data-query="I need free legal help">⚖️ Legal</button>
    </div>

    <div class="chat-container" id="chatContainer">
      <div class="message bot-message">
        <div class="message-content">
          <strong>ATL Connect</strong>
          <p>Hey there! I'm ATL Connect — I help Atlanta residents find community
          resources like food assistance, housing, job training, financial help,
          healthcare, and legal aid.</p>
          <p>Tell me what you need help with, or tap a category above to get started.
          The more you share about your situation, the better I can help.</p>
        </div>
      </div>
    </div>

    <div class="input-area">
      <div class="input-wrapper">
        <input type="text" id="userInput" placeholder="Tell me what you need help with..." autocomplete="off" />
        <button id="sendBtn" onclick="sendMessage()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
      <p class="disclaimer">ATL Connect uses AI to match you with real Atlanta resources.
      Always verify details by calling ahead. For emergencies, dial 911.</p>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>
HTMLEOF

# ── frontend/style.css ──
cat > frontend/style.css << 'CSSEOF'
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: "Inter", -apple-system, sans-serif;
  background: #0f1117;
  color: #e4e4e7;
  height: 100vh;
  display: flex;
  justify-content: center;
}

.app {
  width: 100%;
  max-width: 720px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #16181f;
}

.header { padding: 20px 24px 12px; border-bottom: 1px solid #2a2d37; }
.logo { display: flex; align-items: center; gap: 10px; }
.logo-icon { font-size: 28px; }
.logo h1 {
  font-size: 22px; font-weight: 700;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.tagline { font-size: 13px; color: #71717a; margin-top: 4px; margin-left: 42px; }

.categories {
  display: flex; gap: 8px; padding: 14px 24px;
  overflow-x: auto; border-bottom: 1px solid #2a2d37;
}
.cat-btn {
  background: #1e2028; border: 1px solid #2a2d37; color: #a1a1aa;
  padding: 8px 14px; border-radius: 20px; font-size: 13px;
  cursor: pointer; white-space: nowrap; transition: all 0.2s;
  font-family: "Inter", sans-serif;
}
.cat-btn:hover { background: #2a2d37; color: #e4e4e7; border-color: #60a5fa; }

.chat-container {
  flex: 1; overflow-y: auto; padding: 20px 24px;
  display: flex; flex-direction: column; gap: 16px;
}
.message { max-width: 85%; animation: fadeIn 0.3s ease; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.bot-message { align-self: flex-start; }
.user-message { align-self: flex-end; }
.user-message .message-content {
  background: #3b82f6; color: white;
  border-radius: 18px 18px 4px 18px; padding: 12px 16px;
}
.bot-message .message-content {
  background: #1e2028; border: 1px solid #2a2d37;
  border-radius: 18px 18px 18px 4px; padding: 16px 18px;
}
.bot-message strong {
  color: #60a5fa; font-size: 12px;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.bot-message p { margin-top: 8px; line-height: 1.6; font-size: 14px; }

.typing-indicator { display: flex; gap: 4px; padding: 8px 0; }
.typing-indicator span {
  width: 8px; height: 8px; background: #60a5fa;
  border-radius: 50%; animation: bounce 1.4s infinite;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-8px); }
}

.input-area { padding: 16px 24px 20px; border-top: 1px solid #2a2d37; }
.input-wrapper {
  display: flex; gap: 10px; background: #1e2028;
  border: 1px solid #2a2d37; border-radius: 14px;
  padding: 6px 6px 6px 18px; transition: border-color 0.2s;
}
.input-wrapper:focus-within { border-color: #60a5fa; }
#userInput {
  flex: 1; background: transparent; border: none; outline: none;
  color: #e4e4e7; font-size: 14px; font-family: "Inter", sans-serif;
}
#userInput::placeholder { color: #52525b; }
#sendBtn {
  background: #3b82f6; border: none; border-radius: 10px;
  color: white; width: 40px; height: 40px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.2s;
}
#sendBtn:hover { background: #2563eb; }
#sendBtn:disabled { background: #374151; cursor: not-allowed; }
.disclaimer {
  font-size: 11px; color: #52525b; text-align: center;
  margin-top: 10px; line-height: 1.4;
}
CSSEOF

# ── frontend/app.js ──
cat > frontend/app.js << 'JSEOF'
const API_URL = "http://localhost:8000";
const chatContainer = document.getElementById("chatContainer");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

let conversationHistory = [];

document.querySelectorAll(".cat-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    userInput.value = btn.getAttribute("data-query");
    sendMessage();
  });
});

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  addMessage(message, "user");
  userInput.value = "";
  sendBtn.disabled = true;

  const typingEl = showTyping();

  try {
    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_history: conversationHistory,
      }),
    });

    const data = await res.json();
    typingEl.remove();
    addMessage(data.reply, "bot");

    conversationHistory.push({ role: "user", content: message });
    conversationHistory.push({ role: "assistant", content: data.reply });

    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }
  } catch (err) {
    typingEl.remove();
    addMessage(
      "Sorry, I'm having trouble connecting right now. Please try again, or call 211 for immediate help.",
      "bot"
    );
    console.error("Error:", err);
  }

  sendBtn.disabled = false;
  userInput.focus();
}

function addMessage(text, sender) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender}-message`;

  const content = document.createElement("div");
  content.className = "message-content";

  if (sender === "bot") {
    content.innerHTML = `<strong>ATL Connect</strong>${formatResponse(text)}`;
  } else {
    content.innerHTML = `<p>${escapeHtml(text)}</p>`;
  }

  msgDiv.appendChild(content);
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function formatResponse(text) {
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/^(\d+)\.\s/gm, "<br><strong>$1.</strong> ");
  return text
    .split("\n\n")
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function showTyping() {
  const el = document.createElement("div");
  el.className = "message bot-message";
  el.innerHTML = `
    <div class="message-content">
      <strong>ATL Connect</strong>
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  chatContainer.appendChild(el);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return el;
}

function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}
JSEOF

echo ""
echo "✅ All files created! Next steps:"
echo ""
echo "  1. Add your API key:  Edit .env and replace sk-ant-your-key-here"
echo ""
echo "  2. Install deps:"
echo "     cd backend"
echo "     python -m venv venv"
echo "     source venv/bin/activate"
echo "     pip install -r requirements.txt"
echo ""
echo "  3. Seed the database:"
echo "     cd ../data"
echo "     python seed_db.py"
echo ""
echo "  4. Start the backend:"
echo "     cd ../backend"
echo "     python main.py"
echo ""
echo "  5. Start the frontend (new terminal):"
echo "     cd frontend"
echo "     python -m http.server 3000"
echo ""
echo "  6. Open http://localhost:3000"
echo ""
echo "  7. Commit everything:"
echo "     git add -A"
echo "     git commit -m 'Initial project setup — ATL Connect'"
echo "     git push origin main"
echo ""
echo "🎰 Go win Hacklanta!"
