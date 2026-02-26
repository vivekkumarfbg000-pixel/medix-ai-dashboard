import { createServer } from 'vite';

async function run() {
    const server = await createServer({
        // any configuration options
        configFile: false,
        root: process.cwd(),
        server: {
            port: 8080,
        }
    });

    await server.listen();
    server.printUrls();
}

run();
