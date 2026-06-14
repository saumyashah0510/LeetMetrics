import uuid
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.core.database import Base
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, nullable=False)
    ranking = Column(Integer)
    rating = Column(Float)
    session_cookie = Column(Text)
    last_sync_timestamp = Column(Integer, default=0)
    last_synced_at = Column(DateTime(timezone=True))
    
    sync_logs = relationship("SyncLog", back_populates="user")
    submissions = relationship("Submission", back_populates="user")
    mastery_scores = relationship("MasteryScore", back_populates="user")
    contest_history = relationship("ContestHistory", back_populates="user")

class SyncLog(Base):
    __tablename__ = "sync_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    status = Column(String) # 'success', 'failed', 'in_progress'
    error_message = Column(Text)
    
    user = relationship("User", back_populates="sync_logs")

class Problem(Base):
    __tablename__ = "problems"
    url_name = Column(String, primary_key=True)
    frontend_id = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    difficulty = Column(String)
    ac_rate = Column(Float)
    leetcode_topics = Column(JSONB)
    
    submissions = relationship("Submission", back_populates="problem")

class DSACurriculum(Base):
    __tablename__ = "dsa_curriculum"
    id = Column(Integer, primary_key=True, autoincrement=True)
    major_category = Column(String, nullable=False)
    sub_pattern = Column(String, nullable=False)

class ProblemCurriculumMapping(Base):
    __tablename__ = "problem_curriculum_mapping"
    problem_url_name = Column(String, ForeignKey("problems.url_name", ondelete="CASCADE"), primary_key=True)
    curriculum_id = Column(Integer, ForeignKey("dsa_curriculum.id", ondelete="CASCADE"), primary_key=True)
    is_manual_override = Column(Boolean, default=False)

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    problem_url_name = Column(String, ForeignKey("problems.url_name", ondelete="CASCADE"))
    timestamp = Column(DateTime(timezone=True), nullable=False)
    runtime = Column(Integer)
    memory = Column(Integer)
    language = Column(String)
    code = Column(Text)

    user = relationship("User", back_populates="submissions")
    problem = relationship("Problem", back_populates="submissions")

class MasteryScore(Base):
    __tablename__ = "mastery_scores"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    curriculum_id = Column(Integer, ForeignKey("dsa_curriculum.id", ondelete="CASCADE"))
    score = Column(Float, nullable=False)
    computed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="mastery_scores")

class Contest(Base):
    __tablename__ = "contests"
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)

class ContestHistory(Base):
    __tablename__ = "contest_history"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    contest_id = Column(Integer, ForeignKey("contests.id", ondelete="CASCADE"))
    rating = Column(Float)
    ranking = Column(Integer)
    problems_solved = Column(Integer)
    finish_time_seconds = Column(Integer)

    user = relationship("User", back_populates="contest_history")

class CompanyQuestion(Base):
    __tablename__ = "company_questions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String, nullable=False)
    timeframe = Column(String, nullable=False)
    problem_url_name = Column(String, ForeignKey("problems.url_name", ondelete="CASCADE"), nullable=False)
    frequency_score = Column(Float)
    importance_level = Column(String)

    problem = relationship("Problem")
