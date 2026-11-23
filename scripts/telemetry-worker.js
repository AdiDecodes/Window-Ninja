// Window Ninja telemetry collector — deploy as a Cloudflare Worker.
//
// 1. Create a Worker in the Cloudflare dashboard and paste this file.
// 2. Set a secret:  npx wrangler secret put WN_TELEMETRY_TOKEN
// 3. Put the Worker URL + the same token into a gitignored .env as
//    WN_TELEMETRY_ENDPOINT / WN_TELEMETRY_TOKEN (see .env.example).
// 4. Watch events:  npx wrangler tail
//
// To persist events instead of logging, add a binding (KV, D1, or Analytics
// Engine) and write `record` to it where marked below.

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('ok');

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('bad json', { status: 400 });
    }
    if (env.WN_TELEMETRY_TOKEN && body.token !== env.WN_TELEMETRY_TOKEN) {
      return new Response('forbidden', { status: 403 });
    }

    // { event, props, version, installId, locale, ts } — no IP is stored;
    // country comes from Cloudflare's edge and is coarse (e.g. "DE").
    const record = {
      event: body.event,
      props: body.props ?? {},
      version: body.version,
      installId: body.installId,
      locale: body.locale,
      ts: body.ts,
      country: request.cf?.country ?? null,
    };

    // Persist here if desired, e.g. env.STATS.put(...) or a D1 insert.
    console.log(JSON.stringify(record));

    return new Response('ok', {
      headers: { 'access-control-allow-origin': '*' },
    });
  },
};
