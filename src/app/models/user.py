from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# ── User ─────────────────────────────────────────────


class User(Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    preferences: Mapped[dict | None] = mapped_column(JSON, default=None)

    trips: Mapped[list[Trip]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    folders: Mapped[list[Folder]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


# ── Folder ───────────────────────────────────────────


class Folder(Base):
    __tablename__ = "folders"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_folders_user_id_name"),
    )

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, default=None)

    user: Mapped[User] = relationship(back_populates="folders")
    trips: Mapped[list[Trip]] = relationship(back_populates="folder")


# ── Trip ─────────────────────────────────────────────


class TripStatus(enum.StrEnum):
    DRAFT = "draft"
    RECOMMENDED = "recommended"
    BOOKED = "booked"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Trip(Base):
    __tablename__ = "trips"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    folder_id: Mapped[int | None] = mapped_column(
        ForeignKey("folders.id", ondelete="SET NULL"), index=True, default=None
    )
    title: Mapped[str] = mapped_column(String(255))
    destination: Mapped[str] = mapped_column(String(255))
    status: Mapped[TripStatus] = mapped_column(
        Enum(TripStatus), default=TripStatus.DRAFT
    )
    description: Mapped[str | None] = mapped_column(Text, default=None)
    itinerary: Mapped[dict | None] = mapped_column(JSON, default=None)
    shared_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=None
    )

    user: Mapped[User] = relationship(back_populates="trips")
    folder: Mapped[Folder | None] = relationship(back_populates="trips")
    bookings: Mapped[list[Booking]] = relationship(
        back_populates="trip", cascade="all, delete-orphan"
    )


# ── Booking ──────────────────────────────────────────


class BookingStatus(enum.StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class BookingType(enum.StrEnum):
    FLIGHT = "flight"
    HOTEL = "hotel"
    ACTIVITY = "activity"


class Booking(Base):
    __tablename__ = "bookings"

    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), index=True)
    booking_type: Mapped[BookingType] = mapped_column(Enum(BookingType))
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus), default=BookingStatus.PENDING
    )
    provider: Mapped[str] = mapped_column(String(100))
    provider_ref: Mapped[str | None] = mapped_column(String(255), default=None)
    price: Mapped[float | None] = mapped_column(Float, default=None)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    details: Mapped[dict | None] = mapped_column(JSON, default=None)

    trip: Mapped[Trip] = relationship(back_populates="bookings")


# ── Waitlist ────────────────────────────────────────


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), default=None)
