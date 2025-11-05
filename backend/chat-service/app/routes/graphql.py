from strawberry.fastapi import GraphQLRouter
from app.graphql.schema import schema  # updated path to schema

# FastAPI router to mount in main.py
graphql_router = GraphQLRouter(schema)
