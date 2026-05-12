import "server-only";

export function GET() {
  return Response.json(
    { ok: true, service: "tiplytic", timestamp: new Date().toISOString() },
    { status: 200 },
  );
}
