from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os, sys, uuid, sqlite3, json, shutil, zipfile
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from carousel_generator import generate_carousel

app = FastAPI(title="VIReYou Carousel Generator")
DB_PATH = os.path.join(os.path.dirname(__file__), "data.db")
OUTPUT_BASE = os.path.join(os.path.dirname(__file__), "output")

def init_db():
    con = sqlite3.connect(DB_PATH)
    con.execute("""CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at TEXT,
        palette TEXT,
        status TEXT,
        slides_json TEXT
    )""")
    con.commit()
    con.close()

init_db()

class SlideData(BaseModel):
    type: str
    headline: Optional[str] = None
    hashtag: Optional[str] = "#VIReyou_bot"
    quote: Optional[str] = None
    body: Optional[str] = None
    heading: Optional[str] = None
    items: Optional[List[dict]] = []
    myth: Optional[str] = None
    fact: Optional[str] = None
    cta: Optional[str] = None
    tagline: Optional[str] = None

class GenerateRequest(BaseModel):
    session_id: str
    slides: List[SlideData]
    palette: str = "cream"

@app.get("/health")
def health():
    return {"status": "ok", "service": "vireyou-carousel"}

@app.post("/generate")
def generate(req: GenerateRequest):
    session_id = req.session_id or str(uuid.uuid4())
    out_dir = os.path.join(OUTPUT_BASE, session_id)
    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)

    slides_data = [s.dict() for s in req.slides]
    try:
        paths = generate_carousel(slides_data, out_dir, req.palette)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    con = sqlite3.connect(DB_PATH)
    con.execute("""INSERT OR REPLACE INTO sessions(id,created_at,palette,status,slides_json)
                   VALUES(?,?,?,?,?)""",
                (session_id, datetime.utcnow().isoformat(), req.palette,
                 "done", json.dumps(slides_data)))
    con.commit()
    con.close()

    filenames = [os.path.basename(p) for p in paths]
    return {"session_id": session_id, "slides": filenames, "count": len(filenames)}

@app.get("/slide/{session_id}/{filename}")
def get_slide(session_id: str, filename: str):
    path = os.path.join(OUTPUT_BASE, session_id, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Slide not found")
    return FileResponse(path, media_type="image/png")

@app.get("/download/{session_id}")
def download_zip(session_id: str):
    out_dir = os.path.join(OUTPUT_BASE, session_id)
    if not os.path.exists(out_dir):
        raise HTTPException(status_code=404, detail="Session not found")
    zip_path = os.path.join(OUTPUT_BASE, f"{session_id}.zip")
    with zipfile.ZipFile(zip_path, "w") as zf:
        for f in sorted(os.listdir(out_dir)):
            if f.endswith(".png"):
                zf.write(os.path.join(out_dir, f), f)
    return FileResponse(zip_path, media_type="application/zip",
                        filename="vireyou_carousel.zip")
