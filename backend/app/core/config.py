import os

from dotenv import load_dotenv

load_dotenv()


def get_required_setting(name: str) -> str:
    value = os.getenv(name, "").strip()

    if not value or value.startswith("REPLACE_"):
        raise RuntimeError(f"{name} is not configured.")

    return value


def get_jwt_secret() -> str:
    secret = get_required_setting("JWT_SECRET")

    if len(secret) < 32:
        raise RuntimeError(
            "JWT_SECRET must contain at least 32 characters."
        )

    return secret


def get_access_token_expire_minutes() -> int:
    raw = os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "30",
    )

    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(
            "ACCESS_TOKEN_EXPIRE_MINUTES must be an integer."
        ) from exc

    if value <= 0:
        raise RuntimeError(
            "ACCESS_TOKEN_EXPIRE_MINUTES must be greater than zero."
        )

    return value