import json
import re
import httpx
import os

# ─────────────────────────────────────────────
# 1. NeetCode pattern → our sub_pattern mapping
#    NeetCode uses broad category names like "Arrays & Hashing".
#    We map those to the specific sub_patterns in our dsa_curriculum.
# ─────────────────────────────────────────────
NEETCODE_PATTERN_MAP = {
    "Arrays & Hashing":         "Hash Table / Dictionary",
    "Two Pointers":             "Opposite Ends (Two Sum, Container)",
    "Sliding Window":           "Variable Size Window",
    "Stack":                    "Stack Fundamentals",
    "Binary Search":            "Standard Binary Search",
    "Linked List":              "Singly Linked List Fundamentals",
    "Trees":                    "DFS on Trees (Pre/In/Post Order)",
    "Tries":                    "Trie (Prefix Tree)",
    "Heap / Priority Queue":    "Min/Max Heap Fundamentals",
    "Backtracking":             "Combinations & Combination Sum",
    "Graphs":                   "DFS on Graphs",
    "Advanced Graphs":          "Shortest Path (Dijkstra, Bellman-Ford)",
    "1-D Dynamic Programming":  "1D DP (Fibonacci, Climbing Stairs, House Robber)",
    "2-D Dynamic Programming":  "2D DP (Grids, Matrix Chain)",
    "Greedy":                   "Greedy Choice (Jump Game, Gas Station)",
    "Intervals":                "Interval Scheduling (Merge, Insert, Overlap)",
    "Math & Geometry":          "GCD / LCM / Modular Arithmetic",
    "Bit Manipulation":         "Bitwise Operations (XOR, AND, OR, Shifts)",
}

