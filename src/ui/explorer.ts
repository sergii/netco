export function explorerPage(): Response {
  const html = `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Netco Explorer</title>
  <meta name="description" content="Аналітика інтернет-провайдерів України з доказовим походженням даних">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2716%27 fill=%27%2310151d%27/%3E%3Ctext x=%2732%27 y=%2743%27 text-anchor=%27middle%27 font-family=%27Arial%27 font-size=%2736%27 font-weight=%27700%27 fill=%27%2354d59d%27%3EN%3C/text%3E%3C/svg%3E">\n  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.css">
  <style>
    :root {
      color-scheme: dark;
      --bg: #0a0d12;
      --panel: #10151d;
      --panel-2: #151c26;
      --line: #263141;
      --text: #eef4fb;
      --muted: #91a0b4;
      --green: #54d59d;
      --amber: #f2c96d;
      --blue: #79aafc;
      --red: #ff8a8a;
      --radius: 18px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 15% 0%, rgba(80,120,190,.12), transparent 28rem),
        var(--bg);
      color: var(--text);
    }
    button, input { font: inherit; }
    a { color: inherit; }
    .shell { max-width: 1240px; margin: 0 auto; padding: 28px 22px 72px; }
    .shell.map-mode {
      max-width:none;
      height:100vh;
      padding:14px 18px;
      overflow:hidden;
      display:flex;
      flex-direction:column;
    }
    .shell.map-mode .topbar {
      margin-bottom:10px;
      flex:0 0 auto;
    }
    .shell.map-mode .hero {
      display:none;
    }
    .shell.map-mode .tabs {
      margin:4px 0 10px;
      flex:0 0 auto;
    }
    .shell.map-mode #map-view {
      min-height:0;
      flex:1 1 auto;
    }
    .shell.map-mode #map-view.active {
      display:block;
    }
    .shell.map-mode #map-view .map-card {
      height:100%;
      min-height:0;
      display:flex;
      flex-direction:column;
    }
    .shell.map-mode .map-stage {
      flex:1 1 auto;
      height:auto;
      min-height:0;
    }
    .shell.map-mode #map {
      height:100%;
      min-height:0;
    }
    .shell.map-mode .footer {
      display:none;
    }
    .topbar {
      display:flex; align-items:center; justify-content:space-between; gap:20px;
      margin-bottom: 42px;
    }
    .brand { display:flex; align-items:center; gap:12px; }
    .mark {
      width:34px; height:34px; border-radius:11px; display:grid; place-items:center;
      background:linear-gradient(145deg,#74f0b2,#6b8dff); color:#07100c; font-weight:900;
      box-shadow:0 10px 32px rgba(84,213,157,.18);
    }
    .brand-name { font-weight:760; letter-spacing:-.02em; font-size:18px; }
    .brand-sub { color:var(--muted); font-size:12px; }
    .live {
      display:flex; align-items:center; gap:8px; color:var(--muted); font-size:13px;
      border:1px solid var(--line); padding:7px 11px; border-radius:999px; background:rgba(16,21,29,.72);
    }
    .dot { width:8px; height:8px; border-radius:50%; background:var(--green); box-shadow:0 0 0 4px rgba(84,213,157,.1); }
    .hero { max-width:800px; margin-bottom:34px; }
    .eyebrow { color:var(--green); text-transform:uppercase; letter-spacing:.14em; font-size:11px; font-weight:800; }
    h1 { font-size:clamp(36px,7vw,72px); line-height:.98; letter-spacing:-.055em; margin:12px 0 18px; }
    .lede { color:#aeb9c8; font-size:18px; max-width:700px; }
    .tabs { display:flex; gap:7px; flex-wrap:wrap; margin:28px 0 20px; }
    .tab {
      color:var(--muted); border:1px solid transparent; background:transparent;
      padding:9px 13px; border-radius:11px; cursor:pointer;
    }
    .tab.active { color:var(--text); background:var(--panel-2); border-color:var(--line); }
    .view { display:none; }
    .view.active { display:block; }
    .grid { display:grid; grid-template-columns:repeat(12,1fr); gap:16px; }
    .card {
      background:linear-gradient(180deg,rgba(21,28,38,.92),rgba(16,21,29,.92));
      border:1px solid var(--line); border-radius:var(--radius); padding:20px;
      box-shadow:0 16px 50px rgba(0,0,0,.18);
    }
    .metric { grid-column:span 3; min-height:122px; }
    .metric .value { font-size:30px; font-weight:760; letter-spacing:-.04em; margin-top:12px; }
    .label { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
    .lookup { grid-column:span 12; padding:24px; }
    .lookup-head { display:flex; justify-content:space-between; align-items:flex-end; gap:18px; margin-bottom:20px; }
    .lookup h2, .section-title { margin:0; font-size:22px; letter-spacing:-.025em; }
    .help { color:var(--muted); font-size:13px; max-width:560px; }
    .fields { display:grid; grid-template-columns:130px 1.2fr 1.7fr 110px auto; gap:10px; }
    input {
      width:100%; color:var(--text); background:#0b1017; border:1px solid var(--line);
      border-radius:12px; padding:12px 13px; outline:none;
    }
    input:focus { border-color:#547bba; box-shadow:0 0 0 3px rgba(121,170,252,.09); }
    .primary {
      border:0; border-radius:12px; padding:12px 18px; cursor:pointer; font-weight:750;
      background:var(--text); color:#0a0d12;
    }
    .secondary {
      border:1px solid var(--line); border-radius:12px; padding:10px 13px; cursor:pointer;
      background:#0b1017; color:var(--muted);
    }
    .results { margin-top:18px; display:grid; gap:10px; }
    .provider-result {
      border:1px solid var(--line); border-radius:15px; padding:16px;
      background:rgba(10,13,18,.38);
    }
    .row { display:flex; align-items:center; justify-content:space-between; gap:14px; }
    .provider-title { font-size:17px; font-weight:720; }
    .muted { color:var(--muted); }
    .pill {
      display:inline-flex; align-items:center; gap:7px; border:1px solid var(--line);
      border-radius:999px; padding:5px 9px; font-size:12px; color:var(--muted);
    }
    .pill.good { color:var(--green); border-color:rgba(84,213,157,.28); background:rgba(84,213,157,.06); }
    .techs { display:flex; flex-wrap:wrap; gap:7px; margin-top:12px; }
    .tech { background:#141d28; border:1px solid var(--line); border-radius:10px; padding:8px 10px; font-size:13px; }
    .list { display:grid; gap:10px; margin-top:14px; }
    .item { border:1px solid var(--line); background:var(--panel); border-radius:15px; padding:16px; }
    .item-title { font-weight:700; }
    .item-meta { color:var(--muted); font-size:13px; margin-top:4px; }
    .trail {
      display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:16px;
    }
    .trail-step { border:1px solid var(--line); border-radius:14px; padding:15px; min-height:105px; background:#0d1219; }
    .trail-num { color:var(--green); font-size:11px; font-weight:800; letter-spacing:.1em; }
    .trail-name { font-weight:700; margin:7px 0 5px; }
    .trail-id { color:var(--muted); font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; word-break:break-all; }
    pre {
      margin:14px 0 0; padding:16px; border-radius:14px; overflow:auto;
      background:#080b0f; border:1px solid var(--line); color:#afbdd0;
      font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;
    }
    .empty { color:var(--muted); padding:20px 0; }
    .map-card { padding:0; overflow:hidden; position:relative; }
    .map-toolbar {
      display:flex; align-items:center; justify-content:space-between; gap:12px;
      padding:14px 16px; border-bottom:1px solid var(--line); background:var(--panel);
    }
    .map-title { font-weight:720; }\n    .map-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
    .map-meta { color:var(--muted); font-size:12px; }
    .map-toolbar-main {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
    }
    .map-levels {
      display:flex;
      align-items:center;
      gap:6px;
      margin-top:10px;
    }
    .map-level-label {
      margin-right:4px;
      color:var(--muted);
      font-size:11px;
      text-transform:uppercase;
      letter-spacing:.08em;
    }
    .map-level {
      border:1px solid var(--line);
      border-radius:999px;
      padding:5px 10px;
      background:#0b1017;
      color:var(--muted);
      font-size:12px;
      cursor:pointer;
    }
    .map-level:hover:not(:disabled) {
      color:var(--text);
      border-color:#46627f;
    }
    .map-level.active {
      color:var(--text);
      background:#1a2430;
      border-color:#6c9bd1;
    }
    .map-level:disabled {
      cursor:not-allowed;
      opacity:.42;
    }
    .map-stage {
      position:relative;
      min-height:460px;
      height:min(68vh,720px);
      overflow:hidden;
    }
    .map-stage #map {
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      min-height:0;
    }
    .map-drawer {
      position:absolute;
      z-index:6;
      inset:0 0 0 auto;
      width:min(430px,calc(100% - 56px));
      display:flex;
      flex-direction:column;
      background:rgba(10,14,20,.98);
      border-left:1px solid var(--line);
      box-shadow:-18px 0 50px rgba(0,0,0,.34);
      transform:translateX(102%);
      transition:transform 180ms ease;
      pointer-events:none;
    }
    .map-drawer.open {
      transform:translateX(0);
      pointer-events:auto;
    }
    .map-drawer-head {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:16px;
      padding:16px;
      border-bottom:1px solid var(--line);
    }
    .map-drawer-title {
      margin-top:4px;
      font-size:18px;
      font-weight:750;
      letter-spacing:-.02em;
    }
    .map-drawer-close {
      width:34px;
      height:34px;
      border:1px solid var(--line);
      border-radius:10px;
      background:#0d1219;
      color:var(--muted);
      font-size:24px;
      line-height:1;
      cursor:pointer;
    }
    .map-drawer-close:hover {
      color:var(--text);
      border-color:#46627f;
    }
    .map-drawer-body {
      min-height:0;
      overflow:auto;
      padding:16px;
      display:grid;
      gap:12px;
    }
    .map-stats {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:10px;
    }
    #map { width:100%; height:min(68vh,720px); min-height:460px; background:#0d1219; }
    .map-inspector {
      display:grid; grid-template-columns:repeat(5,1fr); gap:10px;
      padding:14px 16px; border-top:1px solid var(--line); background:var(--panel);
    }
    .map-stat { min-width:0; }
    .map-stat strong { display:block; margin-top:4px; font-size:17px; overflow:hidden; text-overflow:ellipsis; }
    .map-empty { grid-column:1/-1; color:var(--muted); }
    .map-detail {
      grid-column:1/-1; border-top:1px solid var(--line); margin-top:4px;
      padding-top:14px; display:grid; gap:10px;
    }
    .map-addresses { display:grid; gap:8px; }
    .map-address {
      display:grid; grid-template-columns:1fr auto; gap:14px; align-items:center;
      border:1px solid var(--line); border-radius:13px; padding:12px 13px;
      background:#0d1219;
    }
    .map-address-title { font-weight:700; }
    .map-address-meta { color:var(--muted); font-size:12px; margin-top:3px; }
    .map-address-detail {
      border:1px solid var(--line); border-radius:13px; padding:14px;
      background:#0a0e14;
    }
    .address-workspace-layout {
      display:grid;
      grid-template-columns:minmax(280px,.8fr) minmax(0,2fr);
      gap:16px;
      align-items:start;
    }
    .address-index {
      position:sticky;
      top:0;
      max-height:calc(100vh - 150px);
      overflow:hidden;
      display:flex;
      flex-direction:column;
      gap:12px;
    }
    .address-filter {
      width:100%;
      border:1px solid var(--line);
      background:#0d1219;
      color:var(--text);
      border-radius:11px;
      padding:10px 12px;
      outline:none;
    }
    .address-filter:focus { border-color:#4c6f96; }
    .address-inventory {
      display:grid;
      gap:8px;
      overflow:auto;
      min-height:120px;
    }
    .address-row {
      width:100%;
      text-align:left;
      border:1px solid var(--line);
      background:#0d1219;
      color:var(--text);
      border-radius:12px;
      padding:11px 12px;
      cursor:pointer;
    }
    .address-row:hover,
    .address-row.active {
      border-color:#3c765f;
      background:#101a18;
    }
    .address-row-title { font-weight:720; }
    .address-row-meta { color:var(--muted); font-size:12px; margin-top:3px; }
    .operator-grid {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
      margin-top:14px;
    }
    .operator-panel {
      border:1px solid var(--line);
      border-radius:13px;
      padding:14px;
      background:#0d1219;
      min-width:0;
    }
    .operator-panel.wide { grid-column:1/-1; }
    .operator-heading {
      display:flex;
      justify-content:space-between;
      gap:12px;
      align-items:flex-start;
      margin-bottom:12px;
    }
    .operator-title { font-size:24px; font-weight:760; letter-spacing:-.03em; }
    .operator-subtitle { color:var(--muted); margin-top:4px; }
    .operator-kpis {
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:10px;
      margin:14px 0;
    }
    .operator-kpi {
      border:1px solid var(--line);
      border-radius:12px;
      padding:11px 12px;
      background:#0a0e14;
    }
    .operator-kpi strong { display:block; margin-top:3px; font-size:18px; }
    .quality-flags { display:flex; flex-wrap:wrap; gap:7px; margin-top:9px; }
    .row-actions { display:flex; gap:7px; flex-wrap:wrap; justify-content:flex-end; }
    .maplibregl-ctrl-attrib {
      background:rgba(10,13,18,.82) !important;
      color:#aeb9c8 !important;
    }
    .maplibregl-ctrl-attrib a { color:#d7e1ef !important; }
    .footer { color:#607086; font-size:12px; margin-top:34px; }
    @media (max-width: 900px) {
      .metric { grid-column:span 6; }
      .fields { grid-template-columns:1fr 1fr; }
      .fields .primary { grid-column:span 2; }
      .trail { grid-template-columns:1fr 1fr; }
      .map-inspector { grid-template-columns:1fr 1fr 1fr; }
      .address-workspace-layout { grid-template-columns:1fr; }
      .address-index { position:static; max-height:none; }
      .address-inventory { max-height:340px; }
      .operator-kpis { grid-template-columns:1fr 1fr; }
    }
    @media (max-width: 560px) {
      .shell { padding:20px 14px 48px; }
      .shell.map-mode { padding:10px; }
      .topbar { margin-bottom:30px; }
      .brand-sub { display:none; }
      .metric { grid-column:span 12; min-height:auto; }
      .fields { grid-template-columns:1fr; }
      .fields .primary { grid-column:auto; }
      .lookup-head { align-items:flex-start; flex-direction:column; }
      .trail { grid-template-columns:1fr; }
      #map { min-height:420px; height:62vh; }
      .map-inspector { grid-template-columns:1fr 1fr; }
    }

    /* Admin shell */
    body {
      overflow:hidden;
      background:var(--bg);
    }
    .shell,
    .shell.map-mode {
      max-width:none;
      width:100%;
      height:100vh;
      margin:0;
      padding:0;
      overflow:hidden;
      display:grid;
      grid-template-columns:260px minmax(0,1fr);
    }
    .sidebar {
      min-width:0;
      height:100vh;
      padding:20px 16px 16px;
      border-right:1px solid var(--line);
      background:#0b0f15;
      display:flex;
      flex-direction:column;
      overflow:hidden;
    }
    .sidebar .topbar,
    .shell.map-mode .sidebar .topbar {
      margin:0 0 20px;
      display:block;
      flex:0 0 auto;
    }
    .sidebar .brand {
      gap:11px;
    }
    .sidebar .mark {
      width:38px;
      height:38px;
      border-radius:12px;
    }
    .sidebar-context {
      padding:0 10px 16px;
      border-bottom:1px solid var(--line);
      margin-bottom:12px;
    }
    .sidebar-kicker {
      color:var(--green);
      font-size:10px;
      line-height:1.4;
      text-transform:uppercase;
      letter-spacing:.13em;
      font-weight:800;
    }
    .sidebar-product {
      margin-top:4px;
      font-size:13px;
      color:var(--muted);
    }
    .sidebar .tabs,
    .shell.map-mode .sidebar .tabs {
      display:grid;
      gap:4px;
      margin:0;
      flex:0 0 auto;
    }
    .sidebar .tab {
      width:100%;
      display:flex;
      align-items:center;
      justify-content:flex-start;
      padding:10px 12px;
      border-radius:10px;
      text-align:left;
      color:var(--muted);
      border:1px solid transparent;
      background:transparent;
    }
    .sidebar .tab:hover {
      color:var(--text);
      background:rgba(255,255,255,.035);
    }
    .sidebar .tab.active {
      color:var(--text);
      background:var(--panel-2);
      border-color:var(--line);
    }
    .sidebar-spacer {
      flex:1 1 auto;
      min-height:18px;
    }
    .sidebar .live {
      flex:0 0 auto;
      width:100%;
      border-radius:11px;
      justify-content:flex-start;
      padding:9px 11px;
    }
    .workspace {
      min-width:0;
      height:100vh;
      padding:24px 28px 36px;
      overflow:auto;
      display:flex;
      flex-direction:column;
      background:
        radial-gradient(circle at 10% 0%, rgba(80,120,190,.08), transparent 26rem),
        var(--bg);
    }
    .workspace-header {
      flex:0 0 auto;
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:20px;
      margin-bottom:20px;
    }
    .workspace-header h1 {
      margin:4px 0 3px;
      font-size:28px;
      line-height:1.15;
      letter-spacing:-.035em;
    }
    .workspace-subtitle {
      color:var(--muted);
      font-size:13px;
      max-width:720px;
    }
    .workspace .hero {
      display:none;
    }
    .workspace .view.active {
      display:block;
    }
    .shell.map-mode .workspace {
      overflow:hidden;
      padding:24px 28px 36px;
    }
    .shell.map-mode .workspace-header {
      margin-bottom:20px;
    }
    .shell.map-mode #map-view {
      min-height:0;
      flex:1 1 auto;
    }
    .shell.map-mode #map-view.active {
      display:block;
    }
    .shell.map-mode #map-view .map-card {
      height:100%;
      min-height:0;
      display:flex;
      flex-direction:column;
    }
    .shell.map-mode #map {
      flex:1 1 auto;
      height:auto;
      min-height:0;
    }
    .shell.map-mode .map-inspector {
      flex:0 0 auto;
      max-height:34vh;
      overflow:auto;
    }
    .shell.map-mode .footer {
      display:none;
    }
    @media (max-width: 900px) {
      .shell,
      .shell.map-mode {
        grid-template-columns:210px minmax(0,1fr);
      }
      .sidebar {
        padding-left:12px;
        padding-right:12px;
      }
      .workspace {
        padding:20px 18px 28px;
      }
    }
    @media (max-width: 680px) {
      body {
        overflow:auto;
      }
      .shell,
      .shell.map-mode {
        height:auto;
        min-height:100vh;
        overflow:visible;
        grid-template-columns:1fr;
      }
      .sidebar {
        height:auto;
        border-right:0;
        border-bottom:1px solid var(--line);
        padding:12px;
      }
      .sidebar .topbar {
        margin-bottom:10px;
      }
      .sidebar-context {
        display:none;
      }
      .sidebar .tabs,
      .shell.map-mode .sidebar .tabs {
        display:flex;
        overflow:auto;
        gap:6px;
      }
      .sidebar .tab {
        width:auto;
        white-space:nowrap;
      }
      .sidebar-spacer,
      .sidebar .live {
        display:none;
      }
      .workspace,
      .shell.map-mode .workspace {
        height:auto;
        min-height:0;
        overflow:visible;
        padding:16px 12px 28px;
      }
      .workspace-header {
        margin-bottom:14px;
      }
      .shell.map-mode #map-view .map-card {
        height:auto;
      }
      .shell.map-mode .map-stage {
        height:64vh;
        min-height:420px;
      }
      .shell.map-mode #map {
        height:100%;
        min-height:0;
      }
    }

  </style>
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <header class="topbar">
      <div class="brand">
        <div class="mark">N</div>
        <div>
          <div class="brand-name">Netco Explorer</div>
          <div class="brand-sub">Аналітика провайдерів із доказами</div>
        </div>
      </div>

    </header>
      <div class="sidebar-context">
        <div class="sidebar-kicker">Внутрішня адмінка</div>
        <div class="sidebar-product">Netco CRM</div>
      </div>

    <nav class="tabs" aria-label="Розділи Netco Explorer">
      <button class="tab active" data-tab="overview">Огляд</button>
      <button class="tab" data-tab="map-view">Карта</button>
      <button class="tab" data-tab="addresses">Адреси</button>
      <button class="tab" data-tab="providers">Провайдери</button>
      <button class="tab" data-tab="sources">Джерела</button>
      <button class="tab" data-tab="evidence">Докази</button>
      <button class="tab" data-tab="system">Система</button>
    </nav>
      <div class="sidebar-spacer"></div>
      <div class="live"><span class="dot"></span><span id="live-label">Робоче середовище</span></div>
    </aside>

    <main class="workspace">
      <header class="workspace-header">
        <div>
          <div class="eyebrow">Внутрішня адмінка</div>
          <h1 id="workspace-title">Огляд</h1>
          <div class="workspace-subtitle" id="workspace-subtitle">Операційний стан Netco та пошук по вже збережених даних.</div>
        </div>
      </header>





    <section id="overview" class="view active">
      <div class="grid">
        <div class="card metric"><div class="label">Система</div><div class="value" id="metric-system">...</div><div class="muted" id="metric-system-note">перевірка…</div></div>
        <div class="card metric"><div class="label">Провайдери</div><div class="value" id="metric-providers">...</div><div class="muted">канонічні проєкції</div></div>
        <div class="card metric"><div class="label">Джерела</div><div class="value" id="metric-sources">...</div><div class="muted">зареєстровані джерела доказів</div></div>
        <div class="card metric"><div class="label">Етап</div><div class="value" id="metric-stage">...</div><div class="muted">можливість у робочому середовищі</div></div>

        <div class="card lookup">
          <div class="lookup-head">
            <div>
              <div class="label">Знання про адресу</div>
              <h2>Що Netco вже знає про цю адресу?</h2>
            </div>
            <button class="secondary" id="demo-address">Демо: Клавдіївська 40А</button>
          </div>
          <div class="fields">
            <input id="country" value="UA" aria-label="Код країни">
            <input id="city" value="Київ" aria-label="Місто">
            <input id="street" value="Клавдіївська" aria-label="Вулиця">
            <input id="house" value="40А" aria-label="Будинок">
            <button class="primary" id="lookup">Знайти</button>
          </div>
          <div class="help" style="margin-top:10px">Пошук читає лише збережені проєкції Netco і ніколи не звертається до сайту провайдера.</div>
          <div id="results" class="results"><div class="empty">Натисни «Знайти», щоб побачити збережені докази покриття.</div></div>
        </div>
      </div>
    </section>

    <section id="map-view" class="view">
      <div class="card map-card">
        <div class="map-toolbar">
          <div class="map-toolbar-main">
            <div>
              <div class="label">Збережене покриття</div>
              <div class="map-title">Карта покриття Києва</div>
            </div>
            <div class="map-actions">
              <button class="secondary" id="map-reset-kyiv">До Києва</button>
              <div class="map-meta"><span id="map-cell-count">0 комірок</span></div>
            </div>
          </div>
          <div class="map-levels" aria-label="Рівень представлення карти">
            <span class="map-level-label">Рівень</span>
            <button class="map-level" data-map-level="districts" disabled title="З’явиться після додавання районних геометрій">Райони</button>
            <button class="map-level active" data-map-level="zones">Зони H3</button>
            <button class="map-level" data-map-level="buildings">Будинки</button>
          </div>
        </div>
        <div class="map-stage">
          <div id="map" role="application" aria-label="Карта покриття Netco"></div>
          <aside id="map-drawer" class="map-drawer" aria-hidden="true" aria-label="Інспектор вибраного об’єкта">
            <div class="map-drawer-head">
              <div>
                <div class="label" id="map-drawer-kicker">Об’єкт карти</div>
                <div class="map-drawer-title" id="map-drawer-title">Деталі</div>
              </div>
              <button class="map-drawer-close" id="map-drawer-close" aria-label="Закрити інспектор">×</button>
            </div>
            <div id="map-drawer-body" class="map-drawer-body"></div>
          </aside>
        </div>
      </div>
    </section>

    <section id="addresses" class="view">
      <div class="address-workspace-layout">
        <div class="card address-index">
          <div>
            <div class="label">Збережені адреси</div>
            <h2 class="section-title">Адресний індекс</h2>
          </div>
          <input id="address-filter" class="address-filter" placeholder="Вулиця, будинок, район…" aria-label="Фільтр адрес">
          <div id="address-inventory" class="address-inventory"><div class="empty">Завантаження…</div></div>
        </div>
        <div id="address-workspace" class="card">
          <div class="label">Робоче місце оператора</div>
          <h2 class="section-title">Оберіть адресу</h2>
          <div class="empty">Тут з’являться покриття, свіжість, координати, claim IDs, provenance, evidence trail і data-quality flags.</div>
        </div>
      </div>
    </section>

    <section id="providers" class="view">
      <div class="card">
        <div class="label">Канонічні проєкції</div>
        <h2 class="section-title">Провайдери</h2>
        <div id="providers-list" class="list"><div class="empty">Завантаження…</div></div>
      </div>
    </section>

    <section id="sources" class="view">
      <div class="card">
        <div class="label">Джерела доказів</div>
        <h2 class="section-title">Джерела</h2>
        <div id="sources-list" class="list"><div class="empty">Завантаження…</div></div>
      </div>
    </section>

    <section id="evidence" class="view">
      <div class="card">
        <div class="label">Походження даних</div>
        <h2 class="section-title">Ланцюжок доказів</h2>
        <div class="help">Після пошуку адреси тут з’являється шлях від незмінного знімка до проєкції. Це не окрема копія даних - інтерфейс читає робочий API.</div>
        <div id="evidence-trail" class="trail">
          <div class="trail-step"><div class="trail-num">01</div><div class="trail-name">Знімок</div><div class="trail-id">очікує пошуку</div></div>
          <div class="trail-step"><div class="trail-num">02</div><div class="trail-name">Спостереження</div><div class="trail-id">очікує пошуку</div></div>
          <div class="trail-step"><div class="trail-num">03</div><div class="trail-name">Твердження</div><div class="trail-id">очікує пошуку</div></div>
          <div class="trail-step"><div class="trail-num">04</div><div class="trail-name">Проєкція</div><div class="trail-id">очікує пошуку</div></div>
        </div>
      </div>
    </section>

    <section id="system" class="view">
      <div class="grid">
        <div class="card" style="grid-column:span 12">
          <div class="label">Середовище виконання</div>
          <h2 class="section-title">Стан системи</h2>
          <pre id="system-json">Завантаження…</pre>
        </div>
        <div class="card" style="grid-column:span 12">
          <div class="label">Можливості</div>
          <h2 class="section-title">Метадані API</h2>
          <pre id="meta-json">Завантаження…</pre>
        </div>
      </div>
    </section>

    <div class="footer">Netco Explorer - інтерфейс лише для читання проєкцій, без живих перевірок провайдерів із запитів користувача.</div>
    </main>
  </div>

  <script>
    const state = {
      providers: [],
      sources: [],
      addressInventory: [],
      selectedAddressId: null,
      evidence: null,
      map: null,
      maplibregl: null,
      mapReady: false,
      mapLevel: "zones",
      selectedCell: null,
      selectedAddress: null,
    };

    async function getJson(path) {
      const response = await fetch(path, { headers: { accept: "application/json" } });
      let body = null;
      try { body = await response.json(); } catch {}
      return { ok: response.ok, status: response.status, body };
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function shortId(value) {
      if (!value) return "недоступно";
      const text = String(value);
      return text.length > 22 ? text.slice(0, 10) + "…" + text.slice(-8) : text;
    }

    function formatTime(value) {
      if (!value) return "невідомо";
      const date = new Date(value);
      return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleString("uk-UA");
    }

    function technologies(value) {
      return Array.isArray(value) ? value : [];
    }

    function ukPlural(count, one, few, many) {
      const value = Math.abs(Number(count) || 0);
      const mod100 = value % 100;
      const mod10 = value % 10;
      if (mod100 >= 11 && mod100 <= 19) return many;
      if (mod10 === 1) return one;
      if (mod10 >= 2 && mod10 <= 4) return few;
      return many;
    }

    function translateFreshness(value) {
      return {
        fresh: "свіжі",
        stale: "застарілі",
        unknown: "невідомі",
      }[String(value)] || String(value || "невідомі");
    }

    function translateAvailability(value) {
      return {
        orderable: "можна підключити",
        service_available: "послуга доступна",
        unavailable: "недоступно",
        needs_verification: "потребує перевірки",
        unknown: "невідомо",
      }[String(value)] || String(value || "невідомо");
    }

    function translateSourceKind(value) {
      return {
        official_website: "офіційний сайт",
        approved_geocoder: "схвалений геокодер",
      }[String(value)] || String(value || "невідомий тип");
    }

    const workspaceCopy = {
      overview: {
        title: "Огляд",
        subtitle: "Операційний стан Netco та пошук по вже збережених даних.",
      },
      "map-view": {
        title: "Карта",
        subtitle: "Просторовий огляд збереженого покриття та перехід до доказів.",
      },
      addresses: {
        title: "Адреси",
        subtitle: "Стабільне робоче місце оператора навколо однієї збереженої адреси.",
      },
      providers: {
        title: "Провайдери",
        subtitle: "Канонічні профілі провайдерів, які вже відомі Netco.",
      },
      sources: {
        title: "Джерела",
        subtitle: "Зареєстровані джерела та межі походження даних.",
      },
      evidence: {
        title: "Докази",
        subtitle: "Ланцюжок від незмінного знімка до твердження та проєкції.",
      },
      system: {
        title: "Система",
        subtitle: "Стан runtime, схеми даних та доступних можливостей API.",
      },
    };

    function activateTab(name) {
      document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === name));
      document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === name));
      document.querySelector(".shell").classList.toggle("map-mode", name === "map-view");

      const copy = workspaceCopy[name] || workspaceCopy.overview;
      document.getElementById("workspace-title").textContent = copy.title;
      document.getElementById("workspace-subtitle").textContent = copy.subtitle;

      if (name === "map-view") {
        requestAnimationFrame(() => {
          ensureMap().catch((error) => {
            openMapDrawer("Карта", "Помилка");
            document.getElementById("map-drawer-body").innerHTML =
              '<div class="map-empty">Помилка карти: ' +
              escapeHtml(error instanceof Error ? error.message : "невідома помилка") +
              '</div>';
          });
        });
        return;
      }

      if (name === "addresses") {
        renderAddressInventory(
          document.getElementById("address-filter").value,
        );
      }
    }

    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => activateTab(button.dataset.tab));
    });

    async function loadDashboard() {
      const [status, providers, sources, meta, addressInventory] = await Promise.all([
        getJson("/api/v1/evidence/status"),
        getJson("/api/v1/providers"),
        getJson("/api/v1/sources"),
        getJson("/api/v1/meta"),
        getJson("/api/v1/coverage/addresses?freshness=all"),
      ]);

      state.providers = providers.body?.providers ?? [];
      state.sources = sources.body?.sources ?? [];
      state.addressInventory = addressInventory.body?.addresses ?? [];

      document.getElementById("metric-system").textContent = status.ok && status.body?.ready ? "Працює" : "Проблема";
      document.getElementById("metric-system-note").textContent = status.body?.database?.coverage_schema_ready ? "схема покриття готова" : "див. вкладку «Система»";
      document.getElementById("metric-providers").textContent = String(state.providers.length);
      document.getElementById("metric-sources").textContent = String(state.sources.length);
      document.getElementById("metric-stage").textContent =
        meta.body?.stage === "h3-aggregation-vs13" ? "VS13" : (meta.body?.stage || "невідомо");
      document.getElementById("system-json").textContent = JSON.stringify(status.body, null, 2);
      document.getElementById("meta-json").textContent = JSON.stringify(meta.body, null, 2);

      document.getElementById("providers-list").innerHTML = state.providers.length
        ? state.providers.map((provider) => {
            const tech = technologies(provider.current_technologies);
            return '<div class="item"><div class="row"><div><div class="item-title">' +
              escapeHtml(provider.display_name || provider.slug) +
              '</div><div class="item-meta">' +
              escapeHtml(provider.slug) + ' · спостережено ' + escapeHtml(formatTime(provider.last_observed_at)) +
              '</div></div><span class="pill">' + tech.length + ' технологій</span></div>' +
              (tech.length ? '<div class="techs">' + tech.map((t) => '<span class="tech">' + escapeHtml(t) + '</span>').join("") + '</div>' : '') +
              '</div>';
          }).join("")
        : '<div class="empty">Канонічних проєкцій провайдерів поки немає.</div>';

      document.getElementById("sources-list").innerHTML = state.sources.length
        ? state.sources.map((source) =>
            '<div class="item"><div class="row"><div><div class="item-title">' +
            escapeHtml(source.name || source.slug) +
            '</div><div class="item-meta">' +
            escapeHtml(translateSourceKind(source.kind)) + ' · ' + escapeHtml(source.provider_slug || "без прив’язки") +
            '</div></div><span class="pill">' + escapeHtml(source.slug) + '</span></div></div>'
          ).join("")
        : '<div class="empty">Зареєстрованих джерел поки немає.</div>';

      renderAddressInventory("");
    }

    function addressLabel(address) {
      return [
        address?.city,
        address?.street,
        address?.house_number,
        address?.corpus,
      ].filter(Boolean).join(", ");
    }

    function renderAddressInventory(filterValue) {
      const target = document.getElementById("address-inventory");
      const query = String(filterValue || "").trim().toLocaleLowerCase();
      const rows = state.addressInventory.filter((item) => {
        const address = item.address || {};
        const haystack = [
          address.city,
          address.district,
          address.street,
          address.house_number,
          address.corpus,
          address.normalized_key,
        ].filter(Boolean).join(" ").toLocaleLowerCase();
        return !query || haystack.includes(query);
      });

      target.innerHTML = rows.length
        ? rows.map((item) => {
            const address = item.address || {};
            const active = address.id === state.selectedAddressId ? " active" : "";
            return '<button class="address-row' + active + '" data-address-id="' +
              escapeHtml(address.id) + '"><div class="address-row-title">' +
              escapeHtml(addressLabel(address) || address.normalized_key || address.id) +
              '</div><div class="address-row-meta">' +
              escapeHtml(translateFreshness(item.freshness_state)) + ' · ' +
              escapeHtml(item.provider_count ?? 0) + ' провайдер · ' +
              escapeHtml((item.technologies || []).join(", ") || "технології не вказані") +
              '</div></button>';
          }).join("")
        : '<div class="empty">Немає адрес, що відповідають фільтру.</div>';

      target.querySelectorAll("[data-address-id]").forEach((button) => {
        button.addEventListener("click", () => {
          openAddressWorkspace(button.dataset.addressId).catch((error) => {
            document.getElementById("address-workspace").innerHTML =
              '<div class="empty">Не вдалося відкрити адресу: ' +
              escapeHtml(error instanceof Error ? error.message : "невідома помилка") +
              '</div>';
          });
        });
      });
    }

    function qualityLabel(flag) {
      return {
        geometry_missing: "немає координат",
        coverage_missing: "немає покриття",
        coverage_stale: "покриття застаріле",
        geo_provenance_missing: "немає geo provenance",
      }[String(flag)] || String(flag);
    }

    function renderOperatorWorkspace(workspace) {
      const address = workspace.address || {};
      const coverage = workspace.coverage || {};
      const map = workspace.map || {};
      const providers = Array.isArray(coverage.providers) ? coverage.providers : [];
      const flags = Array.isArray(workspace.data_quality?.flags)
        ? workspace.data_quality.flags
        : [];
      const coverageEvidence = Array.isArray(workspace.evidence?.coverage)
        ? workspace.evidence.coverage
        : [];
      const geo = workspace.evidence?.geo || null;

      const providersHtml = providers.length
        ? providers.map((provider) => {
            const availability = Array.isArray(provider.availability)
              ? provider.availability
              : [];
            const tech = availability
              .map((entry) => String(entry.technology || "невідомо").toUpperCase())
              .join(", ");
            const claims = availability
              .map((entry) => shortId(entry.supporting_claim_id))
              .join(", ");
            return '<div class="item"><div class="row"><div><div class="item-title">' +
              escapeHtml(provider.display_name || provider.slug || provider.provider_id) +
              '</div><div class="item-meta">' +
              escapeHtml(tech || "технологія невідома") + ' · ' +
              escapeHtml(availability.map((entry) => translateAvailability(entry.availability_state)).join(", ")) +
              '</div></div><span class="pill">' +
              escapeHtml(claims || "claim недоступний") +
              '</span></div></div>';
          }).join("")
        : '<div class="empty">Збережених provider availability rows немає.</div>';

      const evidenceHtml = coverageEvidence.length
        ? coverageEvidence.map((entry) =>
            '<div class="item"><div class="item-title">' +
            escapeHtml(entry.source?.name || "Джерело") +
            '</div><div class="item-meta">claim ' +
            escapeHtml(shortId(entry.claim?.id)) + ' · observation ' +
            escapeHtml(shortId(entry.observation?.id)) + ' · snapshot ' +
            escapeHtml(shortId(entry.snapshot?.id)) + ' · ' +
            escapeHtml(formatTime(entry.claim?.observed_at)) +
            '</div></div>'
          ).join("")
        : '<div class="empty">Coverage evidence trail недоступний.</div>';

      const geoHtml = geo
        ? '<div class="item"><div class="item-title">' +
          escapeHtml(geo.source?.name || "Geo source") +
          '</div><div class="item-meta">claim ' +
          escapeHtml(shortId(geo.claim?.id)) + ' · observation ' +
          escapeHtml(shortId(geo.observation?.id)) + ' · snapshot ' +
          escapeHtml(shortId(geo.snapshot?.id)) + ' · ' +
          escapeHtml(formatTime(geo.claim?.observed_at)) +
          '</div></div>'
        : '<div class="empty">Geo provenance не знайдено.</div>';

      const mapAction = map.geometry_state === "present"
        ? '<button class="secondary" id="operator-open-map">Показати на карті</button>'
        : '';

      document.getElementById("address-workspace").innerHTML =
        '<div class="operator-heading"><div><div class="label">Робоче місце оператора</div>' +
        '<div class="operator-title">' +
        escapeHtml(addressLabel(address) || address.normalized_key || address.id) +
        '</div><div class="operator-subtitle">address ' +
        escapeHtml(shortId(address.id)) + ' · ' +
        escapeHtml(address.district || "район не вказано") +
        '</div></div>' + mapAction + '</div>' +
        '<div class="operator-kpis">' +
        '<div class="operator-kpi"><div class="label">Провайдери</div><strong>' +
        escapeHtml(coverage.provider_count ?? 0) + '</strong></div>' +
        '<div class="operator-kpi"><div class="label">Availability</div><strong>' +
        escapeHtml(coverage.availability_count ?? 0) + '</strong></div>' +
        '<div class="operator-kpi"><div class="label">Свіжість</div><strong>' +
        escapeHtml(translateFreshness(coverage.freshness_state)) + '</strong></div>' +
        '<div class="operator-kpi"><div class="label">Координати</div><strong>' +
        escapeHtml(map.geometry_state === "present" ? "є" : "немає") +
        '</strong></div></div>' +
        '<div class="operator-grid">' +
        '<div class="operator-panel"><div class="label">Адреса і гео</div><div class="item-title">' +
        escapeHtml(address.normalized_key || "") +
        '</div><div class="item-meta">' +
        escapeHtml(map.latitude ?? "—") + ', ' + escapeHtml(map.longitude ?? "—") +
        '<br>Останнє coverage observation: ' +
        escapeHtml(formatTime(coverage.latest_observed_at)) +
        '</div></div>' +
        '<div class="operator-panel"><div class="label">Data quality</div><div class="quality-flags">' +
        (flags.length
          ? flags.map((flag) => '<span class="pill">' + escapeHtml(qualityLabel(flag)) + '</span>').join("")
          : '<span class="pill good">без відомих проблем</span>') +
        '</div></div>' +
        '<div class="operator-panel wide"><div class="label">Провайдери та технології</div><div class="list">' +
        providersHtml + '</div></div>' +
        '<div class="operator-panel"><div class="label">Coverage evidence</div><div class="list">' +
        evidenceHtml + '</div></div>' +
        '<div class="operator-panel"><div class="label">Geo provenance</div><div class="list">' +
        geoHtml + '</div></div>' +
        '<div class="operator-panel wide"><div class="label">Нотатки оператора</div>' +
        '<div class="empty">Placeholder VS16. Нотатки ще не зберігаються і не змінюють дані.</div></div>' +
        '</div>';

      const mapButton = document.getElementById("operator-open-map");
      if (mapButton) {
        mapButton.addEventListener("click", () => {
          activateTab("map-view");
          requestAnimationFrame(() => {
            ensureMap().then(() => {
              state.map?.flyTo({
                center: [Number(map.longitude), Number(map.latitude)],
                zoom: 16,
                essential: true,
              });
            });
          });
        });
      }
    }

    async function openAddressWorkspace(addressId) {
      if (!addressId) throw new Error("address_id_required");

      state.selectedAddressId = addressId;
      renderAddressInventory(
        document.getElementById("address-filter").value,
      );
      document.getElementById("address-workspace").innerHTML =
        '<div class="empty">Завантаження робочого місця…</div>';

      const response = await getJson(
        "/api/v1/operator/addresses/" + encodeURIComponent(addressId),
      );

      if (!response.ok) {
        throw new Error(response.body?.error || "operator_workspace_failed");
      }

      renderOperatorWorkspace(response.body);
    }

    document.getElementById("address-filter").addEventListener("input", (event) => {
      renderAddressInventory(event.target.value);
    });

    function renderEvidence(availability, interaction) {
      const first = availability?.[0] ?? null;
      const snapshot = interaction?.interaction?.snapshot_id ?? null;
      const observation = interaction?.interaction?.observation_id ?? null;
      const claim = first?.supporting_claim_id ?? null;
      const projection = first?.projection_version ?? null;
      state.evidence = { snapshot, observation, claim, projection };

      document.getElementById("evidence-trail").innerHTML =
        '<div class="trail-step"><div class="trail-num">01</div><div class="trail-name">Знімок</div><div class="trail-id">' + escapeHtml(snapshot || "збережено, ID тут недоступний") + '</div></div>' +
        '<div class="trail-step"><div class="trail-num">02</div><div class="trail-name">Спостереження</div><div class="trail-id">' + escapeHtml(observation || "збережено, ID тут недоступний") + '</div></div>' +
        '<div class="trail-step"><div class="trail-num">03</div><div class="trail-name">Твердження</div><div class="trail-id">' + escapeHtml(claim || "твердження немає") + '</div></div>' +
        '<div class="trail-step"><div class="trail-num">04</div><div class="trail-name">Проєкція</div><div class="trail-id">' + escapeHtml(projection || "проєкції немає") + '</div></div>';
    }

    function optionalNumberParam(params, name) {
      const raw = params.get(name);
      if (raw === null || raw.trim() === "") return null;

      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    }

    const MAP_STATE_VERSION = "2";

    function mapInitialState() {
      const params = new URL(window.location.href).searchParams;
      const hasCurrentMapState =
        params.get("map_v") === MAP_STATE_VERSION;
      const lng = hasCurrentMapState
        ? optionalNumberParam(params, "lng")
        : null;
      const lat = hasCurrentMapState
        ? optionalNumberParam(params, "lat")
        : null;
      const zoom = hasCurrentMapState
        ? optionalNumberParam(params, "z")
        : null;

      return {
        center: [
          lng ?? 30.340224,
          lat ?? 50.47843,
        ],
        zoom:
          zoom === null
            ? 13.5
            : Math.min(Math.max(zoom, 3), 18),
      };
    }

    function persistMapState() {
      if (!state.map) return;
      const center = state.map.getCenter();
      const url = new URL(window.location.href);
      url.searchParams.set("map_v", MAP_STATE_VERSION);
      url.searchParams.set("lng", center.lng.toFixed(5));
      url.searchParams.set("lat", center.lat.toFixed(5));
      url.searchParams.set("z", state.map.getZoom().toFixed(2));
      url.searchParams.set("level", state.mapLevel);
      history.replaceState(null, "", url);
    }

    function emptyFeatureCollection() {
      return { type: "FeatureCollection", features: [] };
    }

    function setMapLayerVisibility(level) {
      if (!state.mapReady || !state.map) return;
      state.map.setLayoutProperty(
        "netco-h3-fill",
        "visibility",
        level === "zones" ? "visible" : "none",
      );
      state.map.setLayoutProperty(
        "netco-h3-outline",
        "visibility",
        level === "zones" ? "visible" : "none",
      );
      state.map.setLayoutProperty(
        "netco-buildings",
        "visibility",
        level === "buildings" ? "visible" : "none",
      );
    }

    function updateMapLevelControls() {
      document.querySelectorAll("[data-map-level]").forEach((button) => {
        button.classList.toggle(
          "active",
          button.dataset.mapLevel === state.mapLevel,
        );
      });
    }

    async function setMapLevel(level) {
      if (level !== "zones" && level !== "buildings") return;
      if (state.mapLevel === level) return;

      state.mapLevel = level;
      state.selectedCell = null;
      state.selectedAddress = null;
      updateMapLevelControls();
      closeMapDrawer();
      setMapLayerVisibility(level);
      persistMapState();
      await refreshMapData();
    }

    async function refreshMapData() {
      if (!state.mapReady || !state.map) return;

      const bounds = state.map.getBounds();
      const viewport = {
        west: String(bounds.getWest()),
        south: String(bounds.getSouth()),
        east: String(bounds.getEast()),
        north: String(bounds.getNorth()),
      };

      if (state.mapLevel === "buildings") {
        const params = new URLSearchParams({
          geometry: "present",
          ...viewport,
        });
        const response = await getJson(
          "/api/v1/geo/coverage-points?" + params.toString(),
        );

        if (!response.ok) {
          throw new Error(
            response.body?.error || "coverage_points_query_failed",
          );
        }

        const buildings = response.body;
        state.map.getSource("netco-buildings")?.setData(buildings);
        state.map.getSource("netco-h3")?.setData(emptyFeatureCollection());
        setMapLayerVisibility("buildings");

        const count = Number(buildings?.count ?? 0);
        document.getElementById("map-cell-count").textContent =
          String(count) + " " +
          ukPlural(count, "будинок", "будинки", "будинків");
        return;
      }

      const params = new URLSearchParams({
        resolution: "9",
        ...viewport,
      });
      const response = await getJson(
        "/api/v1/geo/h3-cells?" + params.toString(),
      );

      if (!response.ok) {
        throw new Error(response.body?.error || "h3_query_failed");
      }

      const cells = response.body;
      state.map.getSource("netco-h3")?.setData(cells);
      state.map.getSource("netco-buildings")?.setData(emptyFeatureCollection());
      setMapLayerVisibility("zones");

      const count = Number(cells?.count ?? 0);
      document.getElementById("map-cell-count").textContent =
        String(count) + " " +
        ukPlural(count, "комірка", "комірки", "комірок");
    }

    function mapTechnologies(value) {
      if (Array.isArray(value)) return value;
      if (typeof value !== "string") return [];

      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function structuredAddressParams(address) {
      const params = new URLSearchParams({
        country_code: address.country_code,
        city: address.city,
        street: address.street,
        house_number: address.house_number,
      });

      for (const key of [
        "region",
        "district",
        "corpus",
        "building_letter",
        "postal_code",
      ]) {
        if (address[key]) params.set(key, address[key]);
      }

      return params;
    }

    function openMapDrawer(kicker, title) {
      const drawer = document.getElementById("map-drawer");
      document.getElementById("map-drawer-kicker").textContent = kicker;
      document.getElementById("map-drawer-title").textContent = title;
      drawer.classList.add("open");
      drawer.setAttribute("aria-hidden", "false");
    }

    function closeMapDrawer() {
      const drawer = document.getElementById("map-drawer");
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      state.selectedCell = null;
      state.selectedAddress = null;
    }

    function renderCellSummary(properties, detailHtml = "") {
      const technologies = mapTechnologies(properties.technologies);
      const h3Index = properties.h3_index || "невідомо";
      openMapDrawer("Зона H3", String(h3Index));

      document.getElementById("map-drawer-body").innerHTML =
        '<div class="map-stats">' +
        '<div class="map-stat"><div class="label">Адреси</div><strong>' +
        escapeHtml(properties.address_count ?? 0) +
        '</strong></div>' +
        '<div class="map-stat"><div class="label">Провайдери</div><strong>' +
        escapeHtml(properties.provider_count ?? 0) +
        '</strong></div>' +
        '<div class="map-stat"><div class="label">Записи доступності</div><strong>' +
        escapeHtml(properties.availability_count ?? 0) +
        '</strong></div>' +
        '<div class="map-stat"><div class="label">Технології</div><strong>' +
        escapeHtml(technologies.join(", ") || "немає") +
        '</strong></div>' +
        '</div>' +
        detailHtml;
    }

    async function inspectMapCell(properties) {
      const h3Index = String(properties.h3_index || "");
      renderCellSummary(
        properties,
        '<div class="map-detail"><div class="empty">Завантаження збережених адрес…</div></div>',
      );

      const response = await getJson(
        "/api/v1/geo/h3-cells/" + encodeURIComponent(h3Index),
      );

      if (!response.ok) {
        renderCellSummary(
          properties,
          '<div class="map-detail"><div class="empty">Не вдалося завантажити дані комірки: ' +
            escapeHtml(response.body?.error || "невідома_помилка") +
            '</div></div>',
        );
        return;
      }

      state.selectedCell = response.body;
      state.selectedAddress = null;
      const addresses = Array.isArray(response.body?.addresses)
        ? response.body.addresses
        : [];

      const addressRows = addresses.length
        ? addresses.map((item, index) => {
            const address = item.address || {};
            const label = [
              address.city,
              address.street,
              address.house_number,
            ].filter(Boolean).join(", ");

            return '<div class="map-address"><div><div class="map-address-title">' +
              escapeHtml(label || item.normalized_key || item.address_id) +
              '</div><div class="map-address-meta">' +
              escapeHtml(translateFreshness(item.freshness_state)) + ' · ' +
              escapeHtml(item.provider_count ?? 0) + ' провайдер · ' +
              escapeHtml(item.availability_count ?? 0) + ' записів доступності · ' +
              escapeHtml((item.technologies || []).join(", ") || "технології не вказані") +
              '</div></div><div class="row-actions"><button class="secondary" data-map-address-index="' +
              index + '">Докази</button><button class="secondary" data-open-address-id="' +
              escapeHtml(item.address_id) + '">Робоче місце</button></div></div>';
          }).join("")
        : '<div class="empty">У цій комірці немає збережених адрес.</div>';

      renderCellSummary(
        properties,
        '<div class="map-detail"><div><div class="label">Адреси в комірці</div>' +
          '<div class="map-addresses">' + addressRows + '</div></div>' +
          '<div id="map-address-detail" class="map-address-detail muted">Оберіть адресу, щоб переглянути покриття та походження даних.</div></div>',
      );

      document.querySelectorAll("[data-map-address-index]").forEach((button) => {
        button.addEventListener("click", () => {
          inspectMapAddress(Number(button.dataset.mapAddressIndex)).catch((error) => {
            document.getElementById("map-address-detail").innerHTML =
              '<div class="empty">Не вдалося перевірити адресу: ' +
              escapeHtml(error instanceof Error ? error.message : "невідома помилка") +
              '</div>';
          });
        });
      });

      document.querySelectorAll("[data-open-address-id]").forEach((button) => {
        button.addEventListener("click", () => {
          activateTab("addresses");
          openAddressWorkspace(button.dataset.openAddressId).catch((error) => {
            document.getElementById("address-workspace").innerHTML =
              '<div class="empty">Не вдалося відкрити адресу: ' +
              escapeHtml(error instanceof Error ? error.message : "невідома помилка") +
              '</div>';
          });
        });
      });
    }

    async function inspectMapAddress(index) {
      const item = state.selectedCell?.addresses?.[index];
      if (!item) throw new Error("address_not_found_in_selected_cell");

      state.selectedAddress = item;
      const address = item.address || {};
      const addressLabel = [address.city, address.street, address.house_number]
        .filter(Boolean)
        .join(", ");
      openMapDrawer(
        "Будинок",
        addressLabel || item.normalized_key || item.address_id,
      );
      const params = structuredAddressParams(address);
      const [coverage, provenance] = await Promise.all([
        getJson("/api/v1/coverage/address?" + params.toString()),
        getJson(
          "/api/v1/geo/addresses/" +
            encodeURIComponent(item.address_id) +
            "/provenance",
        ),
      ]);

      const providers = coverage.ok && Array.isArray(coverage.body?.providers)
        ? coverage.body.providers
        : [];

      const providerHtml = providers.length
        ? providers.map((provider) => {
            const availability = Array.isArray(provider.availability)
              ? provider.availability
              : [];
            const technologyLabels = availability
              .map((entry) => String(entry.technology || "невідомо").toUpperCase())
              .join(", ");

            return '<div class="item"><div class="item-title">' +
              escapeHtml(provider.display_name || provider.slug || provider.provider_id) +
              '</div><div class="item-meta">' +
              escapeHtml(technologyLabels || "технологія невідома") +
              ' · збережена проєкція покриття</div></div>';
          }).join("")
        : '<div class="empty">Для цієї адреси немає збережених даних про покриття провайдерів.</div>';

      const source = provenance.ok ? provenance.body?.source : null;
      const claim = provenance.ok ? provenance.body?.claim : null;

      document.getElementById("map-address-detail").innerHTML =
        '<div class="label">Докази для адреси</div>' +
        '<div class="item-title">' +
        escapeHtml([address.city, address.street, address.house_number].filter(Boolean).join(", ")) +
        '</div><div class="item-meta">address ' +
        escapeHtml(shortId(item.address_id)) +
        ' · геоджерело ' +
        escapeHtml(source?.name || "недоступно") +
        ' · спостережено ' +
        escapeHtml(formatTime(claim?.observed_at)) +
        '</div><div class="list">' + providerHtml + '</div>';
    }

    function buildingFeatureToAddress(feature) {
      const properties = feature.properties || {};
      const coordinates = feature.geometry?.coordinates || [];

      return {
        address_id: properties.address_id,
        normalized_key: properties.normalized_key,
        address: {
          country_code: properties.country_code,
          region: properties.region || null,
          city: properties.city,
          district: properties.district || null,
          street: properties.street,
          house_number: properties.house_number,
          corpus: properties.corpus || null,
          building_letter: properties.building_letter || null,
          postal_code: properties.postal_code || null,
        },
        point: {
          longitude: coordinates[0],
          latitude: coordinates[1],
        },
        freshness_state: properties.freshness_state,
        provider_count: Number(properties.provider_count || 0),
        availability_count: Number(properties.availability_count || 0),
        technologies: mapTechnologies(properties.technologies),
        latest_observed_at: properties.latest_observed_at,
      };
    }

    async function inspectMapBuilding(feature) {
      const item = buildingFeatureToAddress(feature);
      state.selectedCell = { addresses: [item] };
      state.selectedAddress = item;

      const address = item.address || {};
      const label = [
        address.city,
        address.street,
        address.house_number,
      ].filter(Boolean).join(", ");

      openMapDrawer(
        "Будинок",
        label || item.normalized_key || item.address_id,
      );
      document.getElementById("map-drawer-body").innerHTML =
        '<div id="map-address-detail" class="map-address-detail muted">' +
        'Завантаження покриття та доказів…</div>';

      await inspectMapAddress(0);
    }

    async function ensureMap() {
      if (state.map) {
        state.map.resize();
        if (state.mapReady) {
          await refreshMapData();
        }
        return;
      }

      const maplibregl = await import(
        "https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs"
      );
      state.maplibregl = maplibregl;

      const initial = mapInitialState();
      const requestedLevel =
        new URL(window.location.href).searchParams.get("level");
      state.mapLevel =
        requestedLevel === "buildings" ? "buildings" : "zones";
      updateMapLevelControls();

      const map = new maplibregl.Map({
        container: "map",
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: initial.center,
        zoom: initial.zoom,
        attributionControl: false,
      });
      state.map = map;

      map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        "top-right",
      );
      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution:
            '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> · <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>',
        }),
        "bottom-right",
      );

      map.on("load", async () => {
        map.addSource("netco-h3", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        map.addLayer({
          id: "netco-h3-fill",
          type: "fill",
          source: "netco-h3",
          paint: {
            "fill-color": "#35b982",
            "fill-opacity": [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "address_count"], 1],
              1,
              0.3,
              10,
              0.7,
            ],
          },
        });

        map.addLayer({
          id: "netco-h3-outline",
          type: "line",
          source: "netco-h3",
          paint: {
            "line-color": "#d9fff0",
            "line-width": 2,
            "line-opacity": 0.9,
          },
        });

        map.addSource("netco-buildings", {
          type: "geojson",
          data: emptyFeatureCollection(),
        });

        map.addLayer({
          id: "netco-buildings",
          type: "circle",
          source: "netco-buildings",
          layout: { visibility: "none" },
          paint: {
            "circle-radius": 7,
            "circle-color": [
              "match",
              ["get", "freshness_state"],
              "fresh",
              "#54d59d",
              "#f2c96d",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#eef4fb",
            "circle-opacity": 0.9,
          },
        });

        map.on("click", "netco-h3-fill", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;

          inspectMapCell(feature.properties || {}).catch((error) => {
            openMapDrawer("Зона H3", "Помилка");
            document.getElementById("map-drawer-body").innerHTML =
              '<div class="map-empty">Не вдалося відкрити комірку: ' +
              escapeHtml(error instanceof Error ? error.message : "невідома помилка") +
              '</div>';
          });
        });

        map.on("click", "netco-buildings", (event) => {
          const feature = event.features?.[0];
          if (!feature) return;

          inspectMapBuilding(feature).catch((error) => {
            openMapDrawer("Будинок", "Помилка");
            document.getElementById("map-drawer-body").innerHTML =
              '<div class="map-empty">Не вдалося відкрити будинок: ' +
              escapeHtml(
                error instanceof Error
                  ? error.message
                  : "невідома помилка",
              ) +
              '</div>';
          });
        });

        map.on("mouseenter", "netco-h3-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", "netco-h3-fill", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("mouseenter", "netco-buildings", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "netco-buildings", () => {
          map.getCanvas().style.cursor = "";
        });

        map.on("click", (event) => {
          const layers =
            state.mapLevel === "buildings"
              ? ["netco-buildings"]
              : ["netco-h3-fill"];
          const hits = map.queryRenderedFeatures(event.point, { layers });
          if (hits.length === 0) closeMapDrawer();
        });

        state.mapReady = true;
        setMapLayerVisibility(state.mapLevel);
        await refreshMapData();
      });

      document.getElementById("map-reset-kyiv").addEventListener("click", () => {
        map.flyTo({
          center: [30.340224, 50.47843],
          zoom: 13.5,
          essential: true,
        });
      });

      document
        .getElementById("map-drawer-close")
        .addEventListener("click", closeMapDrawer);

      document.querySelectorAll("[data-map-level]").forEach((button) => {
        if (button.disabled) return;
        button.addEventListener("click", () => {
          setMapLevel(button.dataset.mapLevel).catch((error) => {
            document.getElementById("map-cell-count").textContent =
              "помилка запиту";
            console.error("netco_map_level_failed", error);
          });
        });
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMapDrawer();
      });

      map.on("moveend", () => {
        persistMapState();
        refreshMapData().catch((error) => {
          document.getElementById("map-cell-count").textContent =
            "помилка запиту";
          console.error("netco_map_refresh_failed", error);
        });
      });
    }

    async function lookupAddress() {
      const country = document.getElementById("country").value.trim();
      const city = document.getElementById("city").value.trim();
      const street = document.getElementById("street").value.trim();
      const house = document.getElementById("house").value.trim();
      const results = document.getElementById("results");

      if (!country || !city || !street || !house) {
        results.innerHTML = '<div class="empty">Заповни код країни, місто, вулицю та номер будинку.</div>';
        return;
      }

      results.innerHTML = '<div class="empty">Читаю збережені проєкції…</div>';

      const params = new URLSearchParams({
        country_code: country,
        city,
        street,
        house_number: house,
      });

      const response = await getJson(
        "/api/v1/coverage/address?" + params.toString(),
      );

      if (!response.ok) {
        results.innerHTML =
          '<div class="provider-result"><div class="provider-title">Не вдалося прочитати покриття</div><div class="muted">' +
          escapeHtml(response.body?.error || "невідома_помилка") +
          '</div></div>';
        renderEvidence([], null);
        return;
      }

      const providers = Array.isArray(response.body?.providers)
        ? response.body.providers
        : [];

      if (!providers.length) {
        results.innerHTML =
          '<div class="provider-result"><div class="provider-title">Збережених доказів покриття немає</div><div class="muted">Це означає "Netco ще не знає", а не "підключення недоступне".</div></div>';
        renderEvidence([], null);
        return;
      }

      const address = response.body?.address;
      results.innerHTML = providers.map((provider) => {
        const availability = Array.isArray(provider.availability)
          ? provider.availability
          : [];

        return '<div class="provider-result"><div class="row"><div><div class="provider-title">' +
          escapeHtml(provider.display_name || provider.slug || provider.provider_id) +
          '</div><div class="muted">' +
          escapeHtml(address?.city || city) + ', ' +
          escapeHtml(address?.street || street) + ' ' +
          escapeHtml(address?.house_number || house) +
          '</div></div><span class="pill good">збережені докази</span></div>' +
          '<div class="techs">' +
          availability.map((item) =>
            '<span class="tech"><strong>' +
            escapeHtml(String(item.technology || "невідомо").toUpperCase()) +
            '</strong> · ' + escapeHtml(translateAvailability(item.availability_state)) +
            '<br><span class="muted">' +
            escapeHtml(formatTime(item.observed_at)) +
            '</span></span>'
          ).join("") +
          '</div><div class="item-meta" style="margin-top:12px">claim ' +
          escapeHtml(shortId(availability[0]?.supporting_claim_id)) +
          ' · актуально до ' +
          escapeHtml(formatTime(availability[0]?.fresh_until)) +
          '</div></div>';
      }).join("");

      const firstKnown = providers[0];
      let interaction = null;
      if (firstKnown?.slug) {
        const interactionResponse = await getJson(
          "/api/v1/coverage/" +
            encodeURIComponent(firstKnown.slug) +
            "/checker-interaction",
        );
        if (interactionResponse.ok) interaction = interactionResponse.body;
      }

      renderEvidence(firstKnown?.availability ?? [], interaction);
    }

    document.getElementById("lookup").addEventListener("click", lookupAddress);
    document.getElementById("demo-address").addEventListener("click", () => {
      document.getElementById("country").value = "UA";
      document.getElementById("city").value = "Київ";
      document.getElementById("street").value = "Клавдіївська";
      document.getElementById("house").value = "40А";
      lookupAddress();
    });

    loadDashboard().catch((error) => {
      document.getElementById("metric-system").textContent = "Помилка";
      document.getElementById("metric-system-note").textContent = error instanceof Error ? error.message : "не вдалося завантажити панель";
    });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; connect-src 'self' https://unpkg.com https://tiles.openfreemap.org; img-src 'self' data: blob: https://tiles.openfreemap.org; worker-src blob: https://unpkg.com; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
