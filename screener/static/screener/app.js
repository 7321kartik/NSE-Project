'use strict';
/* =====================================================
   Refactored for Django App
   ===================================================== */

const PRESETS = {
    accumulation: {
        label: '🏦 Volume Accumulation',
        filters: {
            minVolumeRatio: 2.5, maxVolumeRatio: '',
            minChangePct: -1,    maxChangePct: 1,
            minDayRange: '',     maxDayRange: 3,
            minPriceVsHigh: '',  maxPriceVsHigh: '',
            minGap: '',          maxGap: '',
            minTurnover: 5,      minVolume: '',
            minPrice: '',        maxPrice: ''
        }
    },
    distribution: {
        label: '📤 Distribution Signal',
        filters: {
            minVolumeRatio: 2.5, maxVolumeRatio: '',
            minChangePct: '',    maxChangePct: -1,
            minDayRange: '',     maxDayRange: '',
            minPriceVsHigh: 0,  maxPriceVsHigh: 35,
            minGap: '',          maxGap: '',
            minTurnover: 5,      minVolume: '',
            minPrice: '',        maxPrice: ''
        }
    },
    momentum_breakout: {
        label: '💥 Momentum Breakout',
        filters: {
            minVolumeRatio: 2,   maxVolumeRatio: '',
            minChangePct: 2,     maxChangePct: '',
            minDayRange: 2,      maxDayRange: '',
            minPriceVsHigh: 65,  maxPriceVsHigh: '',
            minGap: '',          maxGap: '',
            minTurnover: 3,      minVolume: '',
            minPrice: '',        maxPrice: ''
        }
    },
    compressed_coil: {
        label: '🔒 Compressed Coil',
        filters: {
            minVolumeRatio: 2,   maxVolumeRatio: '',
            minChangePct: -1.5,  maxChangePct: 1.5,
            minDayRange: 0,      maxDayRange: 2,
            minPriceVsHigh: '',  maxPriceVsHigh: '',
            minGap: '',          maxGap: '',
            minTurnover: 2,      minVolume: '',
            minPrice: '',        maxPrice: ''
        }
    },
    gap_and_go: {
        label: '🚀 Gap & Go',
        filters: {
            minVolumeRatio: 1.5, maxVolumeRatio: '',
            minChangePct: 1.5,   maxChangePct: '',
            minDayRange: '',     maxDayRange: '',
            minPriceVsHigh: '',  maxPriceVsHigh: '',
            minGap: 1.5,         maxGap: '',
            minTurnover: 2,      minVolume: '',
            minPrice: '',        maxPrice: ''
        }
    },
    gap_fade: {
        label: '📉 Gap Fade / Reversal',
        filters: {
            minVolumeRatio: 1.5, maxVolumeRatio: '',
            minChangePct: '',    maxChangePct: '',
            minDayRange: '',     maxDayRange: '',
            minPriceVsHigh: 20,  maxPriceVsHigh: 45,
            minGap: 1.5,         maxGap: '',
            minTurnover: 2,      minVolume: '',
            minPrice: '',        maxPrice: ''
        }
    },
    high_liquidity: {
        label: '💧 High Liquidity',
        filters: {
            minVolumeRatio: '',  maxVolumeRatio: '',
            minChangePct: '',    maxChangePct: '',
            minDayRange: '',     maxDayRange: '',
            minPriceVsHigh: '',  maxPriceVsHigh: '',
            minGap: '',          maxGap: '',
            minTurnover: 50,     minVolume: '',
            minPrice: '',        maxPrice: ''
        }
    },
    closing_strength: {
        label: '💪 Closing Strength',
        filters: {
            minVolumeRatio: 1.5, maxVolumeRatio: '',
            minChangePct: 0,     maxChangePct: '',
            minDayRange: '',     maxDayRange: '',
            minPriceVsHigh: 75,  maxPriceVsHigh: '',
            minGap: '',          maxGap: '',
            minTurnover: 2,      minVolume: '',
            minPrice: '',        maxPrice: ''
        }
    },
    bo_52w_high: {
        label: '📈 52W Price Breakout',
        filters: {
            minVolumeRatio: 1.5, maxVolumeRatio: '',
            minChangePct: 1.0,   maxChangePct: '',
            minDayRange: '',     maxDayRange: '',
            minPriceVsHigh: '',  maxPriceVsHigh: '',
            minGap: '',          maxGap: '',
            minTurnover: 2,      minVolume: '',
            minPrice: '',        maxPrice: '',
            priceBreakout: '52w_high',
            volumeBreakout: 'all'
        }
    },
    bo_52w_vol: {
        label: '📊 52W Volume Breakout',
        filters: {
            minVolumeRatio: 2.0, maxVolumeRatio: '',
            minChangePct: '',    maxChangePct: '',
            minDayRange: '',     maxDayRange: '',
            minPriceVsHigh: '',  maxPriceVsHigh: '',
            minGap: '',          maxGap: '',
            minTurnover: 2,      minVolume: '',
            minPrice: '',        maxPrice: '',
            priceBreakout: 'all',
            volumeBreakout: '52w_vol'
        }
    }
};

