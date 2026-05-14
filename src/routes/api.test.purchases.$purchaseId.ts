import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/test/purchases/$purchaseId')({
  server: {
    handlers: {
      DELETE: async ({ params }) => {
        if (process.env.E2E_TEST_MODE !== 'true') {
          return new Response('Not found', { status: 404 });
        }

        const { getServerUserId } = await import('#/server/auth');
        const userId = await getServerUserId();

        if (!userId) {
          return new Response('Unauthorized', { status: 401 });
        }

        const id = params.purchaseId;

        if (!id) {
          return new Response('Bad request', { status: 400 });
        }

        const { getScopedDb, prisma } = await import('#/server/db');
        const db = getScopedDb(userId);
        const existing = await db.purchase.findFirst({
          where: { id },
          select: { id: true },
        });

        if (!existing) {
          return new Response('Not found', { status: 404 });
        }

        const deleted = await prisma.purchase.delete({ where: { id } });

        return Response.json({ ok: true, deleted });
      },
    },
  },
});
