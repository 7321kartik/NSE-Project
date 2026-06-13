const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Endpoint to serve aggregated market data
app.get('/api/data', (req, res) => {
    const dataPath = path.join(__dirname, 'public', 'market_data.json');
    if (!fs.existsSync(dataPath)) {
        return res.status(404).json({ error: "Market data file not found. Please refresh data." });
    }
    
    fs.readFile(dataPath, 'utf8', (err, data) => {
        if (err) {
            console.error("Error reading data file:", err);
            return res.status(500).json({ error: "Failed to read market data from server cache." });
        }
        try {
            res.json(JSON.parse(data));
        } catch (e) {
            res.status(500).json({ error: "Cached data file contains invalid JSON." });
        }
    });
});

// In-memory flags to track background refresh execution status
let isRefreshing = false;
let refreshError = null;
let lastRefreshTime = null;

// API Endpoint to trigger background Python data refresh
app.post('/api/refresh', (req, res) => {
    if (isRefreshing) {
        return res.status(400).json({ status: "refreshing", message: "A data refresh is already in progress." });
    }
    
    isRefreshing = true;
    refreshError = null;
    
    console.log("Starting background update of market data via fetch_data.py...");
    
    exec('py fetch_data.py', (err, stdout, stderr) => {
        isRefreshing = false;
        if (err) {
            console.error("Python script failed:", err);
            refreshError = stderr || err.message;
            return;
        }
        lastRefreshTime = new Date().toISOString();
        console.log("Python script finished successfully:\n", stdout);
    });
    
    res.json({ status: "started", message: "Data refresh started in background." });
});

// API Endpoint to check the current status of background refreshing
app.get('/api/refresh-status', (req, res) => {
    res.json({
        refreshing: isRefreshing,
        error: refreshError,
        lastRefreshTime: lastRefreshTime
    });
});

// API Endpoint: Proxy OHLCV data from Yahoo Finance for any NSE stock
// Yahoo Finance uses "<SYMBOL>.NS" for NSE stocks (e.g. CLSEL.NS, RELIANCE.NS)
app.get('/api/chart/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase().replace(/[^A-Z0-9&]/g, '');
    const yahooSymbol = encodeURIComponent(symbol + '.NS');
    const range = req.query.range || '6mo';     // 6 months default
    const interval = req.query.interval || '1d'; // daily candles

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${range}`;

    try {
        // Node 18+ has native fetch; for older versions we use http.get
        let rawData;
        try {
            const fetchFn = globalThis.fetch || require('node-fetch');
            const resp = await fetchFn(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json'
                }
            });
            rawData = await resp.json();
        } catch (fetchErr) {
            // Fallback: use built-in https module
            rawData = await new Promise((resolve, reject) => {
                const https = require('https');
                const parsedUrl = new URL(url);
                const options = {
                    hostname: parsedUrl.hostname,
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json'
                    }
                };
                const request = https.request(options, (response) => {
                    let data = '';
                    response.on('data', chunk => data += chunk);
                    response.on('end', () => {
                        try { resolve(JSON.parse(data)); }
                        catch (e) { reject(new Error('Invalid JSON from Yahoo Finance')); }
                    });
                });
                request.on('error', reject);
                request.end();
            });
        }

        const result = rawData?.chart?.result?.[0];
        if (!result) {
            return res.status(404).json({ error: `No data found for NSE:${symbol}` });
        }

        const timestamps = result.timestamp || [];
        const ohlcv = result.indicators?.quote?.[0] || {};
        const adjClose = result.indicators?.adjclose?.[0]?.adjclose || [];

        // Build candle array for lightweight-charts format
        const candles = [];
        for (let i = 0; i < timestamps.length; i++) {
            const o = ohlcv.open?.[i];
            const h = ohlcv.high?.[i];
            const l = ohlcv.low?.[i];
            const c = ohlcv.close?.[i];
            const v = ohlcv.volume?.[i];
            // Skip nulls (market holidays with no data)
            if (o == null || h == null || l == null || c == null) continue;
            candles.push({
                time: Math.floor(timestamps[i]),   // Unix timestamp (seconds)
                open: parseFloat(o.toFixed(2)),
                high: parseFloat(h.toFixed(2)),
                low:  parseFloat(l.toFixed(2)),
                close: parseFloat(c.toFixed(2)),
                volume: v || 0
            });
        }

        const meta = result.meta || {};
        res.json({
            symbol: symbol,
            currency: meta.currency || 'INR',
            exchange: meta.exchangeName || 'NSE',
            regularMarketPrice: meta.regularMarketPrice,
            candles: candles
        });

    } catch (e) {
        console.error('Chart proxy error:', e.message);
        res.status(500).json({ error: 'Failed to fetch chart data: ' + e.message });
    }
});



// API Endpoint: Save CSV to C:\download on local machine
app.post('/api/export-csv', (req, res) => {
    const { csvData, filename } = req.body;
    if (!csvData || !filename) {
        return res.status(400).json({ error: "Missing csvData or filename in request body." });
    }

    const downloadDir = 'C:\\download';
    try {
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }
        const filePath = path.join(downloadDir, filename);
        fs.writeFile(filePath, csvData, 'utf8', (err) => {
            if (err) {
                console.error("Error writing CSV file on server:", err);
                return res.status(500).json({ error: "Failed to write CSV file to server storage." });
            }
            res.json({ success: true, filePath: filePath });
        });
    } catch (e) {
        console.error("Server-side CSV export failed:", e.message);
        res.status(500).json({ error: "Export failed: " + e.message });
    }
});

// Catch-all route to serve the frontend for SPA routing
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  NSE Stock Screener listening on port ${PORT}`);
    console.log(`  Access the Web UI at: http://localhost:${PORT}`);
    console.log(`=======================================================`);
});
