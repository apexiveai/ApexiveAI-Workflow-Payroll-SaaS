
from getpass import getpass

from sqlalchemy import select

from app.core.security import hash_password
from app.database import get_session_factory
from app.models import User


def main() -> None:
    print("\nAPEXIVEAI WORKFORCE PAYROLL SAAS")
    print("SUPER ADMIN INITIAL SETUP\n")

    username = input("Super Admin username: ").strip().lower()
    email = input("Super Admin email (optional): ").strip().lower() or None

    if len(username) < 3 or len(username) > 100:
        print("ERROR: Username must be 3-100 characters.")
        return

    if email and ("@" not in email or len(email) > 255):
        print("ERROR: Enter a valid email address.")
        return

    password = getpass("New password (minimum 12 characters): ")
    confirm_password = getpass("Confirm password: ")

    if len(password) < 12:
        print("ERROR: Password must contain at least 12 characters.")
        return

    if password != confirm_password:
        print("ERROR: Passwords do not match.")
        return

    SessionLocal = get_session_factory()

    with SessionLocal() as db:
        existing_admin = db.scalar(
            select(User.id).where(User.role == "SUPER_ADMIN").limit(1)
        )

        if existing_admin:
            print("ERROR: A SUPER_ADMIN already exists.")
            print("No account was created.")
            return

        existing_username = db.scalar(
            select(User.id).where(
                User.username == username,
                User.company_id.is_(None),
            ).limit(1)
        )

        if existing_username:
            print("ERROR: This username already exists.")
            return

        if email:
            existing_email = db.scalar(
                select(User.id).where(User.email == email).limit(1)
            )
            if existing_email:
                print("ERROR: This email is already registered.")
                return

        admin = User(
            company_id=None,
            username=username,
            email=email,
            password_hash=hash_password(password),
            role="SUPER_ADMIN",
            is_active=True,
        )

        db.add(admin)
        db.commit()

        print("\nSUCCESS: Super Admin created.")
        print(f"Username: {username}")
        print("Role: SUPER_ADMIN")
        print("Password: not displayed")
        print("\nKeep your credentials secure.")


if __name__ == "__main__":
    main()
