from locust import HttpUser, task, between

class LeetMetricsLoadTestUser(HttpUser):
    # Simulate users waiting between 1 to 3 seconds between requests
    wait_time = between(1, 3)

    @task(4)
    def view_dashboard(self):
        """Get the dashboard summary (tests Redis cache hit rates)."""
        self.client.get("/api/dashboard?username=saumyashah05")

    @task(2)
    def view_curriculum(self):
        """Get the curriculum details (tests Redis cache hit rates under load)."""
        self.client.get("/api/curriculum/saumyashah05")

    @task(1)
    def trigger_sync(self):
        """Trigger sync (tests rate limiter blocking and row locking)."""
        self.client.post("/api/sync", json={
            "session_cookie": "LEETCODE_SESSION=dummy_cookie_for_locust_load_test",
            "username": "saumyashah05"
        })
