import json
import os

def process_workflow(json_path):
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    nodes = data.get('nodes', [])
    connections = data.get('connections', {})

    clean_nodes = []
    sticky_notes = []

    for n in nodes:
        node_type = n.get('type', '')
        pos = n.get('position', [0, 0])
        params = n.get('parameters', {})
        name = n.get('name', 'Node')
        node_id = n.get('id', '')

        if 'stickyNote' in node_type:
            content = params.get('content', '')
            width = params.get('width', 300)
            height = params.get('height', 200)
            color = params.get('color', 1)
            sticky_notes.append({
                'id': node_id,
                'name': name,
                'x': pos[0],
                'y': pos[1],
                'width': width,
                'height': height,
                'color': color,
                'content': content
            })
        else:
            cat = 'utility'
            icon = '⚙️'
            color = '#85253C'
            
            if 'webhook' in node_type.lower() or 'trigger' in node_type.lower() or 'form' in node_type.lower() or 'readwrite' in node_type.lower():
                cat = 'trigger'
                icon = '⚡'
                color = '#008D9E'
            elif 'postgres' in node_type.lower() or 'pinecone' in node_type.lower() or 'neo4j' in node_type.lower():
                cat = 'database'
                icon = '🐘'
                color = '#336791'
            elif 'agent' in node_type.lower() or 'llm' in node_type.lower() or 'gemini' in node_type.lower() or 'ollama' in node_type.lower() or 'chain' in node_type.lower():
                cat = 'ai'
                icon = '🤖'
                color = '#B8933A'
            elif 'code' in node_type.lower() or 'set' in node_type.lower() or 'movebinary' in node_type.lower() or 'parser' in node_type.lower():
                cat = 'transform'
                icon = '💻'
                color = '#85253C'
            elif 'if' in node_type.lower() or 'switch' in node_type.lower() or 'merge' in node_type.lower() or 'respond' in node_type.lower():
                cat = 'logic'
                icon = '🔀'
                color = '#15803D'

            clean_nodes.append({
                'id': node_id,
                'name': name,
                'type': node_type.replace('n8n-nodes-base.', '').replace('@n8n/n8n-nodes-langchain.', ''),
                'raw_type': node_type,
                'x': pos[0],
                'y': pos[1],
                'cat': cat,
                'icon': icon,
                'color': color,
                'parameters': params
            })

    clean_connections = []
    node_map = {n['name']: n for n in clean_nodes}

    for src_name, conn_data in connections.items():
        main_outputs = conn_data.get('main', [])
        for out_idx, target_list in enumerate(main_outputs):
            for tgt in target_list:
                tgt_name = tgt.get('node')
                if src_name in node_map and tgt_name in node_map:
                    clean_connections.append({
                        'from': src_name,
                        'to': tgt_name,
                        'from_id': node_map[src_name]['id'],
                        'to_id': node_map[tgt_name]['id'],
                        'output_index': out_idx
                    })

    return clean_nodes, sticky_notes, clean_connections

