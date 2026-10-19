from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash

PASSWORD_HASHER = PasswordHash.recommended()

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return PASSWORD_HASHER.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return PASSWORD_HASHER.verify(password, password_hash)


def create_access_token(
    subject: str,
    company_id: str | None,
    role: str,
    secret_key: str,
    expires_minutes: int,
) -> str:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=expires_minutes)

    payload = {
        "sub": subject,
        "company_id": company_id,
        "role": role,
        "iat": now,
        "exp": expires_at,
    }

    return jwt.encode(payload, secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str, secret_key: str) -> dict:
    return jwt.decode(
        token,
        secret_key,
        algorithms=[ALGORITHM],
    )