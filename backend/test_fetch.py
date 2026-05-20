import asyncio
import httpx
import json

async def test():
    url = "https://leetcode.com/graphql"
    query = """
    query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
      problemsetQuestionList: questionList(
        categorySlug: $categorySlug
        limit: $limit
        skip: $skip
        filters: $filters
      ) {
        total: totalNum
        questions: data {
          acRate
          difficulty
          frontendQuestionId: questionFrontendId
          title
          titleSlug
        }
      }
    }
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json={
            "query": query,
            "variables": {"categorySlug": "", "limit": 10, "skip": 0, "filters": {}}
        })
        print(response.status_code)
        print(json.dumps(response.json(), indent=2))

if __name__ == "__main__":
    asyncio.run(test())
