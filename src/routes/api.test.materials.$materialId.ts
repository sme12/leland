import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/test/materials/$materialId')({
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

        const id = params.materialId;

        if (!id) {
          return new Response('Bad request', { status: 400 });
        }

        try {
          const { getScopedDb } = await import('#/server/db');
          const db = getScopedDb(userId);
          const result = await db.material.deleteMany({ where: { id } });

          return Response.json({ ok: true, deleted: result.count });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';

          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
