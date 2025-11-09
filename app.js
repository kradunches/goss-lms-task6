import https from "https";
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';


const __filename = fileURLToPath(import.meta.url);


export default (express, bodyParser, createReadStream, crypto, http, MongoClient, pug) => {
    const app = express();


    const SYSTEM_LOGIN = "d5e5c122-0957-4501-971a-e81248c8522c";
    const TEXT_PLAIN_HEADER = { "Content-Type": "text/plain; charset=utf-8" };


    const readHttpResponse = (response) => {
        return new Promise((resolve, reject) => {
            const chunks = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
            response.on("error", (err) => reject(err));
        });
    };

    const fetchUrlData = (url) => {
        return new Promise((resolve, reject) => {
            const aget = url.startsWith('https://') ? https.get : http.get;
            aget(url, async (response) => {
                try {
                    const data = await readHttpResponse(response);
                    resolve(data);
                } catch (err) {
                    reject(err);
                }
            }).on("error", reject);
        });
    };


    app.use((req, res, next) => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,OPTIONS,DELETE");
        res.set("X-Author", SYSTEM_LOGIN)


        res.set(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, ngrok-skip-browser-warning,Access-Control-Allow-Headers, x-test"
        );




        if (req.method === 'OPTIONS') {

            return res.sendStatus(204);
        }

        next();
    });


    app.use(bodyParser.json());


    const wordpressBaseUrl = process.env.WORDPRESS_URL || 'https://example.com';

    if (wordpressBaseUrl) {
        app.use('/wordpress', createProxyMiddleware({
            target: wordpressBaseUrl,
            changeOrigin: true,
            pathRewrite: {
                '^/wordpress': '',
            },


            onProxyRes: function (proxyRes, req, res) {
                proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, OPTIONS, DELETE';
                proxyRes.headers['Access-Control-Allow-Origin'] = '*';
                proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, ngrok-skip-browser-warning';
                proxyRes.headers['X-Author'] = SYSTEM_LOGIN
            },


            onError: (err, req, res) => {
                console.error('Ошибка прокси:', err);
                res.status(500).set(TEXT_PLAIN_HEADER).send('Ошибка прокси-сервера: ' + err.message);
            }
        }));
    }

    app.get("/login/", (_req, res) => {
        res.set(TEXT_PLAIN_HEADER).send(SYSTEM_LOGIN);
    });

    app.get("/code/", (_req, res) => {
        res.set(TEXT_PLAIN_HEADER);
        const stream = createReadStream(__filename);
        stream.on("error", (err) => res.status(500).send(err.toString()));
        stream.pipe(res);
    });

    app.get("/sha1/:input/", (req, res) => {
        const hash = crypto.createHash("sha1").update(req.params.input).digest("hex");
        res.set(TEXT_PLAIN_HEADER).send(hash);
    });

    app.get("/req/", async (req, res) => {
        const addr = req.query.addr;
        if (!addr) return res.status(400).set(TEXT_PLAIN_HEADER).send("Missing addr query parameter");
        try {
            const data = await fetchUrlData(addr);
            res.set(TEXT_PLAIN_HEADER).send(data);
        } catch (err) {
            res.status(500).set(TEXT_PLAIN_HEADER).send(err.toString());
        }
    });

    app.post("/req/", async (req, res) => {
        const addr = req.body.addr;
        if (!addr) return res.status(400).set(TEXT_PLAIN_HEADER).send("Missing addr in body");
        try {
            const data = await fetchUrlData(addr);
            res.set(TEXT_PLAIN_HEADER).send(data);
        } catch (err) {
            res.status(500).set(TEXT_PLAIN_HEADER).send(err.toString());
        }
    });

    app.post("/insert/", async (req, res) => {
        const { login, password, URL: mongoUrl } = req.body;
        if (!login || !password || !mongoUrl) return res.status(400).set(TEXT_PLAIN_HEADER).send("Error: 'login', 'password', and 'URL' are required in the body.");
        const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
        try {
            await client.connect();
            const db = client.db();
            const collection = db.collection("users");
            const doc = { login, password };
            await collection.insertOne(doc);
            res.set(TEXT_PLAIN_HEADER).status(201).send("User created successfully.");
        } catch (err) {
            res.status(500).set(TEXT_PLAIN_HEADER).send(err.toString());
        } finally {
            if (client) await client.close();
        }
    });


    app.post("/render/", async (req, res) => {
        const { addr } = req.query;

        if (!addr) {
            return res.status(400).set(TEXT_PLAIN_HEADER).send("Missing addr query parameter");
        }

        if (!req.body) {
            console.error("ОШИБКА: req.body не определен!");
            return res.status(500).set(TEXT_PLAIN_HEADER).send("Server config error: req.body is undefined.");
        }

        const { random2, random3 } = req.body;

        if (random2 === undefined || random3 === undefined) {
            console.error("ОШИБКА: random2 или random3 не найдены в req.body. Получено:", JSON.stringify(req.body));
            return res.status(400).set(TEXT_PLAIN_HEADER).send("Missing random2 or random3 in JSON body");
        }

        try {
            const templateString = await fetchUrlData(addr);
            const compiledTemplate = pug.compile(templateString);
            const html = compiledTemplate({ random2, random3 });
            res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
        } catch (err) {
            res.status(500).set(TEXT_PLAIN_HEADER).send(err.toString());
        }
    });

    app.all(/.*/, (_req, res) => {
        res.set(TEXT_PLAIN_HEADER).send(SYSTEM_LOGIN);
    });

    return app;

};