import threading
import time
import urllib.request
import json
import sqlite3
import sys
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_RU = os.path.join(BASE_DIR, "logistics_ru.db")
DB_US = os.path.join(BASE_DIR, "logistics.db")

print("=== 1. ПРОВЕРКА WAL-РЕЖИМА И ИНДЕКСОВ БАЗ ДАННЫХ ===")
for name, p in [("logistics_ru.db", DB_RU), ("logistics.db", DB_US)]:
    conn = sqlite3.connect(p)
    cur = conn.cursor()
    jm = cur.execute("PRAGMA journal_mode;").fetchone()[0]
    sync = cur.execute("PRAGMA synchronous;").fetchone()[0]
    indexes = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()]
    rows_cnt = cur.execute("SELECT COUNT(*) FROM shipments").fetchone()[0]
    print(f"[{name}]")
    print(f"  * Journal mode:  {jm.upper()} (WAL: {jm.upper() == 'WAL'})")
    print(f"  * Synchronous:   {sync}")
    print(f"  * Total rows:    {rows_cnt:,}")
    print(f"  * Indexes count: {len(indexes)}")
    print(f"  * Index names:   {indexes}")
    conn.close()

print("\n=== 2. ТЕСТИРОВАНИЕ СЕРВЕРА И ЭНДПОИНТОВ С РЕГИОНАМИ (RU / US) ===")
from server import run_server

t = threading.Thread(target=run_server, kwargs={"port": 8089}, daemon=True)
t.start()
time.sleep(1.5)

tests = [
    # RU Endpoints (Default & explicit)
    ("/api/stats", "RU Default"),
    ("/api/stats?region=ru", "RU Explicit"),
    ("/api/factories?region=ru", "RU Factories"),
    ("/api/routes?region=ru&limit=5", "RU Routes"),
    ("/api/shipments?region=ru&page=1&limit=5", "RU Shipments"),
    ("/api/agents?region=ru", "RU Agents"),
    # US Endpoints
    ("/api/stats?region=us", "US Stats"),
    ("/api/factories?region=us", "US Factories"),
    ("/api/routes?region=us&limit=5", "US Routes"),
    ("/api/shipments?region=us&page=1&limit=5", "US Shipments"),
    ("/api/agents?region=us", "US Agents"),
]

for path, desc in tests:
    t0 = time.time()
    req = urllib.request.urlopen(f"http://127.0.0.1:8089{path}")
    elapsed_ms = (time.time() - t0) * 1000.0
    data = json.loads(req.read().decode("utf-8"))
    reg = data.get("region", "N/A")
    print(f"[OK] {desc:<14} | {path:<36} | {elapsed_ms:5.1f} ms | region={reg}")
    if "total_shipments" in data:
        curr = data.get("currency", "")
        unit = data.get("distance_unit", "")
        print(f"     => Заказов: {data['total_shipments']:,} | Выручка: {data['total_revenue']:,.2f} {curr} | Пробег: {data['total_mileage']:,} {unit}")
    elif "factories" in data:
        print(f"     => Фабрик: {len(data['factories'])}, Первая: '{data['factories'][0]['factory_name']}' ({data['factories'][0]['city']})")

# Test POST /api/dispatch for RU
print("\n=== 3. ТЕСТИРОВАНИЕ АВТОНОМНОЙ ДИСПЕТЧЕРИЗАЦИИ (POST /api/dispatch?region=ru) ===")
post_data = json.dumps({"batch_size": 5, "region": "ru"}).encode("utf-8")
post_req = urllib.request.Request(
    "http://127.0.0.1:8089/api/dispatch?region=ru",
    data=post_data,
    headers={"Content-Type": "application/json"}
)
res = urllib.request.urlopen(post_req)
disp_res = json.loads(res.read().decode("utf-8"))
print(f"[OK] Диспетчеризация RU: {disp_res['message']}")
print(f"     Обработано партий: {disp_res['dispatched_count']}")
for item in disp_res['dispatched_orders'][:3]:
    print(f"     * Рейс {item['order_id']} ({item['factory_name']} ➔ {item['dest_city']}): {item['previous_status']} ➔ {item['new_status']} [{item['truck_type']}, ТК «{item['carrier']}»]")

print("\n=== ВСЕ ПРОВЕРКИ И АУДИТ УСПЕШНО ПРОЙДЕНЫ! ===")
sys.exit(0)
