import os

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/wellspent_test",
)
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("MY_SWISS_TOURISM_API", "test-swiss-tourism-key")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
