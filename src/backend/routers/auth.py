from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from uuid import uuid4
from datetime import datetime

from database import SessionLocal
from models import User
from schemas import (
    UserCreate,
    UserOut,
    Token,
    LoginRequest,
    VerificationToken,
    MessageOut,
    ResendVerificationRequest,
)
from security import hash_password, verify_password
from auth_utils import create_access_token
from dependencies import get_db, get_current_user
from tasks import send_verification_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    email = user_in.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    token = str(uuid4())
    now = datetime.utcnow()
    user = User(
        email=email,
        full_name=user_in.full_name,
        institution=user_in.institution,
        password_hash=hash_password(user_in.password),
        is_verified=False,
        verification_token=token,
        verification_sent_at=now,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    send_verification_email.apply_async(args=[user.email, user.full_name, token])
    return user


@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    email = request.email.lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email not verified. Please check your inbox.")
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/verify", response_model=MessageOut)
def verify_email(token_in: VerificationToken, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verification_token == token_in.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token.")
    user.is_verified = True
    user.verification_token = None
    user.verification_sent_at = None
    db.commit()
    return {"message": "Email verified successfully."}


@router.post("/resend-verification", response_model=MessageOut)
def resend_verification(request: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified.")
    token = str(uuid4())
    user.verification_token = token
    user.verification_sent_at = datetime.utcnow()
    db.commit()
    send_verification_email.apply_async(args=[user.email, user.full_name, token])
    return {"message": "Verification email resent."}
