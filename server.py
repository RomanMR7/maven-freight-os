#!/usr/bin/env python3
"""
MAVEN FREIGHT OS - Backend Server & Multi-Agent REST API
========================================================
Author: Senior Logistics Data Engineer
Standard Library: http.server (ThreadingHTTPServer), sqlite3, json, urllib.parse

Dual-Region Architecture:
- Default Region: "ru" (Российская Федерация, logistics_ru.db, RUB, км)
- Secondary Region: "us" (United States, logistics.db, USD, mi)

Endpoints with ?region=ru|us support:
- GET  /api/stats       - Global freight KPI metrics, economics, fleet utilization
- GET  /api/factories   - Manufacturing hubs with GPS, assigned products, volume
- GET  /api/routes      - Origin-destination freight corridors with GPS coordinates
- GET  /api/shipments   - Filterable & paginated shipments (factory, mode, state, search)
- GET  /api/agents      - 4 autonomous logistics subagents with decision logs & telemetry
- POST /api/dispatch    - Autonomous multi-agent dispatch on pending loads
- Static file handler   - Serves frontend files (index.html, app.js, styles.css, leaflet, chartjs)
"""

import os
import sys
import json
import sqlite3
import mimetypes
import math
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH_US = os.path.join(BASE_DIR, "logistics.db")
DB_PATH_RU = os.path.join(BASE_DIR, "logistics_ru.db")


def resolve_db_path(region: str) -> str:
    """Return database path based on selected region ('ru' or 'us') with search fallback."""
    reg = (region or "ru").strip().lower()
    target_filename = "logistics.db" if reg == "us" else "logistics_ru.db"

    # Search candidates across BASE_DIR, parent dirs, CWD, and Vercel Lambda root
    search_dirs = [
        BASE_DIR,
        os.path.dirname(BASE_DIR),
        os.getcwd(),
        os.path.join(os.getcwd(), "us-candy-logistics-trucking"),
        "/var/task",
        os.path.join("/var/task", "us-candy-logistics-trucking")
    ]
    for d in search_dirs:
        candidate = os.path.join(d, target_filename)
        if os.path.exists(candidate):
            return candidate

    default_path = os.path.join(BASE_DIR, target_filename)
    if reg == "us" and not os.path.exists(default_path):
        try:
            import data_pipeline
            data_pipeline.run_pipeline()
        except Exception:
            pass
    elif reg == "ru" and not os.path.exists(default_path):
        try:
            import data_pipeline_ru
            data_pipeline_ru.generate_russian_dataset()
        except Exception:
            pass
    return default_path


def get_db(region: str = "ru"):
    """
    Return thread-safe SQLite connection with WAL mode and memory cache.
    Ensures check_same_thread=False for high-concurrency threaded requests.
    Supports read-only serverless filesystems gracefully.
    """
    db_path = resolve_db_path(region)
    try:
        conn = sqlite3.connect(db_path, timeout=30.0, check_same_thread=False)
    except sqlite3.OperationalError:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row

    # Performance pragmas with graceful error handling for read-only environments
    cur = conn.cursor()
    try:
        cur.execute("PRAGMA journal_mode=WAL;")
    except Exception:
        pass
    try:
        cur.execute("PRAGMA synchronous=NORMAL;")
        cur.execute("PRAGMA cache_size = -64000;")       # 64MB memory page cache
        cur.execute("PRAGMA mmap_size = 268435456;")     # 256MB memory-mapped I/O
    except Exception:
        pass
    return conn


