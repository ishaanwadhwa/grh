// Stubbed payment verification — simulates Razorpay webhook/callback
// Will be replaced with real Razorpay signature verification when ready

export async function POST(request: Request) {
  const body = await request.json();
  const { orderId, paymentId } = body;

  if (!orderId || !paymentId) {
    return Response.json({ error: "Missing orderId or paymentId" }, { status: 400 });
  }

  // Mock: always verify as successful
  // In production:
  // 1. Verify Razorpay signature using crypto.createHmac
  // 2. Check order status via Razorpay API
  // 3. Update booking status from "pending" to "confirmed"
  // 4. Send confirmation email via Resend

  return Response.json({
    verified: true,
    orderId,
    paymentId,
    status: "captured",
  });
}
