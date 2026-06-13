'use strict';
/* =====================================================
   NSE PRO SCREENER — app.js
   ===================================================== */

// ---- STRATEGY PRESETS DEFINITION ----
// Each preset auto-fills the filter inputs.
// These mirror criteria used by professional trading desks.
const PRESETS = {
    // 🏦 Institutions quietly loading positions:
    //    High volume, but price barely moved → classic accumulation
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
    // 📤 Institutions distributing / selling:
    //    High volume on a down day → distribution pattern
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
    // 💥 Vol surge + big price move = trend momentum:
    //    Day traders & momentum funds look for this
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
    // 🔒 High volume, tight range = spring coiling before move:
    //    Used by positional traders to enter before expansion
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
    // 🚀 Gap-up with volume follow-through:
    //    Breakout from previous session, buyers chasing
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
    // 📉 Gap up/down but price reversed → mean-reversion play:
    //    Fade traders & contrarians hunt these setups
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
    // 💧 Top liquidity names — institutions can enter/exit easily:
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
    // 💪 Stocks closing near day high = buyers in control:
    //    Swing traders enter on close for overnight continuation
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

// ---- STATE ----
let marketData    = { stocks: [] };
let filteredStocks = [];
let sortCol       = 'volume_ratio';
let sortDir       = 'desc';
let activePreset  = null;
let breakoutChart = null;
let rowIndex      = 0;

// ---- DOM REFS ----
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

// =====================================================
//  INIT
// =====================================================
window.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupPresets();
    setupListeners();
});

// =====================================================
//  DATA LOAD
// =====================================================
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

// =====================================================
//  PRESETS
// =====================================================
function setupPresets() {
    const cards = els.presetsGrid.querySelectorAll('.preset-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const key = card.dataset.preset;
            if (activePreset === key) {
                // Deselect — show all
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

// =====================================================
//  LISTENERS
// =====================================================
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

    // Sortable headers
    document.querySelectorAll('#stocksTable th[data-sort]').forEach(th => {
        th.addEventListener('click', () => doSort(th.dataset.sort));
    });

    // Row click event to open TradingView directly
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

// =====================================================
//  FILTER LOGIC
// =====================================================
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

        // Price Breakout filters
        if (priceBO === '52w_high' && !s.is_52w_high_breakout) return false;
        if (priceBO === 'near_52w_high' && !s.near_52w_high)   return false;
        if (priceBO === '1m_high' && !s.is_1m_high_breakout)   return false;
        if (priceBO === '3m_high' && !s.is_3m_high_breakout)   return false;
        if (priceBO === '1w_high' && !s.is_1w_high_breakout)   return false;

        // Volume Breakout filters
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

// =====================================================
//  SORT
// =====================================================
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

// =====================================================
//  RENDER STATS
// =====================================================
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

        // Top breakout from filtered list
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

// =====================================================
//  RENDER TABLE
// =====================================================
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

        // Volume ratio badge class
        let vrClass = 'vr-normal';
        let vrIcon  = '';
        if (s.volume_ratio >= 10)  { vrClass = 'vr-badge vr-extreme';  vrIcon = '🔥'; }
        else if (s.volume_ratio >= 5) { vrClass = 'vr-badge vr-strong'; vrIcon = '⚡'; }
        else if (s.volume_ratio >= 2) { vrClass = 'vr-badge vr-moderate'; vrIcon = '▲'; }

        // Closing strength bar
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

// =====================================================
//  RENDER CHART
// =====================================================
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

// =====================================================
//  EXPORT CSV
// =====================================================
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

    // 1. Trigger browser download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // 2. Direct save to C:\download on server machine
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

// =====================================================
//  DATA REFRESH
// =====================================================
async function triggerRefresh() {
    try {
        els.refreshBtn.disabled = true;
        els.overlay.classList.remove('hidden');

        const res = await fetch('/api/refresh', { method: 'POST' });
        if (!res.ok) throw new Error('Server rejected refresh');

        pollRefresh();
    } catch (e) {
        alert('Refresh failed: ' + e.message);
        els.refreshBtn.disabled = false;
        els.overlay.classList.add('hidden');
    }
}

function pollRefresh() {
    const iv = setInterval(async () => {
        try {
            const res = await fetch('/api/refresh-status');
            const st  = await res.json();
            if (!st.refreshing) {
                clearInterval(iv);
                els.refreshBtn.disabled = false;
                els.overlay.classList.add('hidden');
                if (st.error) alert('Refresh error:\n' + st.error);
                else loadData();
            }
        } catch (e) {
            clearInterval(iv);
            els.refreshBtn.disabled = false;
            els.overlay.classList.add('hidden');
        }
    }, 2000);
}


