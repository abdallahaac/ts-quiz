import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const prefix = "/content/enforced/test-course/quiz/";
const root = resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".woff2": "font/woff2",
  ".css": "text/css",
};
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (!url.pathname.startsWith(prefix)) {
      response.writeHead(404);
      response.end();
      return;
    }
    const name = decodeURIComponent(url.pathname.slice(prefix.length));
    if (name === "original.html") {
      const html = (
        await readFile("tests/fixtures/original.html", "utf8")
      ).replace(
        "/content/enforced/12361-SB-Abdallah_Abou-Chahine/brightspace-core-bundle.js",
        "./assets/brightspace-components.js",
      );
      response.setHeader("Content-Type", "text/html");
      response.end(html);
      return;
    }
    const path = resolve(root, name);
    if (!path.startsWith(root + "/")) {
      response.writeHead(403);
      response.end();
      return;
    }
    const body = await readFile(path);
    response.setHeader(
      "Content-Type",
      types[extname(path)] ?? "application/octet-stream",
    );
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
}).listen(4173, "127.0.0.1");