let marketData    = { stocks: [] };
let filteredStocks = [];
let sortCol       = 'volume_ratio';
let sortDir       = 'desc';
let activePreset  = null;
let breakoutChart = null;

const $ = id => document.getElementById(id);
const els = {
    search:         $('tickerSearch'),
    minPrice:       $('minPrice'),
    maxPrice:       $('maxPrice'),
    minVolRatio:    $('minVolumeRatio'),
    maxVolRatio:    $('maxVolumeRatio'),
    minChangePct:   $('minChangePct'),
    maxChangePct:   $('maxChangePct'),
    minDayRange:    $('minDayRange'),
    maxDayRange:    $('maxDayRange'),
    minPriceVsHigh: $('minPriceVsHigh'),
    maxPriceVsHigh: $('maxPriceVsHigh'),
    minGap:         $('minGap'),
    maxGap:         $('maxGap'),
    minTurnover:    $('minTurnover'),
    minVolume:      $('minVolume'),

    totalCard:      $('totalStocksCard'),
    matchCard:      $('matchingStocksCard'),
    avgChangeCard:  $('avgChangeCard'),
    topBreakout:    $('topBreakoutCard'),
    topBreakoutSub: $('topBreakoutSubtext'),
    gainersCard:    $('gainersCard'),
    losersCard:     $('losersCard'),

    lastUpdated:    $('lastUpdatedVal'),
    refreshBtn:     $('refreshDataBtn'),
    exportBtn:      $('exportCsvBtn'),
    resetBtn:       $('resetFiltersBtn'),
    applyBtn:       $('applyFiltersBtn'),
    resultsPill:    $('resultsCount'),
    tableBody:      $('stocksTableBody'),
    overlay:        $('loadingOverlay'),
    activeScanLabel: $('activeScanLabel'),
    presetsGrid:    $('presetsGrid'),
    priceBreakout:  $('priceBreakout'),
    volumeBreakout: $('volumeBreakout'),
};

window.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupPresets();
    setupListeners();
});

async function loadData() {
    try {
        const res = await fetch('/api/data');
        if (!res.ok) {
            if (res.status === 404) { triggerRefresh(); return; }
            throw new Error('HTTP ' + res.status);
        }
        marketData = await res.json();
        els.lastUpdated.textContent = marketData.trading_date || marketData.last_updated || '—';
        applyAndRender();
    } catch (e) {
        els.tableBody.innerHTML = `<tr><td colspan="9" class="tbl-empty" style="color:#ef4444">
            Failed to load data — <strong>${e.message}</strong><br>
            Click <em>Refresh Data</em> to fetch from NSE.
        </td></tr>`;
    }
}

function setupPresets() {
    const cards = els.presetsGrid.querySelectorAll('.preset-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const key = card.dataset.preset;
            if (activePreset === key) {
                activePreset = null;
                card.classList.remove('active');
                clearFilters();
                els.activeScanLabel.innerHTML = '<i class="fa-solid fa-circle-dot"></i> All Stocks';
            } else {
                cards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                activePreset = key;
                applyPreset(key);
            }
        });
    });
}

