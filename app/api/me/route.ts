import "server-only";

import { currentUser } from "@clerk/nextjs/server";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  return Response.json(
    {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.emailAddresses?.[0]?.emailAddress,
    },
    { status: 200 },
  );
}
