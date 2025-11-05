import strawberry
from strawberry.types import Info
# Removed module-level orchestrator; will be provided per request via context
from app.core.orchestrator import VendorKnowledgeOrchestrator  # kept for type hints if needed

@strawberry.type
class Query:
    @strawberry.field
    def vendorQuery(self, question: str, info: Info) -> str:
        orchestrator = info.context["orchestrator"]
        data = orchestrator.answer_query(question=question)
        if not data.get("success"):
            raise strawberry.exceptions.GraphQLError(data.get("message", "An unexpected error occurred while processing the vendor query"))
        return data.get("answer", "")

    @strawberry.field
    def health(self, info: Info) -> str:
        orchestrator = info.context["orchestrator"]
        stats = orchestrator.get_system_stats()
        return "ok" if stats.get("success") else "error"

@strawberry.type
class Mutation:
    @strawberry.mutation
    def loadVendorKnowledge(self, info: Info, incremental: bool = False) -> str:
        orchestrator = info.context["orchestrator"]
        result = orchestrator.process_vendor_data(incremental=incremental)
        return result.get("message", "Done")

    @strawberry.mutation
    def clearKnowledgeBase(self, info: Info) -> str:
        orchestrator = info.context["orchestrator"]
        result = orchestrator.reset_database()
        return result.get("message", "Cleared")

schema = strawberry.Schema(query=Query, mutation=Mutation)
