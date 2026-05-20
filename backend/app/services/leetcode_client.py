import httpx
from typing import Dict, Any

class LeetCodeClient:
    BASE_URL = "https://leetcode.com"
    GRAPHQL_URL = "https://leetcode.com/graphql"

    def __init__(self, session_cookie: str):
        self.session_cookie = session_cookie
        self.headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
            "Cookie": f"LEETCODE_SESSION={self.session_cookie};"
        }
        self.client = httpx.AsyncClient(headers=self.headers, timeout=10.0)

    async def close(self):
        await self.client.aclose()

    async def check_health(self) -> Dict[str, Any]:
        """Verify the session cookie is valid by querying the user profile."""
        query = """
        query globalData {
          userStatus {
            userId
            isSignedIn
            username
          }
        }
        """
        response = await self.client.post(self.GRAPHQL_URL, json={"query": query})
        response.raise_for_status()
        return response.json()

    async def get_submissions(self, offset: int, limit: int = 20) -> Dict[str, Any]:
        """Fetch a paginated list of submissions from the internal REST API."""
        url = f"{self.BASE_URL}/api/submissions/?offset={offset}&limit={limit}"
        response = await self.client.get(url)
        response.raise_for_status()
        return response.json()