function applyPreset(key) {
    const p = PRESETS[key];
    if (!p) return;

    const f = p.filters;
    const set = (el, v) => { if (el) el.value = (v === '' || v === null || v === undefined) ? '' : v; };

    set(els.minPrice,       f.minPrice);
    set(els.maxPrice,       f.maxPrice);
    set(els.minVolRatio,    f.minVolumeRatio);
    set(els.maxVolRatio,    f.maxVolumeRatio);
    set(els.minChangePct,   f.minChangePct);
    set(els.maxChangePct,   f.maxChangePct);
    set(els.minDayRange,    f.minDayRange);
    set(els.maxDayRange,    f.maxDayRange);
    set(els.minPriceVsHigh, f.minPriceVsHigh);
    set(els.maxPriceVsHigh, f.maxPriceVsHigh);
    set(els.minGap,         f.minGap);
    set(els.maxGap,         f.maxGap);
    set(els.minTurnover,    f.minTurnover);
    set(els.minVolume,      f.minVolume);
    set(els.priceBreakout,  f.priceBreakout || 'all');
    set(els.volumeBreakout, f.volumeBreakout || 'all');

    els.activeScanLabel.innerHTML = `<i class="fa-solid fa-circle-dot"></i> ${p.label}`;
    applyAndRender();
}

function setupListeners() {
    els.applyBtn.addEventListener('click', applyAndRender);
    els.resetBtn.addEventListener('click', () => {
        activePreset = null;
        els.presetsGrid.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
        clearFilters();
        els.activeScanLabel.innerHTML = '<i class="fa-solid fa-circle-dot"></i> All Stocks';
    });
    els.search.addEventListener('input', applyAndRender);
    if (els.priceBreakout) els.priceBreakout.addEventListener('change', applyAndRender);
    if (els.volumeBreakout) els.volumeBreakout.addEventListener('change', applyAndRender);
    els.refreshBtn.addEventListener('click', triggerRefresh);
    els.exportBtn.addEventListener('click', exportCSV);

    document.querySelectorAll('#stocksTable th[data-sort]').forEach(th => {
        th.addEventListener('click', () => doSort(th.dataset.sort));
    });

    els.tableBody.addEventListener('click', e => {
        const tr = e.target.closest('tr');
        if (!tr || tr.querySelector('.tbl-empty')) return;
        const symbolSpan = tr.querySelector('.sym-cell');
        if (symbolSpan) {
            const symbol = symbolSpan.textContent.trim();
            const tvUrl = `https://www.tradingview.com/chart/?symbol=NSE%3A${symbol}`;
            window.open(tvUrl, '_blank');
        }
    });
}

function clearFilters() {
    [els.minPrice, els.maxPrice, els.minVolRatio, els.maxVolRatio,
     els.minChangePct, els.maxChangePct, els.minDayRange, els.maxDayRange,
     els.minPriceVsHigh, els.maxPriceVsHigh, els.minGap, els.maxGap,
     els.minTurnover, els.minVolume, els.search].forEach(el => { if (el) el.value = ''; });
    if (els.priceBreakout) els.priceBreakout.value = 'all';
    if (els.volumeBreakout) els.volumeBreakout.value = 'all';
    applyAndRender();
}

function num(el, fallback) {
    const v = parseFloat(el?.value);
    return isNaN(v) ? fallback : v;
}

