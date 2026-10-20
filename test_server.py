import threading
import time
import urllib.request
import json
import sys
from server import run_server

print("Starting test server on port 8085...")
t = threading.Thread(target=run_server, kwargs={"port": 8085}, daemon=True)
t.start()
time.sleep(1.5)

endpoints = [
    ("/api/stats", "GET"),
    ("/api/factories", "GET"),
    ("/api/routes?limit=5", "GET"),
    ("/api/shipments?page=1&limit=5&mode=Standard+Class", "GET"),
    ("/api/agents", "GET"),
]

for ep, method in endpoints:
    url = f"http://localhost:8085{ep}"
    req = urllib.request.urlopen(url)
    data = json.loads(req.read().decode("utf-8"))
    print(f"[OK] {method} {ep} => Keys: {list(data.keys())[:5]}")
    if ep == "/api/stats":
        print(f"     Shipments: {data['total_shipments']:,}, Revenue: ${data['total_revenue']:,.2f}, Mileage: {data['total_mileage']:,} mi")
    elif ep == "/api/factories":
        print(f"     Factories count: {len(data['factories'])}, first: {data['factories'][0]['factory_name']}")
    elif ep == "/api/agents":
        print(f"     Agents count: {len(data['agents'])}, recent logs: {len(data['logs'])}")

# Test POST /api/dispatch
print("\nTesting POST /api/dispatch...")
post_data = json.dumps({"batch_size": 6}).encode("utf-8")
post_req = urllib.request.Request(
    "http://localhost:8085/api/dispatch",
    data=post_data,
    headers={"Content-Type": "application/json"}
)
res = urllib.request.urlopen(post_req)
dispatch_data = json.loads(res.read().decode("utf-8"))
print(f"[OK] POST /api/dispatch => {dispatch_data['message']}")
print(f"     Dispatched count: {dispatch_data['dispatched_count']}")
for item in dispatch_data['dispatched_orders'][:3]:
    print(f"     * Order {item['order_id']} ({item['factory_name']} -> {item['dest_city']}, {item['dest_state']}): {item['previous_status']} -> {item['new_status']}")

print("\n[ALL TESTS PASSED SUCCESSFULLY!]")
sys.exit(0)
