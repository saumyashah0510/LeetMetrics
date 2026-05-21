from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.core.config import settings

# asyncpg expects 'ssl' instead of 'sslmode' in the connection string
# and requires the postgresql+asyncpg:// dialect
db_url = settings.DATABASE_URL.strip("'\" ")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# asyncpg does not support channel_binding, which Neon sometimes appends
if "&channel_binding=require" in db_url:
    db_url = db_url.replace("&channel_binding=require", "")
elif "?channel_binding=require" in db_url:
    db_url = db_url.replace("?channel_binding=require", "")

# Create the async SQLAlchemy engine
engine = create_async_engine(db_url, echo=False)

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
