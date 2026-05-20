from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# Create the async SQLAlchemy engine
# echo=True is useful for debugging to see the raw SQL queries being executed
engine = create_async_engine(settings.DATABASE_URL, echo=False)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

# Base class for SQLAlchemy models
Base = declarative_base()

# Dependency to get DB session in FastAPI endpoints
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
