"""
CareerBridge Curated Project Blueprints Seed Module
Idempotently seeds platform-standard project blueprints, structured skills, and milestone roadmaps.
"""

from typing import List, Dict, Any
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import SessionLocal
from app.models.innovation_project import ProjectType
from app.models.project_blueprint import (
    BlueprintDifficulty,
    BlueprintStatus,
    ProjectBlueprint,
    ProjectBlueprintMilestone,
    ProjectBlueprintSkill,
)
from app.models.project_evidence import EvidenceType
from app.services.skill_service import get_or_create_skill


CURATED_BLUEPRINTS: List[Dict[str, Any]] = [
    {
        "title": "Distributed Key-Value Store with Raft Consensus",
        "slug": "distributed-kv-store-raft",
        "version": 1,
        "summary": "Build a fault-tolerant, replicated in-memory key-value store using the Raft consensus algorithm.",
        "description": (
            "Design and implement a distributed, strongly consistent key-value store from scratch. "
            "The cluster maintains state machine safety across node crashes, network partitions, and leader elections, "
            "exposing an RPC interface for linearizable read and write operations."
        ),
        "learning_objectives": (
            "1. Master consensus protocols, leader elections, and log replication invariants.\n"
            "2. Implement asynchronous gRPC networking and heartbeats.\n"
            "3. Build fault-injection chaos tests to verify linearizability under partition."
        ),
        "project_type": ProjectType.SOFTWARE,
        "difficulty_level": BlueprintDifficulty.ADVANCED,
        "estimated_hours": 40,
        "status": BlueprintStatus.PUBLISHED,
        "primary_skills": [
            ("Go", "Backend"),
            ("Distributed Systems", "Backend"),
            ("Raft", "Backend"),
        ],
        "supporting_skills": [
            ("gRPC", "Backend"),
            ("Docker", "DevOps"),
            ("Linux", "Systems"),
        ],
        "milestones": [
            {
                "title": "RPC Protocol & Storage Engine",
                "description": "Define protobuf service schemas and build a concurrent in-memory key-value storage engine.",
                "expected_deliverable": "In-memory LSM / hash store with gRPC handler interfaces.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Public repository link with unit tests demonstrating concurrent GET/SET operations.",
                "display_order": 1,
            },
            {
                "title": "Leader Election & Heartbeat Loop",
                "description": "Implement randomized election timers, RequestVote RPCs, and leader heartbeats.",
                "expected_deliverable": "Election state machine handling split-votes and network delays.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Test harness output showing 3-node cluster electing leader and recovering from leader disconnect.",
                "display_order": 2,
            },
            {
                "title": "Log Replication & Commit Safety",
                "description": "Implement AppendEntries RPC, log reconciliation, commit index advancement, and state machine application.",
                "expected_deliverable": "Linearizable replicated log passing Raft safety invariants.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Jepsen-style automated test suite logs proving no committed entries are overwritten.",
                "display_order": 3,
            },
            {
                "title": "Cluster Benchmark & Chaos Fault Demo",
                "description": "Containerize cluster with Docker Compose and execute chaos network partitions under benchmark load.",
                "expected_deliverable": "Benchmark report and recorded terminal demo under network partition.",
                "recommended_evidence_type": EvidenceType.DEMO,
                "evidence_guidance": "Recorded demo or benchmark report detailing throughput (ops/sec) and recovery latency.",
                "display_order": 4,
            },
        ],
    },
    {
        "title": "Real-Time Collaborative Whiteboard",
        "slug": "realtime-collaborative-canvas",
        "version": 1,
        "summary": "Build a real-time collaborative whiteboard with live cursor presence and conflict-free synchronized drawings.",
        "description": (
            "Create a dynamic multi-user drawing and diagramming canvas supporting simultaneous users with sub-50ms latency. "
            "Features include live cursor tracking, multi-layer vector shapes, undo/redo history, and room persistence."
        ),
        "learning_objectives": (
            "1. Implement bidirectional WebSocket protocol for low-latency state synchronization.\n"
            "2. Manage HTML5 Canvas vector math and performant rendering pipelines.\n"
            "3. Handle operational transformations and conflict resolution across concurrent edits."
        ),
        "project_type": ProjectType.SOFTWARE,
        "difficulty_level": BlueprintDifficulty.INTERMEDIATE,
        "estimated_hours": 25,
        "status": BlueprintStatus.PUBLISHED,
        "primary_skills": [
            ("React", "Frontend"),
            ("TypeScript", "Frontend"),
            ("WebSockets", "Backend"),
        ],
        "supporting_skills": [
            ("Redis", "Database"),
            ("Node.js", "Backend"),
            ("TailwindCSS", "Frontend"),
        ],
        "milestones": [
            {
                "title": "Canvas Engine & Shape Primitives",
                "description": "Build high-performance React canvas rendering free-hand lines, rectangles, arrows, and text.",
                "expected_deliverable": "Interactive canvas component supporting pan, zoom, and multi-shape selection.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Frontend repository with Storybook or component test suite for drawing primitives.",
                "display_order": 1,
            },
            {
                "title": "WebSocket Gateway & Room Management",
                "description": "Build a WebSocket server handling room connections, authentication tokens, and heartbeat keep-alives.",
                "expected_deliverable": "Scalable WebSocket server with room broadcasting and Redis Pub/Sub.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Server repository with load tests validating 100+ concurrent clients per room.",
                "display_order": 2,
            },
            {
                "title": "Live Cursor Tracking & State Sync",
                "description": "Broadcast throttled mouse coordinates and incremental vector delta patches across active room participants.",
                "expected_deliverable": "Multiplayer cursor presence and synchronized canvas state.",
                "recommended_evidence_type": EvidenceType.DEMO,
                "evidence_guidance": "Live demo URL or video showing side-by-side browser windows drawing concurrently.",
                "display_order": 3,
            },
            {
                "title": "Room Persistence & Export Engine",
                "description": "Persist canvas snapshots to database and export high-resolution PNG/SVG files.",
                "expected_deliverable": "Storage persistence and export functionality.",
                "recommended_evidence_type": EvidenceType.DEMO,
                "evidence_guidance": "Live deployed link demonstrating room saving and SVG export.",
                "display_order": 4,
            },
        ],
    },
    {
        "title": "Event-Driven E-Commerce Microservices",
        "slug": "event-driven-ecommerce-microservices",
        "version": 1,
        "summary": "Design an event-driven microservices architecture handling order lifecycle, inventory reservation, and payment processing.",
        "description": (
            "Architect a resilient e-commerce backend utilizing asynchronous event streaming via Kafka. "
            "Implement Saga choreography for distributed transactions across Order, Inventory, Payment, and Notification services."
        ),
        "learning_objectives": (
            "1. Implement Saga pattern with compensating transactions for distributed consistency.\n"
            "2. Master Apache Kafka event streaming, partitioning, and consumer groups.\n"
            "3. Build containerized deployment manifests with Docker and Kubernetes."
        ),
        "project_type": ProjectType.SOFTWARE,
        "difficulty_level": BlueprintDifficulty.ADVANCED,
        "estimated_hours": 35,
        "status": BlueprintStatus.PUBLISHED,
        "primary_skills": [
            ("FastAPI", "Backend"),
            ("Kafka", "DevOps"),
            ("PostgreSQL", "Database"),
        ],
        "supporting_skills": [
            ("Docker", "DevOps"),
            ("Kubernetes", "DevOps"),
            ("Redis", "Database"),
        ],
        "milestones": [
            {
                "title": "Microservices Architecture & Domain Schemas",
                "description": "Define independent service schemas and domain data models for Order, Payment, and Inventory.",
                "expected_deliverable": "FastAPI service boilerplates with PostgreSQL migrations and Kafka event models.",
                "recommended_evidence_type": EvidenceType.DOCUMENT,
                "evidence_guidance": "Architecture design diagram and OpenAPI specs for all service boundaries.",
                "display_order": 1,
            },
            {
                "title": "Kafka Event Bus & Outbox Pattern",
                "description": "Implement transactional outbox pattern to guarantee at-least-once message delivery to Kafka topics.",
                "expected_deliverable": "Outbox worker polling database changes and publishing events.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Repository link showing outbox table integration and Kafka consumer tests.",
                "display_order": 2,
            },
            {
                "title": "Saga Choreography & Rollback Handling",
                "description": "Handle end-to-end checkout flow: OrderCreated -> InventoryReserved -> PaymentProcessed -> OrderConfirmed, with compensation on failure.",
                "expected_deliverable": "Tested Saga flow with automatic inventory release upon payment decline.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Integration test suite executing happy path and simulated payment failure rollback.",
                "display_order": 3,
            },
            {
                "title": "Kubernetes Deployment & Chaos Verification",
                "description": "Deploy services to local k8s (Minikube/Kind) with readiness probes and simulate pod crashes during active transactions.",
                "expected_deliverable": "Kubernetes manifests and resilience test report.",
                "recommended_evidence_type": EvidenceType.DOCUMENT,
                "evidence_guidance": "Deployment README and chaos experiment results documenting zero lost orders.",
                "display_order": 4,
            },
        ],
    },
    {
        "title": "Production RAG AI Document Search Engine",
        "slug": "rag-knowledge-base-search",
        "version": 1,
        "summary": "Build a Retrieval-Augmented Generation system for querying complex PDFs with hybrid semantic search and citations.",
        "description": (
            "Develop an intelligent search and QA engine that ingests technical documentation, creates chunked vector embeddings, "
            "executes hybrid dense/sparse retrieval with reranking, and generates grounded responses with exact source citations."
        ),
        "learning_objectives": (
            "1. Master vector embedding pipelines, chunking strategies, and vector databases.\n"
            "2. Implement reciprocal rank fusion (RRF) combining keyword search with semantic embeddings.\n"
            "3. Evaluate retrieval accuracy and prevent hallucinations through strict prompt grounding."
        ),
        "project_type": ProjectType.SOFTWARE,
        "difficulty_level": BlueprintDifficulty.INTERMEDIATE,
        "estimated_hours": 20,
        "status": BlueprintStatus.PUBLISHED,
        "primary_skills": [
            ("Python", "Backend"),
            ("Vector Databases", "Database"),
            ("LLMs", "AI"),
        ],
        "supporting_skills": [
            ("FastAPI", "Backend"),
            ("LangChain", "AI"),
            ("React", "Frontend"),
        ],
        "milestones": [
            {
                "title": "Document Parsing & Chunking Pipeline",
                "description": "Extract text, tables, and metadata from PDF/Markdown documents using semantic chunking.",
                "expected_deliverable": "Ingestion pipeline producing structured document chunks with token bounds.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Repository link with unit tests parsing complex sample PDFs.",
                "display_order": 1,
            },
            {
                "title": "Hybrid Vector Indexing & Reranking",
                "description": "Index embeddings in Qdrant/Pinecone/Chroma and combine with BM25 sparse index using Cohere/Cross-Encoder reranking.",
                "expected_deliverable": "Hybrid retrieval query service returning top-K relevant chunks with score weights.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Benchmark script calculating Recall@5 and MRR against a test dataset.",
                "display_order": 2,
            },
            {
                "title": "Grounded Generation with Inline Citations",
                "description": "Construct synthesis prompt requiring citations ([Doc 1, Page 4]) and validating context adherence.",
                "expected_deliverable": "FastAPI streaming endpoint returning answers with verifiable citations.",
                "recommended_evidence_type": EvidenceType.DEMO,
                "evidence_guidance": "Live demo video showing question answering with highlighted source verification.",
                "display_order": 3,
            },
        ],
    },
    {
        "title": "High-Throughput Streaming Analytics Pipeline",
        "slug": "high-throughput-data-pipeline",
        "version": 1,
        "summary": "Construct a real-time ETL pipeline processing telemetry events with Apache Spark Streaming and PostgreSQL.",
        "description": (
            "Ingest, clean, aggregate, and materialize 10,000+ events/sec from Kafka topics into analytical dimensional models. "
            "Includes watermark windowing, dead-letter queues, and interactive analytics dashboard endpoints."
        ),
        "learning_objectives": (
            "1. Implement structured streaming transformations and sliding window aggregations.\n"
            "2. Design star-schema analytical databases and optimize SQL analytical queries.\n"
            "3. Handle out-of-order events using event-time watermarking."
        ),
        "project_type": ProjectType.SOFTWARE,
        "difficulty_level": BlueprintDifficulty.ADVANCED,
        "estimated_hours": 30,
        "status": BlueprintStatus.PUBLISHED,
        "primary_skills": [
            ("Apache Spark", "Data Engineering"),
            ("Kafka", "DevOps"),
            ("SQL", "Database"),
        ],
        "supporting_skills": [
            ("Python", "Backend"),
            ("Docker", "DevOps"),
            ("PostgreSQL", "Database"),
        ],
        "milestones": [
            {
                "title": "Event Generator & Ingestion Schema",
                "description": "Build high-volume synthetic telemetry publisher sending JSON/Avro events to Kafka.",
                "expected_deliverable": "Producer script publishing 1,000+ events/sec with schema validation.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Repository code with producer throughput metrics.",
                "display_order": 1,
            },
            {
                "title": "Spark Streaming Aggregation & Watermarking",
                "description": "Consume Kafka stream, filter invalid records to DLQ, and compute 5-minute tumbling aggregations.",
                "expected_deliverable": "PySpark streaming job writing aggregated metrics to PostgreSQL.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Spark job execution logs and SQL verification queries.",
                "display_order": 2,
            },
            {
                "title": "Materialized Query API & Dashboards",
                "description": "Build fast REST API serving pre-aggregated KPI metrics with sub-20ms latency.",
                "expected_deliverable": "FastAPI analytics endpoints with dashboard visualization.",
                "recommended_evidence_type": EvidenceType.DEMO,
                "evidence_guidance": "Recorded demo showing real-time dashboard updating as load is generated.",
                "display_order": 3,
            },
        ],
    },
    {
        "title": "Cloud-Native Observability & SRE Platform",
        "slug": "cloud-native-ci-cd-observability",
        "version": 1,
        "summary": "Deploy a polyglot microservice application on Kubernetes instrumented with OpenTelemetry, Prometheus, and Grafana.",
        "description": (
            "Establish production-grade observability and CI/CD automation for a distributed application. "
            "Implement distributed tracing with OpenTelemetry, custom Prometheus metric scrapers, Grafana dashboards, and automated GitHub Actions deployment pipelines."
        ),
        "learning_objectives": (
            "1. Configure distributed trace context propagation across HTTP/gRPC boundaries.\n"
            "2. Define Prometheus ServiceMonitors and create SLI/SLO dashboards in Grafana.\n"
            "3. Write robust GitHub Actions pipelines with automated container security scanning."
        ),
        "project_type": ProjectType.SOFTWARE,
        "difficulty_level": BlueprintDifficulty.INTERMEDIATE,
        "estimated_hours": 25,
        "status": BlueprintStatus.PUBLISHED,
        "primary_skills": [
            ("Kubernetes", "DevOps"),
            ("Docker", "DevOps"),
            ("Prometheus", "DevOps"),
        ],
        "supporting_skills": [
            ("Grafana", "DevOps"),
            ("Go", "Backend"),
            ("GitHub Actions", "DevOps"),
        ],
        "milestones": [
            {
                "title": "OpenTelemetry Instrumentation",
                "description": "Instrument backend services to emit traces and metrics with zero code intrusion where possible.",
                "expected_deliverable": "Services generating trace spans with correlation IDs.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Repository link showing tracing configuration and Jaeger trace screenshot.",
                "display_order": 1,
            },
            {
                "title": "Prometheus Metrics & Alert Rules",
                "description": "Expose RED (Rate, Errors, Duration) metrics and configure alerting rules for high error rates.",
                "expected_deliverable": "Prometheus configuration with custom alerts.",
                "recommended_evidence_type": EvidenceType.DOCUMENT,
                "evidence_guidance": "Alert rule YAML files and Grafana dashboard export JSON.",
                "display_order": 2,
            },
            {
                "title": "CI/CD Pipeline with Trivy Security Scanning",
                "description": "Build automated GitHub Actions workflow compiling code, scanning CVE vulnerabilities, and deploying to Kubernetes.",
                "expected_deliverable": "Passing GitHub Actions workflow badge and deployment logs.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Public repository link with `.github/workflows` and passing run history.",
                "display_order": 3,
            },
        ],
    },
    {
        "title": "Multi-Tenant SaaS Management Platform",
        "slug": "fullstack-saas-subscription-platform",
        "version": 1,
        "summary": "Architect a multi-tenant B2B SaaS application with organization isolation, role-based access control, and Stripe billing.",
        "description": (
            "Build a modern full-stack web application supporting multi-organization tenancy with schema/row-level isolation, "
            "member invitation workflows, granular RBAC permissions, and automated recurring billing via Stripe webhooks."
        ),
        "learning_objectives": (
            "1. Implement robust multi-tenant data isolation and tenant scoping middleware.\n"
            "2. Handle complex subscription billing lifecycles and webhook verification.\n"
            "3. Build responsive, accessible UI components with React/TypeScript."
        ),
        "project_type": ProjectType.SOFTWARE,
        "difficulty_level": BlueprintDifficulty.INTERMEDIATE,
        "estimated_hours": 25,
        "status": BlueprintStatus.PUBLISHED,
        "primary_skills": [
            ("React", "Frontend"),
            ("TypeScript", "Frontend"),
            ("PostgreSQL", "Database"),
        ],
        "supporting_skills": [
            ("FastAPI", "Backend"),
            ("Stripe", "Backend"),
            ("TailwindCSS", "Frontend"),
        ],
        "milestones": [
            {
                "title": "Tenant Scoping & Database Isolation",
                "description": "Build middleware injecting tenant context and enforce row-level tenant security in all queries.",
                "expected_deliverable": "Data layer preventing cross-tenant data leakage.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Repository link with automated multi-tenancy security tests.",
                "display_order": 1,
            },
            {
                "title": "Organization Invitations & RBAC",
                "description": "Allow team admins to invite members with roles (Admin, Member, Viewer) via email tokens.",
                "expected_deliverable": "Complete invitation and role permission verification system.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Backend test suite validating permission enforcement per endpoint.",
                "display_order": 2,
            },
            {
                "title": "Stripe Subscription & Webhook Sync",
                "description": "Integrate Stripe Checkout and handle asynchronous subscription lifecycle webhooks (renew, cancel, past-due).",
                "expected_deliverable": "Working billing portal with webhook synchronization.",
                "recommended_evidence_type": EvidenceType.DEMO,
                "evidence_guidance": "Recorded demo showcasing checkout, upgrade, and webhook event handling.",
                "display_order": 3,
            },
        ],
    },
    {
        "title": "Federated GraphQL API Gateway & Subgraphs",
        "slug": "graphql-federation-gateway",
        "version": 1,
        "summary": "Build an Apollo Federation 2 gateway composing independent User, Product, and Review microservice subgraphs.",
        "description": (
            "Implement a modern federated GraphQL architecture. Multiple independent service teams own domain entities "
            "that compose seamlessly into a unified, high-performance supergraph gateway with entity resolvers and caching."
        ),
        "learning_objectives": (
            "1. Design federated GraphQL schemas with `@key`, `@shareable`, and `@provides` directives.\n"
            "2. Solve N+1 query problems using DataLoader batching.\n"
            "3. Secure federated gateways with centralized JWT token propagation."
        ),
        "project_type": ProjectType.SOFTWARE,
        "difficulty_level": BlueprintDifficulty.INTERMEDIATE,
        "estimated_hours": 20,
        "status": BlueprintStatus.PUBLISHED,
        "primary_skills": [
            ("GraphQL", "Backend"),
            ("Node.js", "Backend"),
            ("TypeScript", "Frontend"),
        ],
        "supporting_skills": [
            ("Docker", "DevOps"),
            ("Redis", "Database"),
            ("PostgreSQL", "Database"),
        ],
        "milestones": [
            {
                "title": "Subgraph Services & Domain Schemas",
                "description": "Build three independent subgraph services (Users, Products, Reviews) with entity keys.",
                "expected_deliverable": "Three working subgraph servers exposing valid federated schemas.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Repository code with schema definition files and unit tests.",
                "display_order": 1,
            },
            {
                "title": "Apollo Gateway & Supergraph Composition",
                "description": "Compose subgraphs into an Apollo Gateway with automated query plan caching.",
                "expected_deliverable": "Unified GraphQL gateway resolving composite entity fields.",
                "recommended_evidence_type": EvidenceType.REPOSITORY,
                "evidence_guidance": "Integration tests executing complex multi-subgraph GraphQL queries.",
                "display_order": 2,
            },
            {
                "title": "DataLoader Batching & Performance Benchmarks",
                "description": "Implement DataLoaders across cross-service entity resolvers and verify zero N+1 database queries.",
                "expected_deliverable": "DataLoader integration and performance benchmark report.",
                "recommended_evidence_type": EvidenceType.DOCUMENT,
                "evidence_guidance": "Benchmark report detailing query latency before and after DataLoader optimization.",
                "display_order": 3,
            },
        ],
    },
]


