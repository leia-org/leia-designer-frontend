import type { ProblemDef } from "./types";

// Fallback problem used when a code-editor widget is mounted without params.
// In the designer "try" the params come from the problem's widget config, so
// this is only a safety net.
export const DEFAULT_PROBLEM: ProblemDef = {
    fnName: "twoSum",
    language: "javascript",
    description:
        "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`. Each input has exactly one solution, and you may not use the same element twice.",
    starter: {
        javascript: `// Implement twoSum(nums, target) and LEIA will run the tests for you.
function twoSum(nums, target) {
    // your code here
    return [];
}
`,
        python: `# Implement twoSum(nums, target) and LEIA will run the tests for you.
def twoSum(nums, target):
    # your code here
    return []
`,
    },
    tests: [
        { name: "[2,7,11,15], target=9", args: [[2, 7, 11, 15], 9], expected: [0, 1] },
        { name: "[3,2,4], target=6", args: [[3, 2, 4], 6], expected: [1, 2] },
        { name: "[3,3], target=6", args: [[3, 3], 6], expected: [0, 1] },
    ],
};