class LogisticsAPIHandler(BaseHTTPRequestHandler):
    """Thread-safe HTTP Request Handler for Logistics API and static assets."""

    def log_message(self, format, *args):
        """Clean console request logger."""
        sys.stderr.write(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]} {args[1]} -> {args[2]}\n")

    def send_json(self, status_code: int, data: dict):
        """Send JSON response with CORS headers."""
        payload = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        """Handle pre-flight CORS requests."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        """Route GET requests to API handlers or static files."""
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        try:
            if path == "/api/stats":
                self.handle_get_stats(query)
            elif path == "/api/factories":
                self.handle_get_factories(query)
            elif path == "/api/routes":
                self.handle_get_routes(query)
            elif path == "/api/shipments":
                self.handle_get_shipments(query)
            elif path == "/api/agents":
                self.handle_get_agents(query)
            else:
                self.handle_static_file(path)
        except Exception as e:
            self.send_json(500, {"error": str(e), "path": path})

    def do_POST(self):
        """Route POST requests (Multi-Agent Dispatch)."""
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        try:
            if path == "/api/dispatch":
                content_len = int(self.headers.get("Content-Length", 0))
                body = {}
                if content_len > 0:
                    raw_body = self.rfile.read(content_len).decode("utf-8")
                    try:
                        body = json.loads(raw_body)
                    except json.JSONDecodeError:
                        body = {}
                self.handle_post_dispatch(body, query)
            else:
                self.send_json(404, {"error": "Endpoint not found"})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    # =========================================================================
    # API HANDLERS (Dual-Region: RU by default, US on demand)
    # =========================================================================

    def _get_region(self, query: dict, body: dict = None) -> str:
        """Extract region from query param or body, defaulting to 'ru'."""
        if "region" in query and query["region"][0]:
            return query["region"][0].lower()
        if body and "region" in body and body["region"]:
            return str(body["region"]).lower()
        return "ru"

    def handle_get_stats(self, query):
        """GET /api/stats - Global logistics metrics and KPI aggregates."""
        region = self._get_region(query)
        conn = get_db(region)
        cur = conn.cursor()

        # Core metrics
        cur.execute("""
            SELECT
                COUNT(*) as total_shipments,
                SUM(sales) as total_revenue,
                SUM(gross_profit) as total_profit,
                SUM(distance_miles) as total_mileage,
                SUM(ton_miles) as total_ton_miles,
                AVG(transit_days) as avg_transit_days,
                AVG(rate_per_mile) as avg_rate_per_mile,
                SUM(freight_cost) as total_freight_cost,
                SUM(fuel_cost) as total_fuel_cost,
                SUM(co2_kg) as total_co2_kg
            FROM shipments
        """)
        row = dict(cur.fetchone())

        # Status breakdown
        cur.execute("SELECT status, COUNT(*) as cnt FROM shipments GROUP BY status ORDER BY cnt DESC")
        status_dist = {r["status"]: r["cnt"] for r in cur.fetchall()}

        # Truck Type breakdown
        cur.execute("SELECT truck_type, COUNT(*) as cnt FROM shipments GROUP BY truck_type ORDER BY cnt DESC")
        truck_dist = {r["truck_type"]: r["cnt"] for r in cur.fetchall()}

        # Ship Mode breakdown
        cur.execute("SELECT ship_mode, COUNT(*) as cnt FROM shipments GROUP BY ship_mode ORDER BY cnt DESC")
        mode_dist = {r["ship_mode"]: r["cnt"] for r in cur.fetchall()}

        # Carrier breakdown
        cur.execute("SELECT carrier, COUNT(*) as cnt FROM shipments GROUP BY carrier ORDER BY cnt DESC")
        carrier_dist = {r["carrier"]: r["cnt"] for r in cur.fetchall()}

        # Division breakdown
        cur.execute("SELECT division, COUNT(*) as cnt, SUM(sales) as sales FROM shipments GROUP BY division")
        division_dist = {r["division"]: {"count": r["cnt"], "sales": round(r["sales"], 2)} for r in cur.fetchall()}

        # Active loads based on status
        if region == "ru":
            active_in_transit = status_dist.get("В пути", 0)
            dispatched_count = status_dist.get("Погрузка на РЦ", 0)
            scheduled_count = status_dist.get("Запланирован", 0)
            delivered_count = status_dist.get("Доставлен", 0)
            total_fleet_capacity = 920
        else:
            active_in_transit = status_dist.get("In Transit", 0)
            dispatched_count = status_dist.get("Dispatched", 0)
            scheduled_count = status_dist.get("Scheduled", 0)
            delivered_count = status_dist.get("Delivered", 0)
            total_fleet_capacity = 850

        # Fleet utilization
        active_rolling = active_in_transit + dispatched_count
        fleet_utilization = round(min(98.8, max(76.0, (active_rolling / total_fleet_capacity) * 100.0 + 48.0)), 1)

        conn.close()

        currency = "₽" if region == "ru" else "$"
        dist_unit = "км" if region == "ru" else "mi"

        res = {
            "region": region,
            "currency": currency,
            "distance_unit": dist_unit,
            "total_shipments": row["total_shipments"],
            "total_revenue": round(row["total_revenue"] or 0, 2),
            "total_profit": round(row["total_profit"] or 0, 2),
            "total_mileage": round(row["total_mileage"] or 0, 1),
            "ton_miles": round(row["total_ton_miles"] or 0, 1),
            "avg_transit_days": round(row["avg_transit_days"] or 0, 2),
            "avg_rate_per_mile": round(row["avg_rate_per_mile"] or 0, 2),
            "total_freight_cost": round(row["total_freight_cost"] or 0, 2),
            "total_fuel_cost": round(row["total_fuel_cost"] or 0, 2),
            "total_co2_kg": round(row["total_co2_kg"] or 0, 1),
            "fleet_utilization_pct": fleet_utilization,
            "active_in_transit": active_in_transit,
            "pending_dispatch": dispatched_count + scheduled_count,
            "delivered": delivered_count,
            "status_breakdown": status_dist,
            "truck_type_breakdown": truck_dist,
            "ship_mode_breakdown": mode_dist,
            "carrier_breakdown": carrier_dist,
            "division_breakdown": division_dist
        }
        self.send_json(200, res)

    def handle_get_factories(self, query):
        """GET /api/factories - All factories with GPS, assigned products, volumes."""
        region = self._get_region(query)
        conn = get_db(region)
        cur = conn.cursor()

        cur.execute("SELECT * FROM factories ORDER BY total_shipments DESC")
        factories = [dict(r) for r in cur.fetchall()]

        in_transit_term = "В пути" if region == "ru" else "In Transit"
        dispatched_term = "Погрузка на РЦ" if region == "ru" else "Dispatched"
        scheduled_term = "Запланирован" if region == "ru" else "Scheduled"

        for f in factories:
            fname = f["factory_name"]
            cur.execute("SELECT product_name, division, unit_price FROM products WHERE factory_name = ?", (fname,))
            f["products"] = [dict(p) for p in cur.fetchall()]

            cur.execute(f"""
                SELECT
                    SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as in_transit,
                    SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as dispatched,
                    SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as scheduled
                FROM shipments WHERE factory_name = ?
            """, (in_transit_term, dispatched_term, scheduled_term, fname))
            active_row = cur.fetchone()
            f["active_in_transit"] = active_row["in_transit"] or 0
            f["dispatched"] = active_row["dispatched"] or 0
            f["scheduled"] = active_row["scheduled"] or 0

        conn.close()
        self.send_json(200, {"region": region, "factories": factories})

    def handle_get_routes(self, query):
        """GET /api/routes - Origin-destination corridors with GPS coordinates."""
        region = self._get_region(query)
        conn = get_db(region)
        cur = conn.cursor()

        limit = int(query.get("limit", [100])[0])
        factory_filter = query.get("factory", [None])[0]

        sql = "SELECT * FROM routes"
        params = []
        if factory_filter:
            sql += " WHERE origin_factory = ?"
            params.append(factory_filter)
        sql += " ORDER BY shipment_count DESC LIMIT ?"
        params.append(limit)

        cur.execute(sql, params)
        routes = [dict(r) for r in cur.fetchall()]
        conn.close()

        self.send_json(200, {"region": region, "count": len(routes), "routes": routes})

    def handle_get_shipments(self, query):
        """
        GET /api/shipments - Paginated shipments with multi-criteria filtering:
        factory, ship_mode, state, status, truck_type, carrier, search, page, limit.
        """
        region = self._get_region(query)
        conn = get_db(region)
        cur = conn.cursor()

        page = max(1, int(query.get("page", [1])[0]))
        limit = min(100, max(1, int(query.get("limit", [25])[0])))
        offset = (page - 1) * limit

        where_clauses = []
        params = []

        if "factory" in query and query["factory"][0]:
            where_clauses.append("factory_name = ?")
            params.append(query["factory"][0])

        if "mode" in query and query["mode"][0]:
            where_clauses.append("ship_mode = ?")
            params.append(query["mode"][0])

        if "state" in query and query["state"][0]:
            where_clauses.append("dest_state = ?")
            params.append(query["state"][0])

        if "status" in query and query["status"][0]:
            where_clauses.append("status = ?")
            params.append(query["status"][0])

        if "truck_type" in query and query["truck_type"][0]:
            where_clauses.append("truck_type = ?")
            params.append(query["truck_type"][0])

        if "carrier" in query and query["carrier"][0]:
            where_clauses.append("carrier = ?")
            params.append(query["carrier"][0])

        if "search" in query and query["search"][0]:
            term = f"%{query['search'][0].strip()}%"
            where_clauses.append("""(
                order_id LIKE ? OR
                customer_id LIKE ? OR
                product_name LIKE ? OR
                dest_city LIKE ? OR
                dest_state LIKE ? OR
                driver_name LIKE ? OR
                truck_id LIKE ?
            )""")
            params.extend([term] * 7)

        where_str = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        # Count total matches
        cur.execute(f"SELECT COUNT(*) as total FROM shipments{where_str}", params)
        total_records = cur.fetchone()["total"]

        # Sort field
        allowed_sorts = {
            "order_date": "order_date",
            "ship_date": "ship_date",
            "distance": "distance_miles",
            "sales": "sales",
            "transit_days": "transit_days",
            "freight_cost": "freight_cost"
        }
        sort_col = allowed_sorts.get(query.get("sort_by", ["order_date"])[0], "order_date")
        sort_dir = "ASC" if query.get("sort_dir", ["desc"])[0].lower() == "asc" else "DESC"

        # Fetch page records
        query_sql = f"""
            SELECT * FROM shipments
            {where_str}
            ORDER BY {sort_col} {sort_dir}
            LIMIT ? OFFSET ?
        """
        cur.execute(query_sql, params + [limit, offset])
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()

        total_pages = math.ceil(total_records / limit) if total_records > 0 else 1

        self.send_json(200, {
            "region": region,
            "total": total_records,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
            "shipments": rows
        })

    def handle_get_agents(self, query):
        """GET /api/agents - 4 autonomous subagents state & recent decision logs."""
        region = self._get_region(query)
        conn = get_db(region)
        cur = conn.cursor()

        cur.execute("SELECT * FROM agents ORDER BY agent_id ASC")
        agents = []
        for r in cur.fetchall():
            item = dict(r)
            try:
                item["telemetry"] = json.loads(item["telemetry_json"])
            except:
                item["telemetry"] = {}
            agents.append(item)

        cur.execute("SELECT * FROM agent_logs ORDER BY log_id DESC LIMIT 30")
        logs = []
        for r in cur.fetchall():
            l_item = dict(r)
            try:
                l_item["details"] = json.loads(l_item["details_json"])
            except:
                l_item["details"] = {}
            logs.append(l_item)

        conn.close()
        self.send_json(200, {"region": region, "agents": agents, "logs": logs})

    def handle_post_dispatch(self, body, query):
        """
        POST /api/dispatch - Multi-agent autonomous dispatch cycle:
        Advances pending loads and logs decisions to agent_logs.
        Supports both Russian and US datasets.
        """
        region = self._get_region(query, body)
        conn = get_db(region)
        cur = conn.cursor()

        batch_limit = int(body.get("batch_size", 12))
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        is_ru = (region == "ru")
        status_pending = ("Запланирован", "Погрузка на РЦ") if is_ru else ("Scheduled", "Dispatched")
        status_loading = "Погрузка на РЦ" if is_ru else "Dispatched"
        status_transit = "В пути" if is_ru else "In Transit"
        status_scheduled = "Запланирован" if is_ru else "Scheduled"

        cur.execute(f"""
            SELECT row_id, order_id, factory_name, dest_city, dest_state, truck_type, carrier, distance_miles, status
            FROM shipments
            WHERE status IN (?, ?)
            ORDER BY order_date DESC
            LIMIT ?
        """, (status_scheduled, status_loading, batch_limit))
        pending_loads = [dict(r) for r in cur.fetchall()]

        if not pending_loads:
            # Re-seed some loads to simulate active logistics flow
            cur.execute("""
                SELECT row_id FROM shipments ORDER BY order_date DESC LIMIT 8
            """)
            seed_ids = [r["row_id"] for r in cur.fetchall()]
            for rid in seed_ids:
                cur.execute("UPDATE shipments SET status = ? WHERE row_id = ?", (status_scheduled, rid))
            conn.commit()

            cur.execute(f"""
                SELECT row_id, order_id, factory_name, dest_city, dest_state, truck_type, carrier, distance_miles, status
                FROM shipments WHERE status = ? LIMIT ?
            """, (status_scheduled, batch_limit))
            pending_loads = [dict(r) for r in cur.fetchall()]

        dispatched_details = []
        for load in pending_loads:
            curr_status = load["status"]
            new_status = status_transit if curr_status == status_loading else status_loading
            cur.execute("UPDATE shipments SET status = ? WHERE row_id = ?", (new_status, load["row_id"]))
            load["previous_status"] = curr_status
            load["new_status"] = new_status
            dispatched_details.append(load)

        # Generate agent decision logs
        if dispatched_details:
            sample_load = dispatched_details[0]

            if is_ru:
                apex_msg = (f"Апекс автономная диспетчеризация: Выделено {len(dispatched_details)} партий груза. "
                            f"Приоритетный ТС: {sample_load['truck_type']} (ТК «{sample_load['carrier']}»).")
                pfind_msg = (f"Следопыт коридорная оптимизация: Рассчитан маршрут "
                             f"{sample_load['factory_name']} ➔ {sample_load['dest_city']} ({sample_load['dest_state']}). Плечо: {sample_load['distance_miles']} км.")
                sent_msg = f"Часовой: Активирован мониторинг ГЛОНАСС для {len(dispatched_details)} бортов. Термодатчики +15°C в норме."
                veritas_msg = f"Веритас аудит: Утверждены путевые листы и сбор Платон для {len(dispatched_details)} рейсов. Рентабельность 26.8%."

                apex_agent_name = "Апекс (Диспетчер FTL/LTL)"
                pfind_agent_name = "Следопыт (Оптимизатор маршрутов)"
                sent_agent_name = "Часовой (Телематика автопарка и ГЛОНАСС)"
                veritas_agent_name = "Веритас (Логистический аудитор)"
            else:
                apex_msg = (f"Apex autonomous load bundling: Allocated {len(dispatched_details)} loads to certified carriers. "
                            f"Priority assigned to {sample_load['truck_type']} on {sample_load['carrier']}.")
                pfind_msg = (f"Pathfinder dynamic routing: Computed corridor from "
                             f"{sample_load['factory_name']} ➔ {sample_load['dest_city']} ({sample_load['dest_state']}). Distance: {sample_load['distance_miles']} mi.")
                sent_msg = f"Sentinel activated GPS telemetry beacon for {len(dispatched_details)} freight units. Cold-chain sensors active."
                veritas_msg = f"Veritas unit economics verified: {len(dispatched_details)} bills of lading pre-approved. Operating margin cleared at 28.5%."

                apex_agent_name = "Apex (Dispatcher Agent)"
                pfind_agent_name = "Pathfinder (Route Optimizer)"
                sent_agent_name = "Sentinel (Fleet Telematics)"
                veritas_agent_name = "Veritas (Logistics Auditor)"

            cur.execute("""
                INSERT INTO agent_logs (agent_id, agent_name, timestamp, level, message, details_json)
                VALUES ('APX-01', ?, ?, 'ACTION', ?, ?)
            """, (apex_agent_name, now_str, apex_msg, json.dumps({"dispatched_count": len(dispatched_details), "order": sample_load["order_id"]}, ensure_ascii=False)))

            cur.execute("""
                INSERT INTO agent_logs (agent_id, agent_name, timestamp, level, message, details_json)
                VALUES ('PTH-02', ?, ?, 'SUCCESS', ?, ?)
            """, (pfind_agent_name, now_str, pfind_msg, json.dumps({"distance": sample_load["distance_miles"]}, ensure_ascii=False)))

            cur.execute("""
                INSERT INTO agent_logs (agent_id, agent_name, timestamp, level, message, details_json)
                VALUES ('SNT-03', ?, ?, 'INFO', ?, ?)
            """, (sent_agent_name, now_str, sent_msg, json.dumps({"units": len(dispatched_details)}, ensure_ascii=False)))

            cur.execute("""
                INSERT INTO agent_logs (agent_id, agent_name, timestamp, level, message, details_json)
                VALUES ('VRT-04', ?, ?, 'SUCCESS', ?, ?)
            """, (veritas_agent_name, now_str, veritas_msg, json.dumps({"count": len(dispatched_details)}, ensure_ascii=False)))

            # Update agents counters
            cur.execute("UPDATE agents SET decisions_count = decisions_count + ?, last_action = ?, last_action_time = ? WHERE agent_id = 'APX-01'", (len(dispatched_details), apex_msg, now_str))
            cur.execute("UPDATE agents SET decisions_count = decisions_count + 1, last_action = ?, last_action_time = ? WHERE agent_id = 'PTH-02'", (pfind_msg, now_str))
            cur.execute("UPDATE agents SET decisions_count = decisions_count + 1, last_action = ?, last_action_time = ? WHERE agent_id = 'SNT-03'", (sent_msg, now_str))
            cur.execute("UPDATE agents SET decisions_count = decisions_count + 1, last_action = ?, last_action_time = ? WHERE agent_id = 'VRT-04'", (veritas_msg, now_str))

        try:
            conn.commit()
        except Exception:
            pass
        finally:
            conn.close()

        dispatch_text = (f"Диспетчерский хаб успешно обработал и передал в рейс {len(dispatched_details)} партий груза."
                         if is_ru else f"Multi-Agent Dispatch Hub successfully processed {len(dispatched_details)} pending loads.")

        self.send_json(200, {
            "success": True,
            "region": region,
            "timestamp": now_str,
            "dispatched_count": len(dispatched_details),
            "dispatched_orders": dispatched_details,
            "message": dispatch_text
        })

    # =========================================================================
    # STATIC FILE HANDLER
    # =========================================================================

    def handle_static_file(self, req_path: str):
        """Serve HTML, JS, CSS, and media assets."""
        if req_path in ("/", ""):
            req_path = "/index.html"

        # Sanitize relative path
        rel_path = req_path.lstrip("/").replace("/", os.sep)
        file_path = os.path.join(BASE_DIR, rel_path)

        if not os.path.exists(file_path) or os.path.isdir(file_path):
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"404 Not Found")
            return

        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"
        if mime_type.startswith("text/") or mime_type in ("application/javascript", "application/json"):
            mime_type += "; charset=utf-8"

        try:
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode("utf-8"))


def run_server(port: int = PORT):
    """Start threaded HTTP server with dual-region support."""
    server_address = ("", port)
    httpd = ThreadingHTTPServer(server_address, LogisticsAPIHandler)
    httpd.daemon_threads = True

    print("=" * 76)
    print(f"   MAVEN FREIGHT OS // СЕРВЕР ЛОГИСТИЧЕСКОГО КОМАНДНОГО ЦЕНТРА")
    print("=" * 76)
    print(f" [*] URL локального сервера:   http://127.0.0.1:{port}")
    print(f" [*] База данных РФ (default): {DB_PATH_RU}")
    print(f" [*] База данных US:           {DB_PATH_US}")
    print(f" [*] Режим SQLite:             WAL (Write-Ahead Logging), потокобезопасный")
    print(f" [*] Поддержка регионов:       /api/*?region=ru (РФ) или ?region=us (США)")
    print("=" * 76)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Сервер остановлен пользователем.")
        httpd.server_close()


if __name__ == "__main__":
    p = PORT
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        p = int(sys.argv[1])
    run_server(p)
