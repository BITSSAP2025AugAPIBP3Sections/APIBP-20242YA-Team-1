from strawberry.fastapi import GraphQLRouter
from app.graphql.schema import schema  # updated path to schema
from app.core.orchestrator import VendorKnowledgeOrchestrator

def get_context():
    # Provide a fresh orchestrator per request to avoid shared mutable state
    return {"orchestrator": VendorKnowledgeOrchestrator()}

# FastAPI router to mount in main.py with context injection
graphql_router = GraphQLRouter(schema, context_getter=get_context)
