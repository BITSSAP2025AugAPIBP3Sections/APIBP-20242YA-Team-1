from typing import Dict, Any, List, Optional
from app.core.loader import VendorDataLoader
from app.core.embedder import EmbeddingService
from app.core.retriever import VectorDatabase
from app.core.llm_service import LLMService  # added
from app.config import VENDOR_DATA_DIRECTORY, VECTORDB_PERSIST_DIRECTORY


class VendorKnowledgeOrchestrator:
    """Coordinates data loading, embedding generation, vector storage & RAG QA.

    Supports optional per-user remote loading when a `user_id` is provided to
    `process_vendor_data`. If `user_id` is passed the loader will attempt to
    fetch a remote master.json (drive metadata) before falling back to local
    sample data directory.
    """
    def __init__(self, data_directory: str = VENDOR_DATA_DIRECTORY, vectordb_directory: str = VECTORDB_PERSIST_DIRECTORY):
        self.data_loader = VendorDataLoader(data_directory)
        self.embedding_service = EmbeddingService()
        self.vector_db = VectorDatabase(vectordb_directory)
        self.llm_service = LLMService(self.embedding_service, self.vector_db)  # added

    def process_vendor_data(self, incremental: bool = False, user_id: Optional[str] = None, refresh_token: Optional[str] = None) -> Dict[str, Any]:
        try:
            # If user_id supplied attempt remote load; fallback to local files
            dataset = None
            if user_id and refresh_token:
                try:
                    dataset = self.data_loader.load_remote_master(user_id, refresh_token)
                    print(f"Remote master data loaded for user {user_id}")
                except Exception as e:
                    print(f"Remote load failed for user {user_id}: {e}; falling back to local vendor JSON files")
            if not dataset:
                dataset = self.data_loader.load_vendor_json_files()
            print(f"Loaded {len(dataset.vendors)} vendors")

            if not dataset.vendors:
                return {"success": False, "message": "No vendor data found", "stats": {}}
            # Convert to chunks
            chunks = self.data_loader.convert_to_knowledge_chunks(dataset)
            print(f"Created {len(chunks)} knowledge chunks")

            if incremental:
                existing_ids = set(self.vector_db.list_ids())
                new_chunks = [c for c in chunks if c.chunk_id not in existing_ids]
                skipped = len(chunks) - len(new_chunks)
                print(f"Incremental mode: Found {len(existing_ids)} existing chunks. Skipping {skipped}, processing {len(new_chunks)} new chunks.")
                chunks = new_chunks
            
            embedded_chunks = self.embedding_service.generate_embeddings(chunks)
            successful_embeddings = sum(1 for chunk in embedded_chunks if chunk.embedding)
            print(f"Generated {successful_embeddings}/{len(embedded_chunks)} embeddings")

            print("\nStoring in vector database...")
            storage_success = self.vector_db.store_embeddings(embedded_chunks)
            db_stats = self.vector_db.get_collection_stats()

            return {
                "success": storage_success,
                "message": "Vendor knowledge processing completed successfully!",
                "stats": {
                    "vendors_loaded": len(dataset.vendors),
                    "chunks_created": len(chunks),
                    "embeddings_generated": successful_embeddings,
                    "stored_in_db": db_stats["total_chunks"],
                    "database_collection": db_stats["collection_name"],
                    "incremental": incremental,
                    **({} if not incremental else {"skipped_existing": skipped})
                }
            }
        except Exception as e:
            return {"success": False, "message": f"Error in processing data: {str(e)}", "stats": {}}

    def process_direct_dataset(self, dataset, incremental: bool = False) -> Dict[str, Any]:
        """Embed & store a pre-built VendorDataset supplied directly (bypasses loading)."""
        try:
            if not dataset or not getattr(dataset, 'vendors', None):
                return {"success": False, "message": "Empty vendor dataset", "stats": {}}
            chunks = self.data_loader.convert_to_knowledge_chunks(dataset)
            if incremental:
                existing_ids = set(self.vector_db.list_ids())
                chunks = [c for c in chunks if c.chunk_id not in existing_ids]
            embedded_chunks = self.embedding_service.generate_embeddings(chunks)
            storage_success = self.vector_db.store_embeddings(embedded_chunks)
            db_stats = self.vector_db.get_collection_stats()
            return {
                "success": storage_success,
                "message": "Direct vendor dataset ingested",
                "stats": db_stats,
                "chunks_processed": len(embedded_chunks),
                "incremental": incremental,
            }
        except Exception as e:
            return {"success": False, "message": f"Direct dataset ingestion failed: {e}", "stats": {}}

    def search_vendor_knowledge(self, query: str, n_results: int = 5) -> Dict[str, Any]:
        try:
            query_embedding = self.embedding_service.generate_single_embedding(query)
            search_results = self.vector_db.search_similar(query_embedding, n_results)

            formatted_results = []
            for i, (doc, metadata, distance) in enumerate(
                zip(search_results["documents"], search_results["metadatas"], search_results["distances"])
            ):
                formatted_results.append(
                    {   
                        "rank": i + 1, 
                        "content": doc, 
                        "metadata": metadata, 
                        "similarity_score": 1 - distance, 
                        "vendor_name": metadata.get("vendor_name", "Unknown")
                    }
                )
            return {
                    "success": True,
                    "query": query,
                    "results": formatted_results,
                    "message": f"Found {len(formatted_results)} relevant results",
                }

        except Exception as e:
            return {"success": False, "message": f"Search error: {str(e)}", "results": []}

    def get_context_for_query(
        self, vendor_name: str, question: str, n_results: int = 5
    ) -> Dict[str, Any]:
        """Retrieve top chunks for a vendor and question for LLM input."""
        try:
            query_emb = self.embedding_service.generate_single_embedding(question)
            retrieval = self.vector_db.search_similar_filtered(
                query_emb, vendor_name, n_results
            )

            sources = []
            for i, (doc, meta, dist) in enumerate(
                zip(retrieval["documents"], retrieval["metadatas"], retrieval["distances"])
            ):
                sources.append(
                    {
                        "rank": i + 1,
                        "chunk_id": meta.get("chunk_id"),
                        "vendor_name": meta.get("vendor_name"),
                        "type": meta.get("type"),
                        "similarity": 1 - dist,
                        "content_excerpt": doc[:220]
                        + ("..." if len(doc) > 220 else ""),
                        "invoice_number": meta.get("invoice_number"),
                        "invoice_date": meta.get("invoice_date"),
                        "total_amount": meta.get("total_amount"),
                        "drive_file_id": meta.get("drive_file_id"),
                        "file_name": meta.get("file_name"),
                        "web_view_link": meta.get("web_view_link"),
                        "web_content_link": meta.get("web_content_link"),
                    }
                )

            context_text = "\n\n".join(
                f"[Source {s['rank']} | sim {s['similarity']:.3f}]\n{s['content_excerpt']}"
                for s in sources
            )

            return {
                "success": True,
                "vendor_name": vendor_name,
                "question": question,
                "context_text": context_text,
                "sources": sources,
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Error generating context: {e}",
                "sources": [],
                "context_text": "",
            }

    # New answer_query method used by API router
    def answer_query(self, question: str, vendor_name: str | None = None, n_results: int = 5) -> Dict[str, Any]:
        q_lower = question.lower()
        full_detail_requested = any(k in q_lower for k in ["full detail", "all invoices", "invoice view link", "view links", "full vendor detail", "complete vendor"])

        multi_vendor_ranking_requested = any(
            k in q_lower for k in ["top vendors", "rank vendors", "most spend", "highest spend", "spent most", "compare vendor spend", "vendor spend ranking", "among all the vendors", "spent most rank"]
        )

        # Structured multi-vendor ranking (bypass LLM) when request detected and vendor unspecified or ALL
        if multi_vendor_ranking_requested and (vendor_name is None or vendor_name == 'ALL'):
            ranking = self.vector_db.get_vendor_spend_totals()
            if not ranking:
                return {"success": False, "message": "No vendor spend data available", "answer": "", "sources": []}
            # Build ranking answer
            lines = ["Vendor Spend Ranking (descending, currency: INR):"]
            for idx, entry in enumerate(ranking[: max(n_results, 5)]):
                lines.append(f"Rank {idx}: {entry['vendor_name']} | Total Spend: ₹{entry['total_spend']:.2f} | Invoices: {entry['invoice_count']}")
            answer_text = "\n".join(lines)
            structured_sources = [
                {
                    "rank": i,
                    "vendor_name": e["vendor_name"],
                    "total_amount": e["total_spend"],  # raw numeric value kept; currency implied INR
                    "invoice_count": e["invoice_count"],
                }
                for i, e in enumerate(ranking[: max(n_results, 5)])
            ]
            return {
                "success": True,
                "vendor_name": None,
                "question": question,
                "answer": answer_text,
                "sources": structured_sources,
                "context_text": "multi_vendor_spend_ranking",
                "message": "Structured multi-vendor spend ranking generated without LLM",
            }

        if not vendor_name:
            vendor_name = detect_vendor_name(question, self.vector_db.list_vendors(), self.llm_service)
        if not vendor_name:
            # Structured full detail across ALL vendors (bypass LLM) if explicitly requested
            if full_detail_requested:
                ranking = self.vector_db.get_vendor_spend_totals()
                if not ranking:
                    return {"success": False, "message": "No vendor spend data available", "answer": "", "sources": []}
                total_spend_all = sum(r.get("total_spend", 0.0) for r in ranking)
                total_invoices_all = sum(r.get("invoice_count", 0) for r in ranking)
                lines = [
                    "All Vendor Details (structured factual list):",
                    f"Total Vendors: {len(ranking)} | Aggregate Spend: ₹{total_spend_all:.2f} | Aggregate Invoices: {total_invoices_all}",
                    "",
                ]
                # Provide every vendor line (no LLM truncation or markdown emphasis)
                for r in ranking:
                    lines.append(
                        f"Vendor: {r['vendor_name']} | Invoices: {r['invoice_count']} | Total Amount (INR): ₹{r['total_spend']:.2f}"
                    )
                answer_text = "\n".join(lines)
                structured_sources = [
                    {
                        "rank": i + 1,
                        "vendor_name": r["vendor_name"],
                        "total_amount": r["total_spend"],
                        "invoice_count": r["invoice_count"],
                        "type": "vendor_summary",
                    }
                    for i, r in enumerate(ranking)
                ]
                return {
                    "success": True,
                    "vendor_name": None,
                    "question": question,
                    "answer": answer_text,
                    "sources": structured_sources,
                    "context_text": "all_vendor_full_detail_structured",
                    "message": "Structured all-vendor detail generated without LLM",
                    "vendor_detection": "explicit full detail all vendors"
                }
            # Fallback: aggregate top chunks across all vendors instead of erroring
            all_vendors = self.vector_db.list_vendors()
            if not all_vendors:
                return {"success": False, "message": "No vendors loaded", "answer": "", "sources": []}
            query_emb = self.embedding_service.generate_single_embedding(question)
            aggregated: List[Dict[str, Any]] = []
            per_vendor_k = max(1, n_results // max(1, len(all_vendors)))
            for v in all_vendors:
                try:
                    retrieval = self.vector_db.search_similar_filtered(query_emb, v, per_vendor_k)
                    for doc, meta, dist in zip(retrieval["documents"], retrieval["metadatas"], retrieval["distances"]):
                        aggregated.append({
                            "rank": 0,  # will set after sorting
                            "chunk_id": meta.get("chunk_id"),
                            "vendor_name": meta.get("vendor_name"),
                            "type": meta.get("type"),
                            "similarity": 1 - dist,
                            "content_excerpt": doc[:220] + ("..." if len(doc) > 220 else ""),
                            "invoice_number": meta.get("invoice_number"),
                            "invoice_date": meta.get("invoice_date"),
                            "total_amount": meta.get("total_amount"),
                            "drive_file_id": meta.get("drive_file_id"),
                            "file_name": meta.get("file_name"),
                            "web_view_link": meta.get("web_view_link"),
                            "web_content_link": meta.get("web_content_link"),
                        })
                except Exception as e:
                    print(f"Retrieval failed for vendor {v}: {e}")
            if not aggregated:
                return {"success": False, "message": "No context retrieved for any vendor", "answer": "", "sources": []}
            aggregated.sort(key=lambda x: x["similarity"], reverse=True)
            sources = aggregated[:n_results]
            for i, s in enumerate(sources):
                s["rank"] = i + 1
            context_text = "\n\n".join(
                f"[Source {s['rank']} | {s['vendor_name']} | sim {s['similarity']:.3f}]\n{s['content_excerpt']}" for s in sources
            )
            rag_response = self.llm_service.generate_answer(question=question, sources=sources)
            answer_text = rag_response.get("answer", "")
            # Safety fallback for multi-vendor aggregated queries
            if isinstance(answer_text, str) and "Response blocked by safety filters" in answer_text:
                ranking = self.vector_db.get_vendor_spend_totals()
                lines = ["Multi-Vendor Summary (factual aggregate):"]
                total_spend_all = 0.0
                total_invoices_all = 0
                for r in ranking:
                    total_spend_all += r.get("total_spend", 0.0)
                    total_invoices_all += r.get("invoice_count", 0)
                lines.append(f"Total Vendors: {len(ranking)} | Aggregate Spend: ₹{total_spend_all:.2f} | Aggregate Invoices: {total_invoices_all}")
                lines.append("")
                for idx, r in enumerate(ranking[:max(n_results, 8)]):
                    lines.append(
                        f"{idx+1}. {r['vendor_name']} | Spend: ₹{r['total_spend']:.2f} | Invoices: {r['invoice_count']}"
                    )
                answer_text = "\n".join(lines)
                return {
                    "success": True,
                    "vendor_name": None,
                    "question": question,
                    "answer": answer_text,
                    "sources": sources,
                    "context_text": context_text,
                    "message": "Safety fallback multi-vendor aggregate summary"
                }
            return {
                "success": rag_response.get("success", False),
                "vendor_name": None,  # Unknown / multiple
                "question": question,
                "answer": answer_text,
                "sources": sources,
                "context_text": context_text,
                "message": rag_response.get("message", "ok"),
                "vendor_detection": "auto-detection failed; aggregated multi-vendor context used"
            }
        try:
            # Structured path for detailed vendor request
            if full_detail_requested:
                all_data = self.vector_db.get_all_by_vendor(vendor_name)
                docs = all_data.get("documents", [])
                metas = all_data.get("metadatas", [])
                # Parse invoice metadata entries
                invoices: List[Dict[str, Any]] = []
                for doc, meta in zip(docs, metas):
                    if not isinstance(meta, dict):
                        continue
                    if meta.get("type") != "invoice":
                        continue
                    # Decode potential JSON string fields
                    parsed_meta = meta.copy()
                    for key in ["line_items"]:
                        val = parsed_meta.get(key)
                        if isinstance(val, str):
                            try:
                                import json
                                parsed_meta[key] = json.loads(val)
                            except Exception:
                                pass
                    invoices.append({
                        "invoice_number": parsed_meta.get("invoice_number"),
                        "invoice_date": parsed_meta.get("invoice_date"),
                        "total_amount": parsed_meta.get("total_amount"),
                        "web_view_link": parsed_meta.get("web_view_link"),
                        "web_content_link": parsed_meta.get("web_content_link"),
                        "file_name": parsed_meta.get("file_name"),
                        "drive_file_id": parsed_meta.get("drive_file_id"),
                    })
                total_invoices = len(invoices)
                total_amount_sum = 0.0
                for inv in invoices:
                    try:
                        total_amount_sum += float(inv.get("total_amount") or 0)
                    except Exception:
                        pass
                # Build structured answer
                lines = [
                    f"Vendor: {vendor_name}",
                    f"Total Invoices: {total_invoices}",
                    f"Aggregate Amount (INR): ₹{total_amount_sum:.2f}",
                    "", "Invoices:",
                ]
                for inv in invoices:
                    amt = inv.get('total_amount')
                    lines.append(f"- {inv.get('invoice_number')} | {inv.get('invoice_date')} | ₹{amt} | View: {inv.get('web_view_link')}")
                answer_text = "\n".join(lines)
                # Provide a minimal sources list (could truncate)
                structured_sources = []
                for i, inv in enumerate(invoices[:n_results]):
                    structured_sources.append({
                        "rank": i+1,
                        "vendor_name": vendor_name,
                        "invoice_number": inv.get("invoice_number"),
                        "invoice_date": inv.get("invoice_date"),
                        "total_amount": inv.get("total_amount"),
                        "web_view_link": inv.get("web_view_link"),
                        "web_content_link": inv.get("web_content_link"),
                    })
                return {
                    "success": True,
                    "vendor_name": vendor_name,
                    "question": question,
                    "answer": answer_text,
                    "sources": structured_sources,
                    "context_text": "structured_vendor_detail",
                    "message": "Structured vendor detail generated without LLM"
                }

            context = self.get_context_for_query(vendor_name=vendor_name, question=question, n_results=n_results)
            if not context.get("success"):
                return {"success": False, "message": context.get("message", "Context retrieval failed"), "answer": "", "sources": []}
            rag_response = self.llm_service.generate_answer(question=question, sources=context.get("sources", []))
            # Safety fallback: structured summary if answer indicates block
            answer_text = rag_response.get("answer", "")
            if isinstance(answer_text, str) and "Response blocked by safety filters" in answer_text:
                # Re-enter with full_detail flag if vendor summary requested implicitly
                all_data = self.vector_db.get_all_by_vendor(vendor_name)
                docs = all_data.get("documents", [])
                metas = all_data.get("metadatas", [])
                invoices = []
                for doc, meta in zip(docs, metas):
                    if isinstance(meta, dict) and meta.get("type") == "invoice":
                        invoices.append(meta)
                lines = [f"Vendor: {vendor_name}", f"Invoices Returned: {len(invoices)}"]
                for m in invoices[:n_results]:
                    lines.append(f"- {m.get('invoice_number')} | {m.get('invoice_date')} | ₹{m.get('total_amount')} | {m.get('web_view_link')}")
                answer_text = "\n".join(lines)
                return {
                    "success": True,
                    "vendor_name": vendor_name,
                    "question": question,
                    "answer": answer_text,
                    "sources": context.get("sources", []),
                    "context_text": context.get("context_text", ""),
                    "message": "Safety fallback structured summary"
                }
            return {
                "success": rag_response.get("success", False),
                "vendor_name": vendor_name,
                "question": question,
                "answer": answer_text,
                "sources": context.get("sources", []),
                "context_text": context.get("context_text", ""),
                "message": rag_response.get("message", "ok")
            }
        except Exception as e:
            return {"success": False, "message": f"Answer generation failed: {e}", "answer": "", "sources": []}

    def get_vendor_summary(self, vendor_name: str) -> Dict[str, Any]:
        try:
            results = self.vector_db.search_by_vendor(vendor_name)
            vendor_info = {"vendor_name": vendor_name, "total_chunks": len(results["documents"]), "invoices": [], "summary": {}}
            for doc, metadata in zip(results["documents"], results["metadatas"]):
                if metadata.get("type") == "invoice":
                    vendor_info["invoices"].append({"invoice_number": metadata.get("invoice_number"), "amount": metadata.get("total_amount", 0), "invoice_date": metadata.get("invoice_date")})
                elif metadata.get("type") == "vendor_summary":
                    vendor_info["summary"] = {"last_updated": metadata.get("last_updated"), "total_invoices": metadata.get("invoice_count", 0), "total_amount": metadata.get("total_amount", 0)}
            return {"success": True, "vendor_info": vendor_info}
        except Exception as e:
            return {"success": False, "message": f"Error getting vendor summary: {str(e)}"}

    def get_system_stats(self) -> Dict[str, Any]:
        try:
            db_stats = self.vector_db.get_collection_stats()
            return {"success": True, "stats": db_stats}
        except Exception as e:
            return {"success": False, "message": f"Error getting stats: {str(e)}"}

    def reset_database(self) -> Dict[str, Any]:
        try:
            success = self.vector_db.delete_all()
            return {"success": success, "message": "Database reset successfully" if success else "Failed to reset database"}
        except Exception as e:
            return {"success": False, "message": f"Error resetting database: {str(e)}"}

    def get_analytics(self, period: str = "year") -> Dict[str, Any]:
        """Compute high-level analytics across all vendors.
        Period influences monthlyTrend range (month, quarter, year, all)."""
        try:
            spend_ranking = self.vector_db.get_vendor_spend_totals()
            if not spend_ranking:
                return {"success": False, "message": "No spend data indexed"}

            highest = spend_ranking[0]
            total_spend_all = sum(v["total_spend"] for v in spend_ranking)
            total_invoices_all = sum(v["invoice_count"] for v in spend_ranking) or 1
            average_invoice = total_spend_all / total_invoices_all

            raw = self.vector_db.collection.get(include=["metadatas"]).get("metadatas", [])
            from collections import defaultdict
            import datetime
            monthly_totals = defaultdict(float)
            for meta in raw:
                if not isinstance(meta, dict):
                    continue
                if meta.get("type") != "invoice":
                    continue
                date_str = meta.get("invoice_date")
                amount_raw = meta.get("total_amount")
                try:
                    amount = float(str(amount_raw).replace(",", "")) if amount_raw is not None else 0.0
                except Exception:
                    amount = 0.0
                try:
                    dt = datetime.datetime.fromisoformat(date_str[:10]) if date_str else None
                except Exception:
                    dt = None
                if dt:
                    key = dt.strftime("%Y-%m")
                    monthly_totals[key] += amount
            sorted_months = sorted(monthly_totals.keys())
            if period == "month":
                last_key = sorted_months[-1] if sorted_months else None
                filtered = [last_key] if last_key else []
            elif period == "quarter":
                filtered = sorted_months[-3:]
            elif period == "year":
                filtered = sorted_months[-12:]
            else:
                filtered = sorted_months
            monthly_trend = [{"name": m, "value": monthly_totals[m]} for m in filtered]

            top_vendors = [
                {"name": v["vendor_name"], "value": v["total_spend"]}
                for v in spend_ranking
            ]
            spend_by_category = [
                {"name": v["vendor_name"], "value": v["total_spend"]}
                for v in spend_ranking[:8]
            ]
            from math import floor
            quarterly_map = defaultdict(float)
            for m, val in monthly_totals.items():
                try:
                    year, month = m.split('-')
                    q = f"{year}-Q{(floor((int(month)-1)/3)+1)}"
                    quarterly_map[q] += val
                except Exception:
                    pass
            quarterly_trend = [{"name": k, "value": v} for k, v in sorted(quarterly_map.items())][-8:]

            cost_reduction = 0.0
            avg_payment_time = 0.0
            data = {
                "success": True,
                "insights": {
                    "highestSpend": {"vendor": highest["vendor_name"], "amount": highest["total_spend"]},
                    "averageInvoice": average_invoice,
                    "costReduction": cost_reduction,
                    "avgPaymentTime": avg_payment_time,
                    "totalSpend": total_spend_all,
                    "totalInvoices": total_invoices_all,
                    "vendorCount": len(spend_ranking),
                },
                "monthlyTrend": monthly_trend,
                "topVendors": top_vendors,
                "spendByCategory": spend_by_category,
                "quarterlyTrend": quarterly_trend,
                "period": period,
            }
            # Gemini summary generation each call
            try:
                summary_prompt = (
                    "You are a financial spend analytics assistant. Given the following JSON analytics object, "
                    "produce a concise (<=120 words) plain English summary highlighting: overall spend, highest vendor, "
                    "invoice volume, notable monthly or quarterly trend (increasing/decreasing), and any concentration risk. "
                    "Avoid bullet points; use 2-3 sentences.\n\nJSON Data:\n" + str(data)
                )
                llm_text = self.llm_service.quick(summary_prompt, system="Spend Analytics Summarizer")
                cleaned = llm_text.strip()
                # Safety fallback: if blocked, build deterministic plain summary
                if "Response blocked by safety filters" in cleaned:
                    data["llmSummary"] = self._build_plain_analytics_summary(data)
                else:
                    data["llmSummary"] = cleaned
            except Exception as e:
                data["llmSummary"] = f"LLM summary unavailable: {e}" 
            return data
        except Exception as e:
            return {"success": False, "message": f"Analytics computation failed: {e}"}

    def _build_plain_analytics_summary(self, analytics: Dict[str, Any]) -> str:
        """Deterministic non-LLM summary used when safety blocks or LLM fails."""
        try:
            insights = analytics.get("insights", {})
            highest = insights.get("highestSpend", {})
            total_spend = insights.get("totalSpend", 0)
            total_invoices = insights.get("totalInvoices", 0)
            vendor_count = insights.get("vendorCount", 0)
            monthly = analytics.get("monthlyTrend", [])
            quarterly = analytics.get("quarterlyTrend", [])
            trend_part = ""
            if monthly:
                last_vals = [m.get("value", 0) for m in monthly[-3:]]
                if len(last_vals) >= 2:
                    diff = last_vals[-1] - last_vals[0]
                    direction = "rising" if diff > 0 else ("falling" if diff < 0 else "stable")
                    trend_part = f" Recent monthly trend appears {direction}."
            concentration = ""
            ranking = self.vector_db.get_vendor_spend_totals()
            if ranking:
                top_share = (ranking[0]["total_spend"] / total_spend) if total_spend else 0
                if top_share > 0.5:
                    concentration = f" Significant concentration: top vendor accounts for {top_share*100:.1f}% of spend."
            return (
                f"Total spend ₹{total_spend:.2f} across {vendor_count} vendors and {total_invoices} invoices. "
                f"Highest spend vendor: {highest.get('vendor', 'N/A')} (₹{highest.get('amount', 0):.2f})." + trend_part + concentration
            )
        except Exception:
            return "Analytics summary unavailable." 

    async def incremental_update(self, user_id: str | None = None) -> Dict[str, Any]:
        return await self.process_vendor_data(incremental=True, user_id=user_id)


def detect_vendor_name(query: str, known_vendors: List[str], llm_service: Optional[LLMService] = None) -> Optional[str]:
    query_lower = query.lower()
    for vendor in known_vendors:
        if vendor.lower() in query_lower:
            return vendor
    if llm_service and known_vendors:
        prompt = (
            "Given this user question: '" + query + "'\n"
            + "Which vendor from the following list does it most likely refer to?\n"
            + ", ".join(known_vendors) + "\n"
            + "Return exactly one vendor name from the list or 'None' if unsure."
        )
        try:
            response_text = llm_service.quick(prompt, system="Vendor name disambiguation")
            vendor_guess = response_text.strip()
            for vendor in known_vendors:
                if vendor.lower() in vendor_guess.lower():
                    return vendor
        except Exception as e:
            print(f"LLM vendor detection failed: {e}")
    return None
