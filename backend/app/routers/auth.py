"""Authentication endpoints with JWT access/refresh pairs and Redis revocation."""
import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user, rate_limit_login
from app.core.redis import get_redis
from app.core.security import (
    REFRESH_TOKEN_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.user import User
from app.schemas import LoginRequest, RefreshRequest, TokenPair, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)


@router.post("/login", response_model=TokenPair, dependencies=[Depends(rate_limit_login)])
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.username == payload.username)).scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    settings = get_settings()
    return TokenPair(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
        role=user.role,
    )


@router.post("/refresh", response_model=TokenPair)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    claims = decode_token(payload.refresh_token, REFRESH_TOKEN_TYPE)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    try:
        r = get_redis()
        if r.exists(f"bl:r:{claims.get('jti')}"):
            raise HTTPException(status_code=401, detail="Refresh token revoked")
    except HTTPException:
        raise
    except Exception:
        pass
    user = db.get(User, int(claims["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return TokenPair(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
        role=user.role,
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/logout")
def logout(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    user: User = Depends(get_current_user),
):
    try:
        r = get_redis()
        access_claims = decode_token(credentials.credentials, "access") if credentials else None
        if access_claims and access_claims.get("jti"):
            ttl = get_settings().access_token_expire_minutes * 60
            r.setex(f"bl:{access_claims['jti']}", ttl, "1")
        body = request.headers.get("x-refresh-token")
        if body:
            refresh_claims = decode_token(body, REFRESH_TOKEN_TYPE)
            if refresh_claims and refresh_claims.get("jti"):
                r.setex(f"bl:r:{refresh_claims['jti']}", get_settings().refresh_token_expire_days * 86400, "1")
    except Exception:
        pass
    return {"ok": True}
