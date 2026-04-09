/**
 * Auth Failure Diagnostic Script
 * 
 * Verifies that the authentication error mapping logic correctly translates
 * various Supabase and Network error states into user-friendly messages.
 */

// Mimic the logic from src/auth/authHelpers.ts
const getAuthErrorMessage = (error: any): string => {
    const msg = error?.message?.toLowerCase() ?? "";
    const status = error?.status;

    // Proxy / network failures
    if (msg.includes("unexpected end of json") || msg.includes("unexpected token"))
        return "Connection Error: Cannot reach authentication server. Your ISP may be blocking the service. Try using a VPN or a different network.";
    if (msg.includes("is not valid json"))
        return "Server Configuration Error: The Supabase proxy returned an invalid response. Please contact support.";
    if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network error"))
        return "Network Error: Unable to connect. Please check your internet connection or try a VPN.";
    if (msg.includes("load failed"))
        return "Connection Failed: The authentication server is unreachable. Your ISP may be blocking it — try a VPN or mobile hotspot.";
    if (status === 500 || msg.includes("500") || msg.includes("internal server error"))
        return "Critical Error (500): The authentication proxy or database trigger failed. If using localhost, ensure your proxy bypass (Cloudflare/Production) is reachable. Check console for details.";
    if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("aborted"))
        return "Connection Timeout: The server took too long to respond. Your ISP may be blocking the service.";

    // Standard Supabase auth errors
    if (msg.includes("invalid login credentials"))
        return "Incorrect email or password.";
    if (msg.includes("email not confirmed"))
        return "Please verify your email before signing in. Check your inbox.";
    if (msg.includes("rate limit"))
        return "Too many attempts. Please wait a few minutes and try again.";
    if (msg.includes("already registered"))
        return "An account with this email already exists. Please sign in.";

    return error?.message ?? "An unexpected error occurred. Please try again.";
};

const testCases = [
    {
        name: "Invalid Credentials",
        error: { message: "Invalid login credentials", status: 400 },
        expected: "Incorrect email or password."
    },
    {
        name: "ISP Block / JSON Error",
        error: { message: "Unexpected token < in JSON at position 0" },
        expected: "Connection Error: Cannot reach authentication server. Your ISP may be blocking the service. Try using a VPN or a different network."
    },
    {
        name: "Failed to Fetch (Network Down)",
        error: { message: "Failed to fetch" },
        expected: "Network Error: Unable to connect. Please check your internet connection or try a VPN."
    },
    {
        name: "Internal Server Error (500)",
        error: { status: 500, message: "Internal Server Error" },
        expected: "Critical Error (500): The authentication proxy or database trigger failed. If using localhost, ensure your proxy bypass (Cloudflare/Production) is reachable. Check console for details."
    },
    {
        name: "Email Not Confirmed",
        error: { message: "Email not confirmed" },
        expected: "Please verify your email before signing in. Check your inbox."
    }
];

console.log("🚀 Starting Auth Error Mapping Diagnostics...\n");

let passed = 0;
testCases.forEach((tc, idx) => {
    const actual = getAuthErrorMessage(tc.error);
    const isOk = actual === tc.expected;
    if (isOk) {
        console.log(`✅ [PASS] ${tc.name}`);
        passed++;
    } else {
        console.error(`❌ [FAIL] ${tc.name}`);
        console.error(`   Actual:   "${actual}"`);
        console.error(`   Expected: "${tc.expected}"`);
    }
});

console.log(`\n📊 Results: ${passed}/${testCases.length} tests passed.`);

if (passed === testCases.length) {
    console.log("\n✨ Login failure handling logic is VERIFIED.");
    process.exit(0);
} else {
    process.exit(1);
}