function applyAndRender() {
    if (!marketData.stocks?.length) return;

    const query    = els.search.value.trim().toUpperCase();
    const minP     = num(els.minPrice,       0);
    const maxP     = num(els.maxPrice,       Infinity);
    const minVR    = num(els.minVolRatio,    0);
    const maxVR    = num(els.maxVolRatio,    Infinity);
    const minCh    = num(els.minChangePct,   -Infinity);
    const maxCh    = num(els.maxChangePct,    Infinity);
    const minDR    = num(els.minDayRange,    0);
    const maxDR    = num(els.maxDayRange,    Infinity);
    const minPVH   = num(els.minPriceVsHigh, 0);
    const maxPVH   = num(els.maxPriceVsHigh, Infinity);
    const minGap   = num(els.minGap,        -Infinity);
    const maxGap   = num(els.maxGap,         Infinity);
    const minTurn  = num(els.minTurnover,    0);
    const minVol   = num(els.minVolume,      0);

    const priceBO  = els.priceBreakout?.value || 'all';
    const volumeBO = els.volumeBreakout?.value || 'all';

    filteredStocks = marketData.stocks.filter(s => {
        if (query && !s.symbol.includes(query))      return false;
        if (s.ltp < minP || s.ltp > maxP)            return false;
        if (s.volume_ratio < minVR || s.volume_ratio > maxVR) return false;
        if (s.change_pct < minCh || s.change_pct > maxCh)     return false;
        if (s.day_range_pct < minDR || s.day_range_pct > maxDR) return false;
        if (s.price_vs_high_pct < minPVH || s.price_vs_high_pct > maxPVH) return false;
        if (s.gap_pct < minGap || s.gap_pct > maxGap)         return false;
        if (s.turnover_cr < minTurn)                 return false;
        if (s.volume < minVol)                        return false;

        if (priceBO === '52w_high' && !s.is_52w_high_breakout) return false;
        if (priceBO === 'near_52w_high' && !s.near_52w_high)   return false;
        if (priceBO === '1m_high' && !s.is_1m_high_breakout)   return false;
        if (priceBO === '3m_high' && !s.is_3m_high_breakout)   return false;
        if (priceBO === '1w_high' && !s.is_1w_high_breakout)   return false;

        if (volumeBO === '52w_vol' && !s.is_52w_vol_breakout)  return false;
        if (volumeBO === '3m_vol' && !s.is_3m_vol_breakout)    return false;
        if (volumeBO === '1m_vol' && !s.is_1m_vol_breakout)    return false;
        if (volumeBO === '1w_vol' && !s.is_1w_vol_breakout)    return false;

        return true;
    });

    sortStocks();
    renderStats();
    renderTable();
    renderChart();
}

function doSort(col) {
    if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortCol = col; sortDir = 'desc'; }

    document.querySelectorAll('#stocksTable th').forEach(th => {
        th.classList.remove('sort-active');
        const ic = th.querySelector('i');
        if (ic) { ic.className = 'fa-solid fa-sort'; ic.style.color = ''; }
    });
    const active = document.querySelector(`#stocksTable th[data-sort="${col}"]`);
    if (active) {
        active.classList.add('sort-active');
        const ic = active.querySelector('i');
        if (ic) {
            ic.className = sortDir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
            ic.style.color = 'var(--indigo)';
        }
    }

    sortStocks();
    renderTable();
}

function sortStocks() {
    filteredStocks.sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortDir === 'asc' ? va - vb : vb - va;
    });
}

function renderStats() {
    const all = marketData.stocks;
    els.totalCard.textContent  = all.length.toLocaleString('en-IN');
    els.matchCard.textContent  = filteredStocks.length.toLocaleString('en-IN');

    if (all.length) {
        const avg = all.reduce((s, x) => s + x.change_pct, 0) / all.length;
        els.avgChangeCard.textContent = (avg >= 0 ? '+' : '') + avg.toFixed(2) + '%';
        els.avgChangeCard.className = 'stat-pill-val ' + (avg >= 0 ? 'gain' : 'loss');

        const gainers = all.filter(x => x.change_pct > 0).length;
        const losers  = all.filter(x => x.change_pct < 0).length;
        els.gainersCard.textContent = gainers.toLocaleString('en-IN');
        els.gainersCard.className = 'stat-pill-val gain';
        els.losersCard.textContent  = losers.toLocaleString('en-IN');
        els.losersCard.className = 'stat-pill-val loss';

        if (filteredStocks.length > 0) {
            const top = [...filteredStocks].sort((a,b) => b.volume_ratio - a.volume_ratio)[0];
            els.topBreakout.textContent = top.symbol;
            els.topBreakout.className = 'stat-pill-val';
            els.topBreakoutSub.textContent = `${top.volume_ratio.toFixed(1)}x Volume`;
        } else {
            els.topBreakout.textContent = '—';
            els.topBreakoutSub.textContent = 'No matches';
        }
    }
}

