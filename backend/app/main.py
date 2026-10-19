import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.database import get_engine

app = FastAPI(
    title="ApexiveAI Workforce Payroll SaaS",
    version="0.1.0",
    description=(
        "Multi-company workforce, attendance and payroll platform"
    ),
)

cors_origins = [
    item.strip()
    for item in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000",
    ).split(",")
    if item.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
)

app.include_router(auth_router)


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

    engine = get_engine()

    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT 1")
        ).scalar()

    return {
        "status": "ok",
        "database": "connected",
        "result": result,
    }