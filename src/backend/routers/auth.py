from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from uuid import uuid4
from datetime import datetime
import os
from PIL import Image
from fastapi.responses import FileResponse

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
from app import DEVELOPER_MODE

router = APIRouter(prefix="/api/auth", tags=["auth"])

PROFILE_DIR = os.path.join(os.path.dirname(__file__), "..", "private", "profile_pics")
os.makedirs(PROFILE_DIR, exist_ok=True)


def user_to_out(user: User) -> UserOut:
    data = UserOut.from_orm(user)
    if user.profile_picture:
        data.profile_picture_url = "/api/auth/profile-picture"
    else:
        data.profile_picture_url = None
    return data


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    email = user_in.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    hashed_pw = hash_password(user_in.password)
    if DEVELOPER_MODE:
        new_user = User(
            email=email,
            full_name=user_in.full_name,
            institution=user_in.institution,
            password_hash=hashed_pw,
            is_verified=True,
            verification_token=None,
            verification_sent_at=None,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return user_to_out(new_user)
    token = str(uuid4())
    now = datetime.utcnow()
    new_user = User(
        email=email,
        full_name=user_in.full_name,
        institution=user_in.institution,
        password_hash=hashed_pw,
        is_verified=False,
        verification_token=token,
        verification_sent_at=now,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    send_verification_email.apply_async(args=[new_user.email, new_user.full_name, token])
    return user_to_out(new_user)


@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    email = request.email.lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not DEVELOPER_MODE and not user.is_verified:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email not verified. Please check your inbox.")
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return user_to_out(current_user)


@router.post("/verify", response_model=MessageOut)
def verify_email(token_in: VerificationToken, db: Session = Depends(get_db)):
    if DEVELOPER_MODE:
        return {"message": "Email verification disabled in developer mode."}
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
    if DEVELOPER_MODE:
        return {"message": "Email resend disabled in developer mode."}
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


@router.post("/profile-picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        image = Image.open(file.file).convert("L")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")
    filename = f"{current_user.id}.png"
    path = os.path.join(PROFILE_DIR, filename)
    image.save(path)
    current_user.profile_picture = filename
    db.commit()
    return {"url": "/api/auth/profile-picture"}


@router.get("/profile-picture")
async def get_profile_picture(current_user: User = Depends(get_current_user)):
    if not current_user.profile_picture:
        raise HTTPException(status_code=404, detail="No profile picture")
    path = os.path.join(PROFILE_DIR, current_user.profile_picture)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="image/png")