function renderTable() {
    els.resultsPill.textContent = `${filteredStocks.length.toLocaleString('en-IN')} result${filteredStocks.length !== 1 ? 's' : ''}`;

    if (!filteredStocks.length) {
        els.tableBody.innerHTML = `<tr><td colspan="9" class="tbl-empty">No stocks match the active criteria — try adjusting or resetting filters.</td></tr>`;
        return;
    }

    let html = '';
    filteredStocks.forEach((s, i) => {
        const chgClass  = s.change_pct > 0 ? 'gain' : s.change_pct < 0 ? 'loss' : 'flat';
        const chgPfx    = s.change_pct > 0 ? '+' : '';
        const gapClass  = s.gap_pct > 0 ? 'gain' : s.gap_pct < 0 ? 'loss' : 'flat';
        const gapPfx    = s.gap_pct > 0 ? '+' : '';

        let vrClass = 'vr-normal';
        let vrIcon  = '';
        if (s.volume_ratio >= 10)  { vrClass = 'vr-badge vr-extreme';  vrIcon = '🔥'; }
        else if (s.volume_ratio >= 5) { vrClass = 'vr-badge vr-strong'; vrIcon = '⚡'; }
        else if (s.volume_ratio >= 2) { vrClass = 'vr-badge vr-moderate'; vrIcon = '▲'; }

        const pvh     = Math.min(100, Math.max(0, s.price_vs_high_pct));
        const barColor = pvh >= 70 ? 'var(--emerald)' : pvh >= 40 ? 'var(--orange)' : 'var(--crimson)';

        let badges = '';
        if (s.is_52w_high_breakout) badges += `<span class="bo-badge bo-52w-price" title="52-Week High Breakout">52W H</span>`;
        else if (s.near_52w_high)   badges += `<span class="bo-badge bo-52w-near" title="Near 52-Week High">Near 52W</span>`;
        
        if (s.is_52w_vol_breakout)  badges += `<span class="bo-badge bo-52w-vol" title="52-Week High Volume Breakout">52W Vol</span>`;
        else if (s.is_3m_vol_breakout) badges += `<span class="bo-badge bo-3m-vol" title="3-Month High Volume Breakout">3M Vol</span>`;
        else if (s.is_1m_vol_breakout) badges += `<span class="bo-badge bo-1m-vol" title="1-Month High Volume Breakout">1M Vol</span>`;
        else if (s.is_1w_vol_breakout) badges += `<span class="bo-badge bo-1w-vol" title="Weekly High Volume Breakout">Weekly Vol</span>`;

        html += `<tr>
          <td>
            <span class="row-num">${i + 1}&nbsp;</span>
            <span class="sym-cell">${s.symbol}</span>
            <span class="badge-container">${badges}</span>
          </td>
          <td class="tr">₹${s.ltp.toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td class="tr ${chgClass}">${chgPfx}${s.change_pct.toFixed(2)}%</td>
          <td class="tr ${gapClass}">${gapPfx}${s.gap_pct.toFixed(2)}%</td>
          <td class="tr">${s.volume.toLocaleString('en-IN')}</td>
          <td class="tr">
            <span class="${vrClass}">${vrIcon} ${s.volume_ratio.toFixed(2)}x</span>
          </td>
          <td class="tr">${s.day_range_pct.toFixed(2)}%</td>
          <td class="tr">
            <div class="cs-bar-wrapper">
              <span class="${pvh >= 70 ? 'gain' : pvh <= 30 ? 'loss' : 'flat'}">${pvh.toFixed(0)}%</span>
              <div class="cs-bar-bg">
                <div class="cs-bar-fill" style="width:${pvh}%;background:${barColor}"></div>
              </div>
            </div>
          </td>
          <td class="tr">${s.turnover_cr.toFixed(2)}</td>
        </tr>`;
    });

    els.tableBody.innerHTML = html;
}

