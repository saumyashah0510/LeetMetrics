from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    
    class Config:
        env_file = ".env"
        # In case the .env is run from the app directory, we can give a relative path
        # But generally it's fine if we run from the backend directory.

settings = Settings()