def seed_curated_blueprints(db: Session) -> int:
    """
    Idempotently seed the curated blueprint catalog.
    Matches skills against existing canonical database catalog or creates them cleanly.
    Returns the count of seeded/updated blueprints.
    """
    count = 0
    for bp_data in CURATED_BLUEPRINTS:
        slug = bp_data["slug"]
        blueprint = db.scalar(
            select(ProjectBlueprint)
            .options(
                selectinload(ProjectBlueprint.blueprint_skills),
                selectinload(ProjectBlueprint.milestones),
            )
            .where(ProjectBlueprint.slug == slug)
        )

        if not blueprint:
            blueprint = ProjectBlueprint(
                title=bp_data["title"],
                slug=slug,
                version=bp_data.get("version", 1),
                summary=bp_data["summary"],
                description=bp_data["description"],
                learning_objectives=bp_data["learning_objectives"],
                project_type=bp_data["project_type"],
                difficulty_level=bp_data["difficulty_level"],
                estimated_hours=bp_data["estimated_hours"],
                status=bp_data["status"],
            )
            db.add(blueprint)
            db.flush()
        else:
            blueprint.title = bp_data["title"]
            blueprint.version = bp_data.get("version", 1)
            blueprint.summary = bp_data["summary"]
            blueprint.description = bp_data["description"]
            blueprint.learning_objectives = bp_data["learning_objectives"]
            blueprint.project_type = bp_data["project_type"]
            blueprint.difficulty_level = bp_data["difficulty_level"]
            blueprint.estimated_hours = bp_data["estimated_hours"]
            blueprint.status = bp_data["status"]
            db.flush()

        # Sync skills map
        existing_skills = {
            bs.skill_id: bs for bs in (blueprint.blueprint_skills or [])
        }

        # Handle primary skills
        for skill_name, skill_cat in bp_data.get("primary_skills", []):
            skill = get_or_create_skill(db, skill_name, category=skill_cat)
            if skill.id not in existing_skills:
                db.add(
                    ProjectBlueprintSkill(
                        blueprint_id=blueprint.id,
                        skill_id=skill.id,
                        is_primary=True,
                    )
                )
            else:
                existing_skills[skill.id].is_primary = True

        # Handle supporting skills
        for skill_name, skill_cat in bp_data.get("supporting_skills", []):
            skill = get_or_create_skill(db, skill_name, category=skill_cat)
            if skill.id not in existing_skills:
                db.add(
                    ProjectBlueprintSkill(
                        blueprint_id=blueprint.id,
                        skill_id=skill.id,
                        is_primary=False,
                    )
                )

        # Sync milestones (re-create if empty or update in place)
        if not blueprint.milestones:
            for m_data in bp_data.get("milestones", []):
                db.add(
                    ProjectBlueprintMilestone(
                        blueprint_id=blueprint.id,
                        title=m_data["title"],
                        description=m_data["description"],
                        expected_deliverable=m_data["expected_deliverable"],
                        recommended_evidence_type=m_data.get("recommended_evidence_type", EvidenceType.REPOSITORY),
                        evidence_guidance=m_data.get("evidence_guidance"),
                        display_order=m_data.get("display_order", 0),
                    )
                )
        else:
            # Update existing milestones in place
            ms_by_order = {m.display_order: m for m in blueprint.milestones}
            for m_data in bp_data.get("milestones", []):
                order = m_data.get("display_order", 0)
                if order in ms_by_order:
                    m = ms_by_order[order]
                    m.title = m_data["title"]
                    m.description = m_data["description"]
                    m.expected_deliverable = m_data["expected_deliverable"]
                    m.recommended_evidence_type = m_data.get("recommended_evidence_type", EvidenceType.REPOSITORY)
                    m.evidence_guidance = m_data.get("evidence_guidance")
                else:
                    db.add(
                        ProjectBlueprintMilestone(
                            blueprint_id=blueprint.id,
                            title=m_data["title"],
                            description=m_data["description"],
                            expected_deliverable=m_data["expected_deliverable"],
                            recommended_evidence_type=m_data.get("recommended_evidence_type", EvidenceType.REPOSITORY),
                            evidence_guidance=m_data.get("evidence_guidance"),
                            display_order=order,
                        )
                    )

        count += 1

    db.commit()
    return count


if __name__ == "__main__":
    db = SessionLocal()
    try:
        total = seed_curated_blueprints(db)
        print(f"Successfully seeded {total} curated project blueprints.")
    finally:
        db.close()