function renderChart() {
    const ctx = document.getElementById('breakoutChart').getContext('2d');
    if (breakoutChart) breakoutChart.destroy();

    const top10 = [...filteredStocks]
        .sort((a, b) => b.volume_ratio - a.volume_ratio)
        .slice(0, 10);

    if (!top10.length) return;

    breakoutChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top10.map(s => s.symbol),
            datasets: [{
                label: 'Volume Ratio (x)',
                data: top10.map(s => s.volume_ratio),
                backgroundColor: top10.map(s =>
                    s.change_pct >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)'
                ),
                borderColor: top10.map(s =>
                    s.change_pct >= 0 ? 'rgba(16,185,129,1)' : 'rgba(239,68,68,1)'
                ),
                borderWidth: 1,
                borderRadius: 4,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const s = top10[ctx.dataIndex];
                            return [
                                ` Vol Ratio: ${s.volume_ratio.toFixed(2)}x`,
                                ` Change: ${s.change_pct >= 0 ? '+' : ''}${s.change_pct.toFixed(2)}%`,
                                ` Turnover: ₹${s.turnover_cr.toFixed(2)} Cr`,
                                ` Cls Strength: ${s.price_vs_high_pct.toFixed(0)}%`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#8892a4', font: { family: 'Outfit', size: 11 } },
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#f0f2f8', font: { family: 'Outfit', weight: 'bold', size: 12 } }
                }
            }
        }
    });
}

function exportCSV() {
    if (!filteredStocks.length) { alert('No data to export.'); return; }

    const headers = ['Symbol','LTP','Change%','Gap%','Volume','AvgVolume','VolumeRatio',
                     'DayRange%','ClosingStrength%','Turnover_Cr','AvgTurnover_Cr'];
    const rows = filteredStocks.map(s => [
        s.symbol, s.ltp, s.change_pct, s.gap_pct, s.volume, s.avg_volume,
        s.volume_ratio, s.day_range_pct, s.price_vs_high_pct,
        s.turnover_cr, s.avg_turnover_cr
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const filename = `nse_scan_${new Date().toISOString().slice(0,10)}.csv`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    fetch('/api/export-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: csv, filename: filename })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(`Export completed successfully!\n\n1. Downloaded via browser.\n2. Saved directly to server path: ${data.filePath}`);
        } else {
            alert(`Browser download completed, but server save failed:\n${data.error}`);
        }
    })
    .catch(err => {
        console.error('CSV Server export error:', err);
    });
}

async function triggerRefresh() {
    try {
        els.refreshBtn.disabled = true;
        els.overlay.classList.remove('hidden');

        const res = await fetch('/api/refresh', { method: 'POST' });
        const data = await res.json();

        if (res.status === 400 && data.status === 'refreshing') {
            // A scrape is already in progress — just attach to it
            showToast('⏳ A data refresh is already running. Waiting for it to finish...');
            pollRefresh();
            return;
        }

        if (!res.ok) throw new Error(data.error || 'Server rejected refresh');

        pollRefresh();
    } catch (e) {
        showToast('❌ Refresh failed: ' + e.message, true);
        els.refreshBtn.disabled = false;
        els.overlay.classList.add('hidden');
    }
}

function pollRefresh() {
    let elapsedMs = 0;
    const OVERLAY_TIMEOUT_MS = 60000; // Hide overlay after 60s
    let overlayHidden = false;

    const iv = setInterval(async () => {
        try {
            const res = await fetch('/api/refresh-status');
            const st  = await res.json();
            elapsedMs += 2000;

            // After 60s, hide the overlay so user can interact with the page,
            // but keep polling silently until scrape finishes
            if (!overlayHidden && elapsedMs >= OVERLAY_TIMEOUT_MS) {
                overlayHidden = true;
                els.refreshBtn.disabled = false;
                els.overlay.classList.add('hidden');
                // Show a subtle toast-style notice
                showToast('⏳ Data refresh is still running in background. Table will auto-update when done.');
            }

            if (!st.refreshing) {
                clearInterval(iv);
                els.refreshBtn.disabled = false;
                els.overlay.classList.add('hidden');
                if (st.error) {
                    showToast('❌ Refresh error: ' + st.error, true);
                } else {
                    loadData();
                    if (!overlayHidden) showToast('✅ Market data refreshed successfully!');
                }
            }
        } catch (e) {
            clearInterval(iv);
            els.refreshBtn.disabled = false;
            els.overlay.classList.add('hidden');
        }
    }, 2000);
}

