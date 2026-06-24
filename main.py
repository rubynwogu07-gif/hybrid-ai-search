from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import httpx
import os

app = FastAPI(title="Hybrid AI Search API")

# Allow your frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get your API key from environment variables
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

class SearchRequest(BaseModel):
    query: str
    ai_enabled: bool = True

class SearchResult(BaseModel):
    title: str
    snippet: str
    url: str
    source: str
    type: str = "result"

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    ai_answer: Optional[str] = None

@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    # Search DuckDuckGo
    results = await search_duckduckgo(request.query)
    
    # Generate AI summary if enabled
    ai_answer = None
    if request.ai_enabled and GROQ_API_KEY and results:
        ai_answer = await generate_ai_summary(request.query, results)
    
    return SearchResponse(
        query=request.query,
        results=results,
        ai_answer=ai_answer
    )

async def search_duckduckgo(query: str) -> List[dict]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.duckduckgo.com/",
                params={
                    "q": query,
                    "format": "json",
                    "no_html": "1",
                    "skip_disambig": "1"
                }
            )
            data = response.json()
            results = []
            
            if data.get("AbstractText"):
                results.append({
                    "title": data.get("Heading", query),
                    "snippet": data["AbstractText"],
                    "url": data.get("AbstractURL", f"https://duckduckgo.com/?q={query}"),
                    "source": "DuckDuckGo",
                    "type": "featured"
                })
            
            for topic in data.get("RelatedTopics", [])[:9]:
                if topic.get("FirstURL") and topic.get("Text"):
                    results.append({
                        "title": topic["Text"].split(" - ")[0] if " - " in topic["Text"] else topic["Text"],
                        "snippet": topic["Text"],
                        "url": topic["FirstURL"],
                        "source": "DuckDuckGo",
                        "type": "result"
                    })
            
            return results
    except Exception as e:
        print(f"Search error: {e}")
        return []

async def generate_ai_summary(query: str, results: List[dict]) -> Optional[str]:
    if not GROQ_API_KEY:
        return None
    
    context = "\n".join([
        f"Source {i+1}: {r['title']}\n{r['snippet']}"
        for i, r in enumerate(results[:3])
    ])
    
    prompt = f"""Based on these search results, answer the query briefly and accurately.

Query: {query}

Results:
{context}

Answer:"""
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama3-8b-8192",
                    "messages": [
                        {"role": "system", "content": "You are a helpful search assistant. Provide concise, accurate answers."},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": 400,
                    "temperature": 0.3
                }
            )
            data = response.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"AI error: {e}")
        return None

@app.get("/health")
async def health_check():
    return {"status": "ok"}
