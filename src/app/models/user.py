from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import JSON, DateTime, Enum, Float, ForeignKey, String, Text, func
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


# ── Trip ─────────────────────────────────────────────


class TripStatus(enum.StrEnum):
    DRAFT = "draft"
    RECOMMENDED = "recommended"
    BOOKED = "booked"
    CANCELLED = "cancelled"


class Trip(Base):
    __tablename__ = "trips"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    destination: Mapped[str] = mapped_column(String(255))
    status: Mapped[TripStatus] = mapped_column(
        Enum(TripStatus), default=TripStatus.DRAFT
    )
    description: Mapped[str | None] = mapped_column(Text, default=None)
    itinerary: Mapped[dict | None] = mapped_column(JSON, default=None)

    user: Mapped[User] = relationship(back_populates="trips")
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