function showToast(msg, isError = false) {
    const existing = document.getElementById('refreshToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'refreshToast';
    toast.textContent = msg;
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        background: isError ? '#7f1d1d' : '#1d2230',
        color: isError ? '#fca5a5' : '#f0f2f8',
        border: `1px solid ${isError ? '#ef4444' : 'rgba(99,102,241,0.4)'}`,
        borderRadius: '10px',
        padding: '0.85rem 1.25rem',
        fontSize: '0.85rem',
        fontFamily: "'Outfit', sans-serif",
        fontWeight: '600',
        zIndex: '10000',
        maxWidth: '360px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        animation: 'slideInToast 0.3s ease',
        cursor: 'pointer'
    });
    toast.onclick = () => toast.remove();
    document.body.appendChild(toast);

    // Auto-remove after 6 seconds
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 6000);
}// ─── LIVE VIEW PANEL ──────────────────────────────────────────────────────────

let liveData        = null;
let liveActiveTab   = 'gainers';
let liveAutoRefresh = false;
let liveAutoTimer   = null;

const liveEls = () => ({
    panel:      document.getElementById('liveViewPanel'),
    backdrop:   document.getElementById('livePanelBackdrop'),
    openBtn:    document.getElementById('liveViewBtn'),
    closeBtn:   document.getElementById('closeLivePanel'),
    refreshBtn: document.getElementById('liveRefreshNowBtn'),
    autoBtn:    document.getElementById('liveAutoToggleBtn'),
    indicesBar: document.getElementById('liveIndicesBar'),
    tableContainer: document.getElementById('liveTableContainer'),
    fetchedAt:  document.getElementById('liveFetchedAt'),
    tabs:       document.querySelectorAll('.live-tab'),
});

// Wire up listeners once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const le = liveEls();

    le.openBtn.addEventListener('click', openLivePanel);
    le.closeBtn.addEventListener('click', closeLivePanel);
    le.backdrop.addEventListener('click', closeLivePanel);

    le.refreshBtn.addEventListener('click', async () => {
        le.refreshBtn.disabled = true;
        le.refreshBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching...';
        await triggerLiveRefresh();
        le.refreshBtn.disabled = false;
        le.refreshBtn.innerHTML = '<i class="fa-solid fa-rotate"></i> Refresh Now';
    });

    le.autoBtn.addEventListener('click', toggleLiveAuto);

    le.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            le.tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            liveActiveTab = tab.dataset.tab;
            renderLiveTable();
        });
    });
});

function openLivePanel() {
    const le = liveEls();
    le.panel.classList.remove('hidden');
    le.backdrop.classList.remove('hidden');
    document.getElementById('liveViewBtn').classList.add('active');

    // Auto-fetch if no data yet
    if (!liveData) {
        triggerLiveRefresh();
    } else {
        renderLiveIndices();
        renderLiveTable();
    }
}

function closeLivePanel() {
    const le = liveEls();
    le.panel.classList.add('hidden');
    le.backdrop.classList.add('hidden');
    document.getElementById('liveViewBtn').classList.remove('active');
    if (liveAutoRefresh) toggleLiveAuto(); // stop auto-refresh when closing
}

async function triggerLiveRefresh() {
    const le = liveEls();
    le.tableContainer.innerHTML = '<div class="live-empty"><i class="fa-solid fa-spinner fa-spin"></i> Fetching live data from NSE...</div>';

    try {
        // Kick off background fetch
        const startRes = await fetch('/api/live-refresh', { method: 'POST' });
        // If 400, already running — just poll
        // Poll until done
        await pollLiveStatus();
        // Now load data
        const dataRes = await fetch('/api/live-data');
        if (!dataRes.ok) throw new Error('No live data available');
        liveData = await dataRes.json();

        if (le.fetchedAt) le.fetchedAt.textContent = '— ' + (liveData.fetchedAt || '');
        renderLiveIndices();
        renderLiveTable();
    } catch (e) {
        le.tableContainer.innerHTML = `<div class="live-empty" style="color:#f87171">⚠️ ${e.message}</div>`;
    }
}

async function pollLiveStatus() {
    return new Promise((resolve) => {
        const iv = setInterval(async () => {
            try {
                const res = await fetch('/api/live-status');
                const st  = await res.json();
                if (!st.refreshing) {
                    clearInterval(iv);
                    resolve();
                }
            } catch {
                clearInterval(iv);
                resolve();
            }
        }, 1000);
        // Max wait 30s
        setTimeout(() => { clearInterval(iv); resolve(); }, 30000);
    });
}

