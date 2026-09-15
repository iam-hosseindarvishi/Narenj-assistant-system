"""FastAPI dependencies for authentication, roles, and rate limiting."""
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.redis import get_redis
from app.core.security import ACCESS_TOKEN_TYPE, decode_token
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(request: Request, scope: str, limit_per_minute: int) -> None:
    """Fixed-window rate limiter backed by Redis; raises 429 when exceeded."""
    try:
        r = get_redis()
        key = f"rl:{scope}:{_client_ip(request)}:{int(request.scope.get('time', 0)) // 60 if 'time' in request.scope else __import__('time').time() // 60}"
        minute = int(__import__("time").time() // 60)
        key = f"rl:{scope}:{_client_ip(request)}:{minute}"
        current = r.incr(key)
        if current == 1:
            r.expire(key, 65)
        if current > limit_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests, please slow down",
            )
    except HTTPException:
        raise
    except Exception:
        # Redis unavailable: fail open rather than blocking the API
        pass


def rate_limit_login(request: Request) -> None:
    from app.core.config import get_settings

    rate_limit(request, "login", get_settings().rate_limit_login_per_minute)


def rate_limit_api(request: Request) -> None:
    from app.core.config import get_settings

    rate_limit(request, "api", get_settings().rate_limit_api_per_minute)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = credentials.credentials

    # Logout blacklists the token's jti in Redis
    try:
        claims_probe = decode_token(token, ACCESS_TOKEN_TYPE)
    except Exception:
        claims_probe = None
    if claims_probe and claims_probe.get("jti"):
        try:
            if get_redis().exists(f"bl:{claims_probe['jti']}"):
                raise HTTPException(status_code=401, detail="Token revoked")
        except HTTPException:
            raise
        except Exception:
            pass

    claims = decode_token(token, ACCESS_TOKEN_TYPE)
    if not claims:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    sub = str(claims.get("sub", ""))
    try:
        user_id_str, role = sub.split(":", 1)
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(status_code=401, detail="Malformed token subject")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if role != user.role:
        raise HTTPException(status_code=401, detail="Role mismatch")
    return user


def require_roles(*roles: str):
    """Dependency factory enforcing one of the allowed roles."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return checker


# Common role bundles: viewer reads; operator mutates; admin manages users/templates
require_viewer = require_roles("admin", "operator", "viewer")
require_operator = require_roles("admin", "operator")
require_admin = require_roles("admin")
