
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base

app = FastAPI(
    title="ApexiveAI Workforce Payroll SaaS",
    version="0.1.0",
    description="Multi-company workforce, attendance and payroll platform",
)

# Development frontend origins only. Restrict production origins
# through environment configuration before public deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health", tags=["System"])
def health():
    return {
        "status": "ok",
        "service": "ApexiveAI Workforce Payroll SaaS",
        "version": "0.1.0",
    }


@app.get("/health/database", tags=["System"])
def database_health():
    from sqlalchemy import text
    from app.database import get_engine

    with get_engine().connect() as connection:
        connection.execute(text("SELECT 1"))

    return {"status": "ok", "database": "connected"}
