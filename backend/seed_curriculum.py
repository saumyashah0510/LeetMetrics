import asyncio
import sys
import os

# Add backend directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import engine

seed_sql = """
INSERT INTO dsa_curriculum (major_category, sub_pattern) VALUES
-- 1. Arrays & Hashing
('Arrays & Hashing', 'Array Fundamentals'),
('Arrays & Hashing', 'Hash Table / Dictionary'),
('Arrays & Hashing', 'Prefix Sum'),
('Arrays & Hashing', 'Kadane''s Algorithm (Max Subarray)'),
('Arrays & Hashing', 'Line Sweep'),
('Arrays & Hashing', 'Counting & Frequency Maps'),

-- 2. Two Pointers
('Two Pointers', 'Opposite Ends (Two Sum, Container)'),
('Two Pointers', 'Same Direction (Remove Duplicates)'),
('Two Pointers', 'Three Pointers'),
('Two Pointers', 'Fast & Slow Pointers (Tortoise & Hare)'),

-- 3. Sliding Window
('Sliding Window', 'Fixed Size Window'),
('Sliding Window', 'Variable Size Window'),
('Sliding Window', 'Multi-pointer Window (At Most K)'),

-- 4. Linked Lists
('Linked Lists', 'Singly Linked List Fundamentals'),
('Linked Lists', 'Doubly Linked List'),
('Linked Lists', 'In-place Reversal'),
('Linked Lists', 'Merge & Sort Linked Lists'),
('Linked Lists', 'Cycle Detection'),

-- 5. Stacks & Queues
('Stacks & Queues', 'Stack Fundamentals'),
('Stacks & Queues', 'Monotonic Stack'),
('Stacks & Queues', 'Queue Fundamentals'),
('Stacks & Queues', 'Monotonic Deque / Sliding Window Maximum'),
('Stacks & Queues', 'LRU / LFU Cache Design'),

-- 6. Binary Search
('Binary Search', 'Standard Binary Search'),
('Binary Search', 'Modified Binary Search (Rotated, Matrix)'),
('Binary Search', 'Binary Search on Answer / Capacity'),
('Binary Search', 'Binary Search on Floating Point'),

-- 7. Recursion & Divide and Conquer
('Recursion & Divide and Conquer', 'Recursion Fundamentals'),
('Recursion & Divide and Conquer', 'Divide and Conquer (Merge Sort Logic)'),
('Recursion & Divide and Conquer', 'Quick Select'),

-- 8. Trees
('Trees', 'Binary Tree Fundamentals'),
('Trees', 'Binary Search Tree (BST) Properties'),
('Trees', 'DFS on Trees (Pre/In/Post Order)'),
('Trees', 'BFS / Level Order Traversal'),
('Trees', 'Lowest Common Ancestor (LCA)'),
('Trees', 'Tree Construction & Serialization'),

-- 9. Tries & String Algorithms
('Tries & String Algorithms', 'Trie (Prefix Tree)'),
('Tries & String Algorithms', 'String Manipulation & Parsing'),
('Tries & String Algorithms', 'String Matching (KMP, Rabin-Karp, Z-algorithm)'),
('Tries & String Algorithms', 'Palindrome Techniques'),

-- 10. Heaps / Priority Queues
('Heaps / Priority Queues', 'Min/Max Heap Fundamentals'),
('Heaps / Priority Queues', 'Top K Elements'),
('Heaps / Priority Queues', 'Two Heaps Pattern (Median Finder)'),
('Heaps / Priority Queues', 'K-way Merge'),

-- 11. Backtracking
('Backtracking', 'Subsets & Power Set'),
('Backtracking', 'Permutations'),
('Backtracking', 'Combinations & Combination Sum'),
('Backtracking', 'Constraint Satisfaction (N-Queens, Sudoku)'),
('Backtracking', 'Word Search / Path Backtracking'),

-- 12. Graphs
('Graphs', 'DFS on Graphs'),
('Graphs', 'BFS on Graphs'),
('Graphs', 'Multi-source BFS'),
('Graphs', 'Matrix / Grid Traversal (Islands)'),
('Graphs', 'Cycle Detection in Graphs'),
('Graphs', 'Topological Sort (Kahn''s, DFS)'),
('Graphs', 'Disjoint Set / Union-Find'),
('Graphs', 'Shortest Path (Dijkstra, Bellman-Ford)'),
('Graphs', 'Floyd-Warshall (All Pairs)'),
('Graphs', 'Minimum Spanning Tree (Prim, Kruskal)'),
('Graphs', 'Bipartite Check / Graph Coloring'),

-- 13. Dynamic Programming
('Dynamic Programming', '1D DP (Fibonacci, Climbing Stairs, House Robber)'),
('Dynamic Programming', '2D DP (Grids, Matrix Chain)'),
('Dynamic Programming', 'Knapsack 0/1'),
('Dynamic Programming', 'Unbounded Knapsack'),
('Dynamic Programming', 'Longest Common Subsequence (LCS)'),
('Dynamic Programming', 'Longest Increasing Subsequence (LIS)'),
('Dynamic Programming', 'Palindrome DP'),
('Dynamic Programming', 'DP with States (Stock Buy/Sell, Cooldown)'),
('Dynamic Programming', 'Interval DP'),
('Dynamic Programming', 'Bitmask DP'),
('Dynamic Programming', 'DP on Trees'),

-- 14. Greedy Algorithms
('Greedy Algorithms', 'Interval Scheduling (Merge, Insert, Overlap)'),
('Greedy Algorithms', 'Greedy Choice (Jump Game, Gas Station)'),
('Greedy Algorithms', 'Task Scheduling & Ordering'),

-- 15. Bit Manipulation
('Bit Manipulation', 'Bitwise Operations (XOR, AND, OR, Shifts)'),
('Bit Manipulation', 'Bit Counting (Brian Kernighan, Hamming Weight)'),
('Bit Manipulation', 'Bitmasking & Subsets via Bits'),
('Bit Manipulation', 'Power of 2 / Single Number tricks'),

-- 16. Math & Geometry
('Math & Geometry', 'Prime Numbers & Sieve of Eratosthenes'),
('Math & Geometry', 'GCD / LCM / Modular Arithmetic'),
('Math & Geometry', 'Combinatorics & Permutations (nCr)'),
('Math & Geometry', 'Fast Exponentiation'),
('Math & Geometry', 'Geometry & Convex Hull'),
('Math & Geometry', 'Number Theory (Euler''s Totient, Catalan)'),

-- 17. Advanced Data Structures
('Advanced Data Structures', 'Segment Tree (Range Query, Point Update)'),
('Advanced Data Structures', 'Segment Tree with Lazy Propagation'),
('Advanced Data Structures', 'Binary Indexed Tree / Fenwick Tree'),
('Advanced Data Structures', 'Sparse Table (Range Minimum Query)'),
('Advanced Data Structures', 'Eulerian Path & Circuit');
"""

async def run():
    async with engine.begin() as conn:
        print("Emptying existing dsa_curriculum table...")
        await conn.execute(text("TRUNCATE TABLE dsa_curriculum CASCADE;"))
        print("Inserting exhaustive DSA patterns...")
        await conn.execute(text(seed_sql))
        print("Success! Inserted all patterns.")

if __name__ == "__main__":
    asyncio.run(run())
