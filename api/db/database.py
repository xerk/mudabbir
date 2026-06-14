import os

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(DATABASE_URL, echo=True)
# Proper async session factory. `sessionmaker(engine)` returns a *sync* Session
# bound to an async engine, which breaks `async with async_session()`.
async_session = async_sessionmaker(engine, expire_on_commit=False)