# ─────────────────────────────────────────────
# 2. Problem-level overrides
#    For specific famous problems where NeetCode's broad category
#    isn't precise enough for our micro-pattern tracking.
#    Format: "slug": ["sub_pattern1", "sub_pattern2"]
# ─────────────────────────────────────────────
PROBLEM_SPECIFIC_OVERRIDES = {
    # Arrays & Hashing — specific patterns
    "maximum-subarray":                     ["Kadane's Algorithm (Max Subarray)"],
    "product-of-array-except-self":         ["Prefix Sum"],
    "encode-and-decode-strings":            ["String Manipulation & Parsing"],

    # Two Pointers — specific
    "3sum":                                 ["Three Pointers"],
    "trapping-rain-water":                  ["Monotonic Stack", "Opposite Ends (Two Sum, Container)"],
    "remove-duplicates-from-sorted-array":  ["Same Direction (Remove Duplicates)"],

    # Sliding Window — specific
    "sliding-window-maximum":               ["Monotonic Deque / Sliding Window Maximum", "Fixed Size Window"],
    "minimum-window-substring":             ["Variable Size Window", "Hash Table / Dictionary"],
    "permutation-in-string":               ["Fixed Size Window", "Counting & Frequency Maps"],

    # Stack — specific
    "lru-cache":                            ["LRU / LFU Cache Design", "Doubly Linked List"],
    "largest-rectangle-in-histogram":      ["Monotonic Stack"],
    "daily-temperatures":                   ["Monotonic Stack"],
    "car-fleet":                            ["Monotonic Stack"],
    "min-stack":                            ["Stack Fundamentals"],

    # Binary Search — specific
    "koko-eating-bananas":                  ["Binary Search on Answer / Capacity"],
    "find-minimum-in-rotated-sorted-array": ["Modified Binary Search (Rotated, Matrix)"],
    "search-in-rotated-sorted-array":       ["Modified Binary Search (Rotated, Matrix)"],
    "median-of-two-sorted-arrays":          ["Binary Search on Answer / Capacity", "Divide and Conquer (Merge Sort Logic)"],
    "time-based-key-value-store":           ["Modified Binary Search (Rotated, Matrix)"],

    # Linked List — specific
    "linked-list-cycle":                    ["Fast & Slow Pointers (Tortoise & Hare)", "Cycle Detection"],
    "find-the-duplicate-number":            ["Fast & Slow Pointers (Tortoise & Hare)"],
    "reorder-list":                         ["Fast & Slow Pointers (Tortoise & Hare)", "In-place Reversal"],
    "reverse-linked-list":                  ["In-place Reversal"],
    "reverse-linked-list-ii":               ["In-place Reversal"],
    "merge-two-sorted-lists":               ["Merge & Sort Linked Lists"],
    "sort-list":                            ["Merge & Sort Linked Lists", "Divide and Conquer (Merge Sort Logic)"],
    "copy-list-with-random-pointer":        ["Singly Linked List Fundamentals", "Hash Table / Dictionary"],

    # Trees — specific
    "binary-tree-level-order-traversal":    ["BFS / Level Order Traversal"],
    "lowest-common-ancestor-of-a-binary-tree": ["Lowest Common Ancestor (LCA)"],
    "lowest-common-ancestor-of-a-binary-search-tree": ["Lowest Common Ancestor (LCA)", "Binary Search Tree (BST) Properties"],
    "serialize-and-deserialize-binary-tree":["Tree Construction & Serialization"],
    "construct-binary-tree-from-preorder-and-inorder-traversal": ["Tree Construction & Serialization"],
    "binary-tree-maximum-path-sum":         ["DP on Trees"],
    "diameter-of-binary-tree":              ["DFS on Trees (Pre/In/Post Order)"],
    "balanced-binary-tree":                 ["DFS on Trees (Pre/In/Post Order)"],
    "kth-smallest-element-in-a-bst":        ["Binary Search Tree (BST) Properties"],
    "validate-binary-search-tree":          ["Binary Search Tree (BST) Properties"],
    "insert-into-a-binary-search-tree":     ["Binary Search Tree (BST) Properties"],

    # Heaps — specific
    "find-median-from-data-stream":         ["Two Heaps Pattern (Median Finder)"],
    "top-k-frequent-elements":              ["Top K Elements", "Counting & Frequency Maps"],
    "top-k-frequent-words":                 ["Top K Elements", "Counting & Frequency Maps"],
    "kth-largest-element-in-a-stream":      ["Top K Elements"],
    "task-scheduler":                       ["Task Scheduling & Ordering", "Counting & Frequency Maps"],
    "merge-k-sorted-lists":                 ["K-way Merge", "Merge & Sort Linked Lists"],
    "find-k-pairs-with-smallest-sums":      ["K-way Merge"],

    # Backtracking — specific
    "subsets":                              ["Subsets & Power Set"],
    "subsets-ii":                           ["Subsets & Power Set"],
    "permutations":                         ["Permutations"],
    "permutations-ii":                      ["Permutations"],
    "combination-sum":                      ["Combinations & Combination Sum"],
    "combination-sum-ii":                   ["Combinations & Combination Sum"],
    "word-search":                          ["Word Search / Path Backtracking"],
    "word-search-ii":                       ["Word Search / Path Backtracking", "Trie (Prefix Tree)"],
    "n-queens":                             ["Constraint Satisfaction (N-Queens, Sudoku)"],
    "sudoku-solver":                        ["Constraint Satisfaction (N-Queens, Sudoku)"],
    "palindrome-partitioning":              ["Palindrome Techniques", "Combinations & Combination Sum"],

    # Graphs — specific
    "number-of-islands":                    ["Matrix / Grid Traversal (Islands)", "DFS on Graphs", "Disjoint Set / Union-Find"],
    "max-area-of-island":                   ["Matrix / Grid Traversal (Islands)"],
    "pacific-atlantic-water-flow":          ["Multi-source BFS", "Matrix / Grid Traversal (Islands)"],
    "surrounded-regions":                   ["Matrix / Grid Traversal (Islands)", "BFS on Graphs"],
    "word-ladder":                          ["Multi-source BFS", "BFS on Graphs"],
    "walls-and-gates":                      ["Multi-source BFS"],
    "01-matrix":                            ["Multi-source BFS"],
    "rotting-oranges":                      ["Multi-source BFS"],
    "clone-graph":                          ["DFS on Graphs", "BFS on Graphs"],
    "course-schedule":                      ["Topological Sort (Kahn's, DFS)", "Cycle Detection in Graphs"],
    "course-schedule-ii":                   ["Topological Sort (Kahn's, DFS)"],
    "alien-dictionary":                     ["Topological Sort (Kahn's, DFS)"],
    "redundant-connection":                 ["Disjoint Set / Union-Find"],
    "number-of-connected-components-in-an-undirected-graph": ["Disjoint Set / Union-Find"],
    "graph-valid-tree":                     ["Disjoint Set / Union-Find", "Cycle Detection in Graphs"],
    "network-delay-time":                   ["Shortest Path (Dijkstra, Bellman-Ford)"],
    "swim-in-rising-water":                 ["Shortest Path (Dijkstra, Bellman-Ford)"],
    "is-graph-bipartite":                   ["Bipartite Check / Graph Coloring"],
    "cheapest-flights-within-k-stops":      ["Shortest Path (Dijkstra, Bellman-Ford)"],
    "reconstruct-itinerary":                ["Eulerian Path & Circuit"],
    "min-cost-to-connect-all-points":       ["Minimum Spanning Tree (Prim, Kruskal)"],

    # Advanced Graphs
    "find-the-city-with-the-smallest-number-of-neighbors": ["Floyd-Warshall (All Pairs)"],
    "network-delay-time": ["Shortest Path (Dijkstra, Bellman-Ford)", "Floyd-Warshall (All Pairs)"],

    # 1D DP — specific
    "coin-change":                          ["Unbounded Knapsack"],
    "coin-change-ii":                       ["Unbounded Knapsack"],
    "climbing-stairs":                      ["1D DP (Fibonacci, Climbing Stairs, House Robber)"],
    "house-robber":                         ["1D DP (Fibonacci, Climbing Stairs, House Robber)"],
    "house-robber-ii":                      ["1D DP (Fibonacci, Climbing Stairs, House Robber)"],
    "decode-ways":                          ["1D DP (Fibonacci, Climbing Stairs, House Robber)"],
    "word-break":                           ["1D DP (Fibonacci, Climbing Stairs, House Robber)", "Trie (Prefix Tree)"],
    "partition-equal-subset-sum":           ["Knapsack 0/1"],
    "target-sum":                           ["Knapsack 0/1"],
    "last-stone-weight-ii":                 ["Knapsack 0/1"],
    "longest-increasing-subsequence":       ["Longest Increasing Subsequence (LIS)"],
    "number-of-longest-increasing-subsequence": ["Longest Increasing Subsequence (LIS)"],

    # 2D DP — specific
    "unique-paths":                         ["2D DP (Grids, Matrix Chain)"],
    "unique-paths-ii":                      ["2D DP (Grids, Matrix Chain)"],
    "longest-common-subsequence":           ["Longest Common Subsequence (LCS)"],
    "edit-distance":                        ["Longest Common Subsequence (LCS)"],
    "regular-expression-matching":          ["2D DP (Grids, Matrix Chain)"],
    "distinct-subsequences":                ["Longest Common Subsequence (LCS)"],
    "interleaving-string":                  ["2D DP (Grids, Matrix Chain)"],
    "maximal-square":                       ["2D DP (Grids, Matrix Chain)"],
    "burst-balloons":                       ["Interval DP"],
    "minimum-cost-tree-from-leaf-values":   ["Interval DP"],

    # Stock problems → DP with States
    "best-time-to-buy-and-sell-stock":      ["DP with States (Stock Buy/Sell, Cooldown)"],
    "best-time-to-buy-and-sell-stock-ii":   ["DP with States (Stock Buy/Sell, Cooldown)", "Greedy Choice (Jump Game, Gas Station)"],
    "best-time-to-buy-and-sell-stock-iii":  ["DP with States (Stock Buy/Sell, Cooldown)"],
    "best-time-to-buy-and-sell-stock-iv":   ["DP with States (Stock Buy/Sell, Cooldown)"],
    "best-time-to-buy-and-sell-stock-with-cooldown": ["DP with States (Stock Buy/Sell, Cooldown)"],
    "best-time-to-buy-and-sell-stock-with-transaction-fee": ["DP with States (Stock Buy/Sell, Cooldown)"],

    # Palindrome DP
    "longest-palindromic-substring":        ["Palindrome DP", "Palindrome Techniques"],
    "palindromic-substrings":               ["Palindrome DP", "Palindrome Techniques"],

    # Bitmask DP
    "partition-to-k-equal-sum-subsets":     ["Bitmask DP", "Backtracking"],

    # Greedy — specific
    "jump-game":                            ["Greedy Choice (Jump Game, Gas Station)"],
    "jump-game-ii":                         ["Greedy Choice (Jump Game, Gas Station)"],
    "gas-station":                          ["Greedy Choice (Jump Game, Gas Station)"],
    "hand-of-straights":                    ["Greedy Choice (Jump Game, Gas Station)"],
    "merge-intervals":                      ["Interval Scheduling (Merge, Insert, Overlap)"],
    "insert-interval":                      ["Interval Scheduling (Merge, Insert, Overlap)"],
    "non-overlapping-intervals":            ["Interval Scheduling (Merge, Insert, Overlap)"],
    "meeting-rooms":                        ["Interval Scheduling (Merge, Insert, Overlap)"],
    "meeting-rooms-ii":                     ["Interval Scheduling (Merge, Insert, Overlap)", "Min/Max Heap Fundamentals"],
    "minimum-interval-to-include-each-query": ["Interval Scheduling (Merge, Insert, Overlap)", "Min/Max Heap Fundamentals"],

    # Math — specific
    "rotate-image":                         ["Geometry & Convex Hull"],
    "spiral-matrix":                        ["Array Fundamentals"],
    "set-matrix-zeroes":                    ["Array Fundamentals"],
    "happy-number":                         ["Fast & Slow Pointers (Tortoise & Hare)"],
    "plus-one":                             ["Array Fundamentals"],
    "pow-x-n":                              ["Fast Exponentiation"],
    "multiply-strings":                     ["GCD / LCM / Modular Arithmetic"],
    "reverse-integer":                      ["Bitwise Operations (XOR, AND, OR, Shifts)"],
    "count-primes":                         ["Prime Numbers & Sieve of Eratosthenes"],

    # Bit Manipulation — specific
    "single-number":                        ["Power of 2 / Single Number tricks"],
    "number-of-1-bits":                     ["Bit Counting (Brian Kernighan, Hamming Weight)"],
    "counting-bits":                        ["Bit Counting (Brian Kernighan, Hamming Weight)"],
    "missing-number":                       ["Power of 2 / Single Number tricks"],
    "sum-of-two-integers":                  ["Bitwise Operations (XOR, AND, OR, Shifts)"],
    "reverse-bits":                         ["Bitwise Operations (XOR, AND, OR, Shifts)"],

    # Tries — specific
    "implement-trie-prefix-tree":           ["Trie (Prefix Tree)"],
    "design-add-and-search-words-data-structure": ["Trie (Prefix Tree)"],

    # String matching
    "find-the-index-of-the-first-occurrence-in-a-string": ["String Matching (KMP, Rabin-Karp, Z-algorithm)"],
    "repeated-string-match":               ["String Matching (KMP, Rabin-Karp, Z-algorithm)"],

    # Advanced Patterns
    "binary-tree-maximum-path-sum": ["DP on Trees"],
    "diameter-of-binary-tree": ["DFS on Trees (Pre/In/Post Order)", "DP on Trees"],
    "house-robber-iii": ["DFS on Trees (Pre/In/Post Order)", "DP on Trees"],
    "range-sum-query-mutable": ["Segment Tree (Range Query, Point Update)", "Segment Tree with Lazy Propagation"],
    "falling-squares": ["Segment Tree with Lazy Propagation"],
    "the-skyline-problem": ["Line Sweep"],
    "meeting-rooms-ii": ["Interval Scheduling (Merge, Insert, Overlap)", "Line Sweep", "Min/Max Heap Fundamentals"],
    "partition-to-k-equal-sum-subsets": ["Bitmask DP", "Backtracking", "Bitmasking & Subsets via Bits"],
    "find-the-shortest-superstring": ["Bitmasking & Subsets via Bits"],
    "powx-n": ["Fast Exponentiation"],
    "super-pow": ["Fast Exponentiation"],
    "fruit-into-baskets": ["Multi-pointer Window (At Most K)", "Variable Size Window"],
    "subarrays-with-k-different-integers": ["Multi-pointer Window (At Most K)"],
    "count-number-of-nice-subarrays": ["Multi-pointer Window (At Most K)"],
    "sqrtx": ["Binary Search on Floating Point", "Standard Binary Search"],
    "find-the-smallest-divisor-given-a-threshold": ["Binary Search on Floating Point", "Binary Search on Answer / Capacity"],
}


