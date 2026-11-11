const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { root, loadWorker, createDatabase, seedDatabase } = require("./local-worker.cjs");

(async () => {
  const worker = await loadWorker();
  const { DB, sqlite } = await createDatabase();
  seedDatabase(sqlite, 64);
  const password = process.env.SHIPPING_ADMIN_PASSWORD || "local-shipping-only";
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg" };
  const env = {
    DB,
    SHIPPING_ADMIN_PASSWORD: password,
    ASSETS: {
      async fetch(request) {
        let pathname = new URL(request.url).pathname;
        if (pathname === "/") pathname = "/index.html";
        const filename = path.resolve(root, "docs", `.${pathname}`);
        if (!filename.startsWith(path.join(root, "docs") + path.sep)) return new Response(null, { status: 404 });
        try {
          return new Response(await readFile(filename), { headers: { "content-type": types[path.extname(filename).toLowerCase()] || "application/octet-stream" } });
        } catch { return new Response("Not found", { status: 404 }); }
      },
    },
  };
  const server = http.createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const method = req.method;
      const request = new Request(`http://localhost:${server.address().port}${req.url}`, {
        method, headers: req.headers,
        body: ["GET", "HEAD"].includes(method) ? undefined : Buffer.concat(chunks),
      });
      const response = await worker.fetch(request, env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { console.error(error); res.writeHead(500); res.end("Local preview error"); }
  });
  server.listen(Number(process.env.PORT || 8788), "127.0.0.1", () => {
    console.log(`Local shipping preview: http://localhost:${server.address().port}/2026shipping`);
    console.log("Uses 64 fictional records in memory; no production database connection.");
    if (!process.env.SHIPPING_ADMIN_PASSWORD) console.log("Local-only password: local-shipping-only");
  });
})();