function renderLiveIndices() {
    const le = liveEls();
    if (!liveData?.indices?.length) {
        le.indicesBar.innerHTML = '<div class="indices-loading">No index data</div>';
        return;
    }

    // Show only the key indices
    const KEY_INDICES = ['NIFTY 50','NIFTY BANK','NIFTY NEXT 50','NIFTY MIDCAP SELECT',
                         'NIFTY FIN SERVICE','NIFTY IT','NIFTY AUTO','NIFTY PHARMA'];
    const shown = liveData.indices.filter(idx => KEY_INDICES.includes(idx.name));

    le.indicesBar.innerHTML = shown.map(idx => {
        const up = idx.pChange >= 0;
        const chgClass = up ? 'gain' : 'loss';
        const pfx = up ? '+' : '';
        return `
        <div class="index-chip">
            <span class="index-name">${idx.name.replace('NIFTY ', '')}</span>
            <span class="index-val">${idx.last?.toLocaleString('en-IN') ?? '—'}</span>
            <span class="index-chg ${chgClass}">${pfx}${idx.pChange?.toFixed(2) ?? '—'}%</span>
        </div>`;
    }).join('');
}

function renderLiveTable() {
    const le = liveEls();
    if (!liveData) return;

    let stocks = [];
    if (liveActiveTab === 'gainers') stocks = liveData.gainers || [];
    else if (liveActiveTab === 'losers') stocks = liveData.losers || [];
    else stocks = liveData.mostActive || [];

    if (!stocks.length) {
        le.tableContainer.innerHTML = '<div class="live-empty">No data for this tab.</div>';
        return;
    }

    const isActive = liveActiveTab === 'active';

    le.tableContainer.innerHTML = `
    <table class="live-stock-table">
        <thead><tr>
            <th style="text-align:left">#&nbsp; Symbol</th>
            <th>LTP ₹</th>
            <th>Chg%</th>
            <th>Open ₹</th>
            <th>High ₹</th>
            <th>Low ₹</th>
            <th>Volume</th>
            ${isActive ? '<th>Turnover ₹Cr</th>' : ''}
        </tr></thead>
        <tbody>
        ${stocks.map((s, i) => {
            const up = (s.pChange ?? 0) >= 0;
            const pctClass = up ? 'pct-up' : 'pct-down';
            const pfx = up ? '▲ +' : '▼ ';
            const vol = s.volume ? s.volume.toLocaleString('en-IN') : '—';
            const turnover = s.turnover ? (s.turnover / 1e7).toFixed(2) : '—';
            return `<tr>
                <td><span class="row-num">${i+1}&nbsp;</span><span class="live-sym">${s.symbol}</span></td>
                <td>₹${s.ltp?.toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2}) ?? '—'}</td>
                <td><span class="pct-badge ${pctClass}">${pfx}${s.pChange?.toFixed(2) ?? '—'}%</span></td>
                <td>₹${s.open?.toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2}) ?? '—'}</td>
                <td class="gain">₹${s.dayHigh?.toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2}) ?? '—'}</td>
                <td class="loss">₹${s.dayLow?.toLocaleString('en-IN', {minimumFractionDigits:2,maximumFractionDigits:2}) ?? '—'}</td>
                <td>${vol}</td>
                ${isActive ? `<td>${turnover}</td>` : ''}
            </tr>`;
        }).join('')}
        </tbody>
    </table>`;
}

function toggleLiveAuto() {
    const le = liveEls();
    liveAutoRefresh = !liveAutoRefresh;

    if (liveAutoRefresh) {
        le.autoBtn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Auto: ON';
        le.autoBtn.classList.add('auto-on');
        liveAutoTimer = setInterval(() => {
            if (!document.getElementById('liveViewPanel').classList.contains('hidden')) {
                triggerLiveRefresh();
            }
        }, 60000);
    } else {
        le.autoBtn.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Auto: OFF';
        le.autoBtn.classList.remove('auto-on');
        if (liveAutoTimer) { clearInterval(liveAutoTimer); liveAutoTimer = null; }
    }
}
