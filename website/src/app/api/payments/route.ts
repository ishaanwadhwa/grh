// Stubbed payment API — simulates Razorpay integration
// Will be replaced with real Razorpay SDK when ready

export async function POST(request: Request) {
  const body = await request.json();
  const { amount, currency, bookingId } = body;

  if (!amount || !currency || !bookingId) {
    return Response.json({ error: "Missing amount, currency, or bookingId" }, { status: 400 });
  }

  // Mock: simulate creating a Razorpay order
  const mockOrder = {
    id: `order_${Date.now()}`,
    amount: Math.round(amount * 100), // Razorpay uses paise/cents
    currency,
    bookingId,
    status: "created",
    // In production: this comes from Razorpay's API
    // const order = await razorpay.orders.create({ amount, currency, receipt: bookingId })
  };

  return Response.json({ order: mockOrder });
}
