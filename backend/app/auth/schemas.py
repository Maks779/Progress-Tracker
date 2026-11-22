from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints

from app.users.schemas import Language, Password, PersonName, TimezoneName

ClientKind = Literal["web", "native"]


class RegisterRequest(BaseModel):
    name: PersonName
    email: EmailStr
    password: Password
    timezone: TimezoneName
    language: Language


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


ResetToken = Annotated[str, StringConstraints(min_length=1, max_length=256)]


class ResetTokenCheck(BaseModel):
    token: ResetToken


class ResetPasswordRequest(BaseModel):
    token: ResetToken
    new_password: Password


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    refresh_token: str | None = None