def extract_slug(link: str) -> str:
    parts = link.rstrip("/").split("/")
    return parts[-1]


def fetch_neetcode_data() -> list:
    url = "https://raw.githubusercontent.com/neetcode-gh/leetcode/main/.problemSiteData.json"
    print(f"Fetching NeetCode data from GitHub...")
    try:
        resp = httpx.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        print(f"  [+] Fetched {len(data)} problems from NeetCode")
        return data
    except Exception as e:
        print(f"  [-] Failed to fetch from GitHub: {e}")
        print("  → Falling back to embedded NeetCode 150 list...")
        return get_fallback_neetcode_150()


def get_fallback_neetcode_150() -> list:
    return [
        # Arrays & Hashing
        {"pattern": "Arrays & Hashing", "link": "contains-duplicate/"},
        {"pattern": "Arrays & Hashing", "link": "valid-anagram/"},
        {"pattern": "Arrays & Hashing", "link": "two-sum/"},
        {"pattern": "Arrays & Hashing", "link": "group-anagrams/"},
        {"pattern": "Arrays & Hashing", "link": "top-k-frequent-elements/"},
        {"pattern": "Arrays & Hashing", "link": "product-of-array-except-self/"},
        {"pattern": "Arrays & Hashing", "link": "valid-sudoku/"},
        {"pattern": "Arrays & Hashing", "link": "longest-consecutive-sequence/"},
        # Two Pointers
        {"pattern": "Two Pointers", "link": "valid-palindrome/"},
        {"pattern": "Two Pointers", "link": "two-sum-ii-input-array-is-sorted/"},
        {"pattern": "Two Pointers", "link": "3sum/"},
        {"pattern": "Two Pointers", "link": "container-with-most-water/"},
        {"pattern": "Two Pointers", "link": "trapping-rain-water/"},
        # Sliding Window
        {"pattern": "Sliding Window", "link": "best-time-to-buy-and-sell-stock/"},
        {"pattern": "Sliding Window", "link": "longest-substring-without-repeating-characters/"},
        {"pattern": "Sliding Window", "link": "longest-repeating-character-replacement/"},
        {"pattern": "Sliding Window", "link": "permutation-in-string/"},
        {"pattern": "Sliding Window", "link": "minimum-window-substring/"},
        {"pattern": "Sliding Window", "link": "sliding-window-maximum/"},
        # Stack
        {"pattern": "Stack", "link": "valid-parentheses/"},
        {"pattern": "Stack", "link": "min-stack/"},
        {"pattern": "Stack", "link": "evaluate-reverse-polish-notation/"},
        {"pattern": "Stack", "link": "generate-parentheses/"},
        {"pattern": "Stack", "link": "daily-temperatures/"},
        {"pattern": "Stack", "link": "car-fleet/"},
        {"pattern": "Stack", "link": "largest-rectangle-in-histogram/"},
        # Binary Search
        {"pattern": "Binary Search", "link": "binary-search/"},
        {"pattern": "Binary Search", "link": "search-a-2d-matrix/"},
        {"pattern": "Binary Search", "link": "koko-eating-bananas/"},
        {"pattern": "Binary Search", "link": "find-minimum-in-rotated-sorted-array/"},
        {"pattern": "Binary Search", "link": "search-in-rotated-sorted-array/"},
        {"pattern": "Binary Search", "link": "time-based-key-value-store/"},
        {"pattern": "Binary Search", "link": "median-of-two-sorted-arrays/"},
        # Linked List
        {"pattern": "Linked List", "link": "reverse-linked-list/"},
        {"pattern": "Linked List", "link": "merge-two-sorted-lists/"},
        {"pattern": "Linked List", "link": "reorder-list/"},
        {"pattern": "Linked List", "link": "remove-nth-node-from-end-of-list/"},
        {"pattern": "Linked List", "link": "copy-list-with-random-pointer/"},
        {"pattern": "Linked List", "link": "add-two-numbers/"},
        {"pattern": "Linked List", "link": "linked-list-cycle/"},
        {"pattern": "Linked List", "link": "find-the-duplicate-number/"},
        {"pattern": "Linked List", "link": "lru-cache/"},
        {"pattern": "Linked List", "link": "merge-k-sorted-lists/"},
        {"pattern": "Linked List", "link": "reverse-nodes-in-k-group/"},
        # Trees
        {"pattern": "Trees", "link": "invert-binary-tree/"},
        {"pattern": "Trees", "link": "maximum-depth-of-binary-tree/"},
        {"pattern": "Trees", "link": "diameter-of-binary-tree/"},
        {"pattern": "Trees", "link": "balanced-binary-tree/"},
        {"pattern": "Trees", "link": "same-tree/"},
        {"pattern": "Trees", "link": "subtree-of-another-tree/"},
        {"pattern": "Trees", "link": "lowest-common-ancestor-of-a-binary-search-tree/"},
        {"pattern": "Trees", "link": "binary-tree-level-order-traversal/"},
        {"pattern": "Trees", "link": "binary-tree-right-side-view/"},
        {"pattern": "Trees", "link": "count-good-nodes-in-binary-tree/"},
        {"pattern": "Trees", "link": "validate-binary-search-tree/"},
        {"pattern": "Trees", "link": "kth-smallest-element-in-a-bst/"},
        {"pattern": "Trees", "link": "construct-binary-tree-from-preorder-and-inorder-traversal/"},
        {"pattern": "Trees", "link": "binary-tree-maximum-path-sum/"},
        {"pattern": "Trees", "link": "serialize-and-deserialize-binary-tree/"},
        # Tries
        {"pattern": "Tries", "link": "implement-trie-prefix-tree/"},
        {"pattern": "Tries", "link": "design-add-and-search-words-data-structure/"},
        {"pattern": "Tries", "link": "word-search-ii/"},
        # Heap / Priority Queue
        {"pattern": "Heap / Priority Queue", "link": "kth-largest-element-in-a-stream/"},
        {"pattern": "Heap / Priority Queue", "link": "last-stone-weight/"},
        {"pattern": "Heap / Priority Queue", "link": "k-closest-points-to-origin/"},
        {"pattern": "Heap / Priority Queue", "link": "kth-largest-element-in-an-array/"},
        {"pattern": "Heap / Priority Queue", "link": "task-scheduler/"},
        {"pattern": "Heap / Priority Queue", "link": "design-twitter/"},
        {"pattern": "Heap / Priority Queue", "link": "find-median-from-data-stream/"},
        # Backtracking
        {"pattern": "Backtracking", "link": "subsets/"},
        {"pattern": "Backtracking", "link": "combination-sum/"},
        {"pattern": "Backtracking", "link": "permutations/"},
        {"pattern": "Backtracking", "link": "subsets-ii/"},
        {"pattern": "Backtracking", "link": "combination-sum-ii/"},
        {"pattern": "Backtracking", "link": "word-search/"},
        {"pattern": "Backtracking", "link": "palindrome-partitioning/"},
        {"pattern": "Backtracking", "link": "letter-combinations-of-a-phone-number/"},
        {"pattern": "Backtracking", "link": "n-queens/"},
        # Graphs
        {"pattern": "Graphs", "link": "number-of-islands/"},
        {"pattern": "Graphs", "link": "clone-graph/"},
        {"pattern": "Graphs", "link": "max-area-of-island/"},
        {"pattern": "Graphs", "link": "pacific-atlantic-water-flow/"},
        {"pattern": "Graphs", "link": "surrounded-regions/"},
        {"pattern": "Graphs", "link": "rotting-oranges/"},
        {"pattern": "Graphs", "link": "walls-and-gates/"},
        {"pattern": "Graphs", "link": "course-schedule/"},
        {"pattern": "Graphs", "link": "course-schedule-ii/"},
        {"pattern": "Graphs", "link": "graph-valid-tree/"},
        {"pattern": "Graphs", "link": "number-of-connected-components-in-an-undirected-graph/"},
        {"pattern": "Graphs", "link": "redundant-connection/"},
        {"pattern": "Graphs", "link": "word-ladder/"},
        # Advanced Graphs
        {"pattern": "Advanced Graphs", "link": "reconstruct-itinerary/"},
        {"pattern": "Advanced Graphs", "link": "min-cost-to-connect-all-points/"},
        {"pattern": "Advanced Graphs", "link": "network-delay-time/"},
        {"pattern": "Advanced Graphs", "link": "swim-in-rising-water/"},
        {"pattern": "Advanced Graphs", "link": "alien-dictionary/"},
        {"pattern": "Advanced Graphs", "link": "cheapest-flights-within-k-stops/"},
        # 1D DP
        {"pattern": "1-D Dynamic Programming", "link": "climbing-stairs/"},
        {"pattern": "1-D Dynamic Programming", "link": "min-cost-climbing-stairs/"},
        {"pattern": "1-D Dynamic Programming", "link": "house-robber/"},
        {"pattern": "1-D Dynamic Programming", "link": "house-robber-ii/"},
        {"pattern": "1-D Dynamic Programming", "link": "longest-palindromic-substring/"},
        {"pattern": "1-D Dynamic Programming", "link": "palindromic-substrings/"},
        {"pattern": "1-D Dynamic Programming", "link": "decode-ways/"},
        {"pattern": "1-D Dynamic Programming", "link": "coin-change/"},
        {"pattern": "1-D Dynamic Programming", "link": "maximum-product-subarray/"},
        {"pattern": "1-D Dynamic Programming", "link": "word-break/"},
        {"pattern": "1-D Dynamic Programming", "link": "longest-increasing-subsequence/"},
        {"pattern": "1-D Dynamic Programming", "link": "partition-equal-subset-sum/"},
        # 2D DP
        {"pattern": "2-D Dynamic Programming", "link": "unique-paths/"},
        {"pattern": "2-D Dynamic Programming", "link": "longest-common-subsequence/"},
        {"pattern": "2-D Dynamic Programming", "link": "best-time-to-buy-and-sell-stock-with-cooldown/"},
        {"pattern": "2-D Dynamic Programming", "link": "coin-change-ii/"},
        {"pattern": "2-D Dynamic Programming", "link": "target-sum/"},
        {"pattern": "2-D Dynamic Programming", "link": "interleaving-string/"},
        {"pattern": "2-D Dynamic Programming", "link": "longest-increasing-path-in-a-matrix/"},
        {"pattern": "2-D Dynamic Programming", "link": "distinct-subsequences/"},
        {"pattern": "2-D Dynamic Programming", "link": "edit-distance/"},
        {"pattern": "2-D Dynamic Programming", "link": "burst-balloons/"},
        {"pattern": "2-D Dynamic Programming", "link": "regular-expression-matching/"},
        # Greedy
        {"pattern": "Greedy", "link": "maximum-subarray/"},
        {"pattern": "Greedy", "link": "jump-game/"},
        {"pattern": "Greedy", "link": "jump-game-ii/"},
        {"pattern": "Greedy", "link": "gas-station/"},
        {"pattern": "Greedy", "link": "hand-of-straights/"},
        {"pattern": "Greedy", "link": "merge-triplets-to-form-target-triplet/"},
        {"pattern": "Greedy", "link": "partition-labels/"},
        {"pattern": "Greedy", "link": "valid-parenthesis-string/"},
        # Intervals
        {"pattern": "Intervals", "link": "insert-interval/"},
        {"pattern": "Intervals", "link": "merge-intervals/"},
        {"pattern": "Intervals", "link": "non-overlapping-intervals/"},
        {"pattern": "Intervals", "link": "meeting-rooms/"},
        {"pattern": "Intervals", "link": "meeting-rooms-ii/"},
        {"pattern": "Intervals", "link": "minimum-interval-to-include-each-query/"},
        # Math & Geometry
        {"pattern": "Math & Geometry", "link": "rotate-image/"},
        {"pattern": "Math & Geometry", "link": "spiral-matrix/"},
        {"pattern": "Math & Geometry", "link": "set-matrix-zeroes/"},
        {"pattern": "Math & Geometry", "link": "happy-number/"},
        {"pattern": "Math & Geometry", "link": "plus-one/"},
        {"pattern": "Math & Geometry", "link": "pow-x-n/"},
        {"pattern": "Math & Geometry", "link": "multiply-strings/"},
        {"pattern": "Math & Geometry", "link": "detect-squares/"},
        # Bit Manipulation
        {"pattern": "Bit Manipulation", "link": "single-number/"},
        {"pattern": "Bit Manipulation", "link": "number-of-1-bits/"},
        {"pattern": "Bit Manipulation", "link": "counting-bits/"},
        {"pattern": "Bit Manipulation", "link": "reverse-bits/"},
        {"pattern": "Bit Manipulation", "link": "missing-number/"},
        {"pattern": "Bit Manipulation", "link": "sum-of-two-integers/"},
        {"pattern": "Bit Manipulation", "link": "reverse-integer/"},
    ]