def generate_n8n_html():
    master_json = r'c:\Users\rubbe\Documents\ALCheMy\n8n_workflows\ALCheMy_master_v2.json'
    rag_json = r'c:\Users\rubbe\Documents\ALCheMy\n8n_workflows\ALCheMy-RAG.json'
    out_html = r'c:\Users\rubbe\Documents\ALCheMy\design_system\preview_n8n_canvas.html'

    m_nodes, m_sticky, m_conns = process_workflow(master_json)
    r_nodes, r_sticky, r_conns = process_workflow(rag_json)

    workflows = {
        "master": {
            "name": "ALCheMy Master Pipeline (Ingesta & Quality Gate)",
            "nodes": m_nodes,
            "sticky": m_sticky,
            "conns": m_conns,
            "tour": [
                {
                    "id": "overview",
                    "title": "🌐 Vista Global",
                    "x": 4800,
                    "y": 800,
                    "zoom": 0.16,
                    "desc": "El flujo integral de ALCheMy orquesta la ingesta de espectros y síntesis, validación por Hash MD5, parsers de 4 técnicas y razonamiento multi-agente."
                },
                {
                    "id": "ingestion",
                    "title": "⚡ 1. Ingesta (3 Vías)",
                    "x": 300,
                    "y": 1950,
                    "zoom": 0.65,
                    "desc": "Captación simultánea desde 3 fuentes: Webhooks de instrumentos analíticos, portal web de laboratorio (Form Trigger) y monitorización automática de carpetas locales."
                },
                {
                    "id": "governance",
                    "title": "🛡️ 2. Seguridad & MD5",
                    "x": 1600,
                    "y": 1950,
                    "zoom": 0.65,
                    "desc": "Verificación de lista blanca de usuarios y cálculo criptográfico de Hash MD5 para evitar duplicados en base de datos y proteger de costes fantasma."
                },
                {
                    "id": "parsers",
                    "title": "🔬 3. Quality Gate",
                    "x": 3400,
                    "y": 1800,
                    "zoom": 0.60,
                    "desc": "Extracción polimórfica de espectros (PXRD, TGA, Isotermas BET, FTIR) hacia esquemas JSONB con validación de consistencia física y enrutado de errores."
                },
                {
                    "id": "database",
                    "title": "🐘 4. PostgreSQL & Auditoría",
                    "x": 5800,
                    "y": 1750,
                    "zoom": 0.60,
                    "desc": "Inserción atómica (UPSERT) en PostgreSQL con linaje reproducible ISO 17025, registro en audit_log y desacoplamiento de series temporales."
                },
                {
                    "id": "ai_agent",
                    "title": "🤖 5. Agentes & RAG",
                    "x": 2200,
                    "y": 200,
                    "zoom": 0.55,
                    "desc": "Razonamiento multi-agente con Gemini y Ollama, consulta vectorial a pgvector con 956 papers y enmascaramiento de propiedad intelectual."
                }
            ]
        },
        "rag": {
            "name": "ALCheMy-RAG (Corpus & Chatbot Inteligente)",
            "nodes": r_nodes,
            "sticky": r_sticky,
            "conns": r_conns,
            "tour": [
                {
                    "id": "overview",
                    "title": "🌐 Vista Global RAG",
                    "x": 1200,
                    "y": 400,
                    "zoom": 0.35,
                    "desc": "Pipeline especializado de RAG: ingesta de corpus público/interno, troceo contextual, embeddings y agente conversacional con control de acceso."
                },
                {
                    "id": "corpus",
                    "title": "📚 1. Lectura de Corpus",
                    "x": -1000,
                    "y": 50,
                    "zoom": 0.70,
                    "desc": "Lectura separada de PDFs públicos e internos, asignación de metadatos de confidencialidad y control de fuentes."
                },
                {
                    "id": "agent",
                    "title": "🤖 2. Agente & Herramientas",
                    "x": 1500,
                    "y": 300,
                    "zoom": 0.65,
                    "desc": "Agente autónomo con herramientas SQL directas, búsqueda híbrida vectorial y validación estricta de permisos de llamada."
                }
            ]
        }
    }

    html_content = f'''<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ALCheMy — n8n Interactive Workflow Canvas</title>
  <!-- Google Fonts: Art Déco Tesis + Inter + JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Marcellus&family=Poiret+One&display=swap" rel="stylesheet">
  
  <!-- Marked.js for High-Quality Markdown Parsing in Sticky Notes -->
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

  <style>
    /* ==========================================================================
       TEMA OFICIAL EDITORIAL CHAMPÁN (LIGHT MODE ALTA LEGIBILIDAD)
       ========================================================================== */
    :root {{
      --bg-canvas: #F5EFE4;
      --canvas-dots: rgba(133, 37, 60, 0.12);
      --surface-card: #FFFFFF;
      --surface-elevated: #FAF6EE;
      --surface-border: rgba(180, 140, 120, 0.55);
      --surface-border-strong: #85253C;
      
      --text-primary: #3B0B15;
      --text-secondary: #57333B;
      --text-muted: #8C686F;
      
      --accent-primary: #85253C;
      --accent-gold: #B8933A;
      --accent-teal: #00606B;
      --status-pure: #15803D;
      
      --card-shadow: 4px 4px 0px rgba(133, 37, 60, 0.2);
      --card-shadow-hover: 6px 6px 0px #85253C;
      
      --font-display: 'Poiret One', cursive, sans-serif;
      --font-heading: 'Marcellus', serif;
      --font-body: 'Inter', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }}

    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}

    body {{
      background-color: var(--bg-canvas);
      color: var(--text-primary);
      font-family: var(--font-body);
      overflow: hidden;
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }}

    /* HEADER & NAVIGATION BAR */
    header {{
      background: #FFFFFF;
      border-bottom: 2.5px solid var(--surface-border-strong);
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
      box-shadow: 0 4px 15px rgba(77, 18, 32, 0.08);
    }}

    .brand-title {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}

    .brand-title h1 {{
      font-family: var(--font-display);
      font-size: 1.5rem;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--text-primary);
      font-weight: 700;
    }}

    .select-workflow {{
      background: var(--surface-elevated);
      color: var(--text-primary);
      border: 2px solid var(--surface-border);
      padding: 5px 10px;
      border-radius: 6px;
      font-family: var(--font-heading);
      font-size: 0.85rem;
      font-weight: 700;
      cursor: pointer;
      outline: none;
    }}

    .select-workflow:hover {{
      border-color: var(--accent-primary);
    }}

    /* TOUR CONTROLS */
    .tour-nav {{
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }}

    .tour-btn {{
      background: var(--surface-elevated);
      color: var(--text-secondary);
      border: 1.5px solid var(--surface-border);
      padding: 5px 12px;
      border-radius: 6px;
      font-family: var(--font-heading);
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
    }}

    .tour-btn:hover, .tour-btn.active {{
      background: var(--accent-primary);
      color: #FFFFFF;
      border-color: var(--accent-primary);
      box-shadow: 3px 3px 0px var(--text-primary);
      transform: translateY(-1px);
    }}

    /* ZOOM CONTROLS */
    .zoom-controls {{
      position: absolute;
      bottom: 24px;
      left: 24px;
      z-index: 50;
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: #FFFFFF;
      border: 2.5px solid var(--surface-border-strong);
      padding: 6px;
      border-radius: 8px;
      box-shadow: 4px 4px 0px var(--accent-primary);
    }}

    .zoom-btn {{
      background: var(--surface-elevated);
      color: var(--text-primary);
      border: 1.5px solid var(--surface-border);
      width: 36px;
      height: 36px;
      border-radius: 6px;
      font-size: 1.2rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }}

    .zoom-btn:hover {{
      background: var(--accent-primary);
      color: #FFFFFF;
      border-color: var(--accent-primary);
    }}

    /* CANVAS VIEWPORT */
    #viewport {{
      flex: 1;
      position: relative;
      overflow: hidden;
      cursor: grab;
      background-color: var(--bg-canvas);
      background-image: 
        linear-gradient(to right, var(--canvas-dots) 1px, transparent 1px),
        linear-gradient(to bottom, var(--canvas-dots) 1px, transparent 1px);
      background-size: 40px 40px;
    }}

    #viewport:active {{
      cursor: grabbing;
    }}

    #world {{
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      will-change: transform;
    }}

    /* STICKY NOTES CON MARKDOWN RENDERIZADO */
    .sticky-note {{
      position: absolute;
      border-radius: 10px;
      padding: 16px 20px;
      box-shadow: 4px 4px 15px rgba(77, 18, 32, 0.08);
      border: 2px dashed rgba(180, 140, 120, 0.7);
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(8px);
      overflow-y: auto;
      z-index: 2;
    }}

    .sticky-note h1, .sticky-note h2, .sticky-note h3 {{
      font-family: var(--font-heading);
      color: var(--accent-primary);
      margin-bottom: 8px;
      font-size: 1.15rem;
      font-weight: 700;
      border-bottom: 1px dashed var(--surface-border);
      padding-bottom: 4px;
    }}

    .sticky-note p, .sticky-note li {{
      font-size: 0.85rem;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-bottom: 6px;
    }}

    .sticky-note ul, .sticky-note ol {{
      margin-left: 18px;
      margin-bottom: 8px;
    }}

    .sticky-note strong {{
      color: var(--text-primary);
      font-weight: 700;
    }}

    .sticky-note code {{
      font-family: var(--font-mono);
      background: var(--surface-elevated);
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 0.78rem;
      color: var(--accent-primary);
      border: 1px solid var(--surface-border);
    }}

    /* NODES */
    .n8n-node {{
      position: absolute;
      width: 230px;
      min-height: 76px;
      background: #FFFFFF;
      border: 2.5px solid var(--surface-border);
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      box-shadow: var(--card-shadow);
      transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
      z-index: 10;
    }}

    .n8n-node:hover, .n8n-node.selected {{
      border-color: var(--accent-primary);
      box-shadow: var(--card-shadow-hover);
      transform: translateY(-2px) scale(1.03);
      z-index: 20;
    }}

    .node-icon-box {{
      width: 44px;
      height: 44px;
      border-radius: 6px;
      background: var(--surface-elevated);
      border: 2px solid var(--surface-border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      flex-shrink: 0;
    }}

    .node-info {{
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }}

    .node-name {{
      font-family: var(--font-heading);
      font-weight: 700;
      font-size: 0.88rem;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }}

    .node-type-label {{
      font-family: var(--font-mono);
      font-size: 0.7rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}

    /* SVG CONNECTIONS */
    #connections-svg {{
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 5;
    }}

    .connection-line {{
      fill: none;
      stroke: rgba(133, 37, 60, 0.45);
      stroke-width: 2.5px;
      stroke-dasharray: 6 3;
      animation: dash 30s linear infinite;
    }}

    .connection-line.highlighted {{
      stroke: var(--accent-primary);
      stroke-width: 4px;
      stroke-dasharray: none;
    }}

    @keyframes dash {{
      to {{
        stroke-dashoffset: -1000;
      }}
    }}

    /* SIDEBAR INFO DRAWER */
    #info-panel {{
      position: absolute;
      top: 20px;
      right: 20px;
      width: 380px;
      max-height: calc(100vh - 120px);
      background: #FFFFFF;
      border: 2.5px solid var(--surface-border-strong);
      border-radius: 8px;
      padding: 20px;
      z-index: 60;
      box-shadow: 6px 6px 0px var(--accent-primary);
      overflow-y: auto;
      display: none;
    }}

    #info-panel.visible {{
      display: block;
      animation: slideIn 0.25s ease-out;
    }}

    @keyframes slideIn {{
      from {{ transform: translateX(40px); opacity: 0; }}
      to {{ transform: translateX(0); opacity: 1; }}
    }}

    .panel-header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
      border-bottom: 1.5px solid var(--surface-border);
      padding-bottom: 10px;
    }}

    .panel-title {{
      font-family: var(--font-heading);
      font-size: 1.25rem;
      color: var(--accent-primary);
      font-weight: 700;
    }}

    .panel-close {{
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 1.4rem;
      cursor: pointer;
      line-height: 1;
    }}

    .panel-close:hover {{
      color: var(--accent-primary);
    }}

    .param-box {{
      background: var(--surface-elevated);
      border: 1.5px solid var(--surface-border);
      border-radius: 6px;
      padding: 12px;
      font-family: var(--font-mono);
      font-size: 0.78rem;
      color: var(--text-secondary);
      max-height: 260px;
      overflow-y: auto;
      margin-top: 10px;
    }}
  </style>
</head>
<body>

  <!-- TOP BAR & GUIDED TOUR -->
  <header>
    <div class="brand-title">
      <h1>⚗️ ALCheMy // n8n Workflow Explorer</h1>
      <select id="wf-select" class="select-workflow" onchange="switchWorkflow(this.value)">
        <option value="master">📦 Pipeline Maestro: Ingesta & Data Lake (105 Nodos)</option>
        <option value="rag">📚 Pipeline RAG: Corpus & Chatbot (34 Nodos)</option>
      </select>
    </div>

    <!-- TOUR STAGES CONTAINER -->
    <div class="tour-nav" id="tour-buttons-container"></div>
  </header>

  <!-- VIEWPORT -->
  <div id="viewport">
    <div id="world">
      <!-- SVG LINES -->
      <svg id="connections-svg"></svg>
      <!-- STICKY NOTES CONTAINER -->
      <div id="sticky-container"></div>
      <!-- NODES CONTAINER -->
      <div id="nodes-container"></div>
    </div>

    <!-- ZOOM BUTTONS -->
    <div class="zoom-controls">
      <button class="zoom-btn" onclick="zoomDelta(1.3)" title="Acercar">+</button>
      <button class="zoom-btn" onclick="zoomDelta(0.7)" title="Alejar">-</button>
      <button class="zoom-btn" onclick="fitView()" title="Centrar Todo">⛶</button>
    </div>

    <!-- INFO DRAWER -->
    <div id="info-panel">
      <div class="panel-header">
        <div>
          <div id="panel-node-title" class="panel-title">Node Title</div>
          <div id="panel-node-type" style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">Type</div>
        </div>
        <button class="panel-close" onclick="closePanel()">×</button>
      </div>
      <p id="panel-node-desc" style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;"></p>
      <div style="font-size: 0.78rem; font-family: var(--font-heading); color: var(--accent-primary); text-transform: uppercase; font-weight: 700;">Parámetros / Configuración del Nodo:</div>
      <pre id="panel-node-params" class="param-box"></pre>
    </div>
  </div>

  <script>
    const workflowsData = {json.dumps(workflows)};
    let currentWorkflowKey = "master";

    let scale = 0.25;
    let panX = 100;
    let panY = 100;
    let isDragging = false;
    let startX, startY;

    const viewport = document.getElementById('viewport');
    const world = document.getElementById('world');
    const svg = document.getElementById('connections-svg');
    const stickyContainer = document.getElementById('sticky-container');
    const nodesContainer = document.getElementById('nodes-container');
    const tourContainer = document.getElementById('tour-buttons-container');

    function renderWorkflow(wfKey) {{
      currentWorkflowKey = wfKey;
      const wf = workflowsData[wfKey];
      if (!wf) return;

      // Render tour buttons
      let tourHtml = '';
      wf.tour.forEach((s, idx) => {{
        tourHtml += `<button class="tour-btn ${{idx===0?'active':''}}" onclick="goToStage('${{s.id}}')">${{s.title}}</button>`;
      }});
      tourContainer.innerHTML = tourHtml;

      // Render sticky notes with Markdown
      let stickyHtml = '';
      wf.sticky.forEach(sn => {{
        const renderedMd = marked.parse(sn.content || '');
        stickyHtml += `<div class="sticky-note" style="left: ${{sn.x}}px; top: ${{sn.y}}px; width: ${{sn.width}}px; height: ${{sn.height}}px;">
          ${{renderedMd}}
        </div>`;
      }});
      stickyContainer.innerHTML = stickyHtml;

      // Render nodes
      let nodesHtml = '';
      wf.nodes.forEach(n => {{
        nodesHtml += `<div class="n8n-node" id="node-${{n.id}}" style="left: ${{n.x}}px; top: ${{n.y}}px;" onclick="selectNode('${{n.id}}')">
          <div class="node-icon-box" style="border-color: ${{n.color}};">${{n.icon}}</div>
          <div class="node-info">
            <div class="node-name" title="${{n.name}}">${{n.name}}</div>
            <div class="node-type-label">${{n.type}}</div>
          </div>
        </div>`;
      }});
      nodesContainer.innerHTML = nodesHtml;

      // Draw connection lines
      drawConnections();

      // Fit to overview
      goToStage(wf.tour[0].id);
    }}

    function drawConnections() {{
      const wf = workflowsData[currentWorkflowKey];
      const nodeMap = {{}};
      wf.nodes.forEach(n => nodeMap[n.id] = n);

      const svgWidth = 16000;
      const svgHeight = 8000;
      svg.setAttribute('width', svgWidth);
      svg.setAttribute('height', svgHeight);
      svg.style.width = svgWidth + 'px';
      svg.style.height = svgHeight + 'px';

      let paths = '';
      wf.conns.forEach(c => {{
        const src = nodeMap[c.from_id];
        const tgt = nodeMap[c.to_id];
        if (!src || !tgt) return;

        const x1 = src.x + 230;
        const y1 = src.y + 38;
        const x2 = tgt.x;
        const y2 = tgt.y + 38;
        const dx = Math.abs(x2 - x1) * 0.5;

        paths += `<path class="connection-line" d="M ${{x1}} ${{y1}} C ${{x1 + dx}} ${{y1}}, ${{x2 - dx}} ${{y2}}, ${{x2}} ${{y2}}" />`;
      }});
      svg.innerHTML = paths;
    }}

    function updateTransform() {{
      world.style.transform = `translate(${{panX}}px, ${{panY}}px) scale(${{scale}})`;
    }}

    // Drag / Pan
    viewport.addEventListener('mousedown', e => {{
      if (e.target.closest('.n8n-node') || e.target.closest('#info-panel') || e.target.closest('.zoom-controls') || e.target.closest('.sticky-note')) return;
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
    }});

    window.addEventListener('mousemove', e => {{
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      updateTransform();
    }});

    window.addEventListener('mouseup', () => isDragging = false);

    // Zoom on wheel
    viewport.addEventListener('wheel', e => {{
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      zoomAtPoint(zoomFactor, e.clientX, e.clientY);
    }}, {{ passive: false }});

    function zoomDelta(factor) {{
      const cx = viewport.clientWidth / 2;
      const cy = viewport.clientHeight / 2;
      zoomAtPoint(factor, cx, cy);
    }}

    function zoomAtPoint(factor, clientX, clientY) {{
      const newScale = Math.min(Math.max(scale * factor, 0.04), 1.5);
      const mouseWorldX = (clientX - panX) / scale;
      const mouseWorldY = (clientY - panY) / scale;
      panX = clientX - mouseWorldX * newScale;
      panY = clientY - mouseWorldY * newScale;
      scale = newScale;
      updateTransform();
    }}

    function fitView() {{
      goToStage('overview');
    }}

    function goToStage(stageId) {{
      const wf = workflowsData[currentWorkflowKey];
      const s = wf.tour.find(t => t.id === stageId);
      if (!s) return;

      document.querySelectorAll('.tour-btn').forEach(b => b.classList.remove('active'));
      if (event && event.target && event.target.classList.contains('tour-btn')) {{
        event.target.classList.add('active');
      }}

      const targetScale = s.zoom;
      const targetPanX = (viewport.clientWidth / 2) - (s.x * targetScale);
      const targetPanY = (viewport.clientHeight / 2) - (s.y * targetScale);

      world.style.transition = 'transform 0.7s cubic-bezier(0.25, 1, 0.5, 1)';
      scale = targetScale;
      panX = targetPanX;
      panY = targetPanY;
      updateTransform();

      setTimeout(() => {{
        world.style.transition = 'none';
      }}, 700);

      // Show stage info in drawer
      const panel = document.getElementById('info-panel');
      document.getElementById('panel-node-title').textContent = s.title;
      document.getElementById('panel-node-type').textContent = "Etapa del Pipeline n8n";
      document.getElementById('panel-node-desc').textContent = s.desc;
      document.getElementById('panel-node-params').textContent = "Etapa activa: " + stageId.toUpperCase() + "\\nWorkflow: " + wf.name;
      panel.classList.add('visible');
    }}

    function selectNode(nodeId) {{
      const wf = workflowsData[currentWorkflowKey];
      const node = wf.nodes.find(n => n.id === nodeId);
      if (!node) return;

      document.querySelectorAll('.n8n-node').forEach(n => n.classList.remove('selected'));
      document.getElementById('node-' + nodeId)?.classList.add('selected');

      const panel = document.getElementById('info-panel');
      document.getElementById('panel-node-title').textContent = node.name;
      document.getElementById('panel-node-type').textContent = node.type;
      document.getElementById('panel-node-desc').textContent = `Nodo de tipo [${{node.type}}]. Pertenece al grupo [${{node.cat.toUpperCase()}}] en el flujo ${{wf.name}}.`;
      document.getElementById('panel-node-params').textContent = JSON.stringify(node.parameters, null, 2);
      panel.classList.add('visible');
    }}

    function closePanel() {{
      document.getElementById('info-panel').classList.remove('visible');
      document.querySelectorAll('.n8n-node').forEach(n => n.classList.remove('selected'));
    }}

    function switchWorkflow(wfKey) {{
      renderWorkflow(wfKey);
    }}

    // Init with Master Workflow
    renderWorkflow('master');
  </script>

</body>
</html>'''

    with open(out_html, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f'Successfully updated Light Mode Canvas with Markdown rendering: {out_html}')

if __name__ == '__main__':
    generate_n8n_html()
