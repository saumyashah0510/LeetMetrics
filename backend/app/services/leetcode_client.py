import httpx
from typing import Dict, Any

class LeetCodeClient:
    BASE_URL = "https://leetcode.com"
    GRAPHQL_URL = "https://leetcode.com/graphql"

    def __init__(self, session_cookie: str):
        self.session_cookie = session_cookie
        self.headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://leetcode.com/",
            "Sec-Ch-Ua": "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"",
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": "\"Windows\"",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
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