def build_overrides(problems: list) -> dict:
    overrides = {}

    for prob in problems:
        link = prob.get("link", "")
        pattern = prob.get("pattern", "")
        slug = extract_slug(link)

        if not slug or not pattern:
            continue

        if pattern in NEETCODE_PATTERN_MAP:
            overrides[slug] = [NEETCODE_PATTERN_MAP[pattern]]

    for slug, patterns in PROBLEM_SPECIFIC_OVERRIDES.items():
        overrides[slug] = patterns

    return overrides


def main():
    print("=" * 55)
    print("  LeetMetrics — Override Generator")
    print("=" * 55)

    problems = fetch_neetcode_data()
    overrides = build_overrides(problems)
    overrides = dict(sorted(overrides.items()))

    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(base_dir, "manual_overrides.json")
    
    with open(output_path, "w") as f:
        json.dump(overrides, f, indent=2)

    print(f"\n[+] Generated {len(overrides)} problem overrides")
    print(f"[+] Saved to {output_path}")

    total_with_multiple = sum(1 for v in overrides.values() if len(v) > 1)
    print(f"\n  {len(overrides) - total_with_multiple} problems → single pattern")
    print(f"  {total_with_multiple} problems → multiple patterns")
    print("\nDone! Ready for pipeline.")


if __name__ == "__main__":
    main()
