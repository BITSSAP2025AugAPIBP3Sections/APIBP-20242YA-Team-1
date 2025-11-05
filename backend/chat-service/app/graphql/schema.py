import strawberry
from app.core.orchestrator import VendorKnowledgeOrchestrator

orchestrator = VendorKnowledgeOrchestrator()

@strawberry.type
class Query:
    @strawberry.field
    def vendorQuery(self, question: str) -> str:
        data = orchestrator.answer_query(question=question)
        if not data.get("success"):
            return data.get("message", "Error")
        return data.get("answer", "")

    @strawberry.field
    def health(self) -> str:
        stats = orchestrator.get_system_stats()
        return "ok" if stats.get("success") else "error"

@strawberry.type
class Mutation:
    @strawberry.mutation
    def loadVendorKnowledge(self, incremental: bool = False) -> str:
        result = orchestrator.process_vendor_data(incremental=incremental)
        return result.get("message", "Done")

    @strawberry.mutation
    def clearKnowledgeBase(self) -> str:
        result = orchestrator.reset_database()
        return result.get("message", "Cleared")

schema = strawberry.Schema(query=Query, mutation=Mutation)
