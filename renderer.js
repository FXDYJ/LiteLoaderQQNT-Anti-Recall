var recalledMsgList = [];
var recallerNameMap = {};
var nowConfig = {};

export async function onSettingWindowCreated(view) {
  nowConfig = await window.anti_recall.getNowConfig();

  const settingsHTML = `
    <plugin-menu>
      <setting-item class="config_view">
        <!-- Tab Navigation -->
        <div class="ar-tabs">
          <div class="ar-tab ar-tab-active" data-tab="settings">⚙️ 设置</div>
          <div class="ar-tab" data-tab="stats">📊 统计</div>
          <div class="ar-tab" data-tab="history">📋 撤回记录</div>
          <div class="ar-tab" data-tab="logs">📝 日志</div>
        </div>

        <!-- Settings Tab -->
        <div class="ar-tab-content ar-tab-content-active" id="ar-tab-settings">
          <setting-section data-title="基础配置">
            <setting-panel>
              <setting-list data-direction="column">
                <setting-item data-direction="row">
                  <setting-text>操作</setting-text>
                  <button id="clearDb" class="q-button q-button--small q-button--secondary">清空已储存的撤回消息</button>
                </setting-item>

                <setting-item data-direction="row">
                  <div style="width:90%;">
                    <setting-text>是否将消息存入数据库（SQLite）</setting-text>
                    <span class="secondary-text">使用 SQLite 数据库持久化存储消息，支持多账号。开启后消息会实时写入磁盘，不占用内存。关闭后重启QQ将丢失撤回消息。</span>
                  </div>
                  <div id="switchSaveDb" class="q-switch">
                    <span class="q-switch__handle"></span>
                  </div>
                </setting-item>

                <div class="vertical-list-item">
                  <div style="width:90%;">
                    <h2>是否反撤回自己的消息</h2>
                    <span class="secondary-text">如果开启，则自己发送的消息也会被反撤回。开启后，从下一条消息开始起生效。</span>
                  </div>
                  <div id="switchAntiRecallSelf" class="q-switch">
                    <span class="q-switch__handle"></span>
                  </div>
                </div>

                <div class="vertical-list-item">
                  <div style="width:90%;">
                    <h2>显示撤回者昵称</h2>
                    <span class="secondary-text">在"已撤回"旁边显示谁撤回了消息。如果是本人撤回则不显示。</span>
                  </div>
                  <div id="switchShowRecaller" class="q-switch">
                    <span class="q-switch__handle"></span>
                  </div>
                </div>

                <setting-item data-direction="row">
                  <div>
                    <h2>数据库中消息最大保存条数</h2>
                    <span class="secondary-text">超过此数量将自动清理最旧的非撤回消息。已标记为撤回的消息不会被自动清理。</span>
                  </div>
                  <div style="width:30%;pointer-events: auto;margin-left:10px;">
                    <input id="maxMsgLimit" min="1" max="99999999" maxlength="8" class="text_color path-input" style="width:65%;" type="number" value="${nowConfig.maxMsgSaveLimit || 50000}"/>条
                  </div>
                </setting-item>

                <setting-item data-direction="row">
                  <div>
                    <h2>每次清理消息数量</h2>
                    <span class="secondary-text">当消息超过上限时，一次清理的数量。</span>
                  </div>
                  <div style="width:30%;pointer-events: auto;margin-left:10px;">
                    <input id="deletePerTime" min="1" max="99999" maxlength="5" class="text_color path-input" style="width:65%; margin-left: 3px" type="number" value="${nowConfig.deleteMsgCountPerTime || 2000}"/>条
                  </div>
                </setting-item>
              </setting-list>
            </setting-panel>
          </setting-section>

          <setting-section data-title="媒体文件保存">
            <setting-panel>
              <setting-list data-direction="column">
                <div class="vertical-list-item">
                  <div style="width:90%;">
                    <h2>收到图片/视频/文件时立即保存</h2>
                    <span class="secondary-text">将收到的媒体文件立即复制到插件数据目录，以防撤回后丢失。文件超过大小限制则不保存。</span>
                  </div>
                  <div id="switchSaveMedia" class="q-switch">
                    <span class="q-switch__handle"></span>
                  </div>
                </div>

                <setting-item data-direction="row">
                  <div>
                    <h2>单个文件最大保存大小</h2>
                    <span class="secondary-text">超过此大小的媒体文件将不会被自动保存。</span>
                  </div>
                  <div style="width:30%;pointer-events: auto;margin-left:10px;">
                    <input id="maxFileSizeMB" min="1" max="1024" maxlength="4" class="text_color path-input" style="width:65%;" type="number" value="${nowConfig.maxFileSaveSizeMB || 50}"/> MB
                  </div>
                </setting-item>

                <setting-item data-direction="row">
                  <div>
                    <h2>最多保存文件数量</h2>
                    <span class="secondary-text">超过此数量将自动清理最旧的文件。</span>
                  </div>
                  <div style="width:30%;pointer-events: auto;margin-left:10px;">
                    <input id="maxFileSaveLimit" min="1" max="999999" maxlength="6" class="text_color path-input" style="width:65%;" type="number" value="${nowConfig.maxFileSaveLimit || 5000}"/>个
                  </div>
                </setting-item>

                <setting-item data-direction="row">
                  <div>
                    <h2>每次清理文件数量</h2>
                    <span class="secondary-text">当文件超过上限时，一次清理的数量。</span>
                  </div>
                  <div style="width:30%;pointer-events: auto;margin-left:10px;">
                    <input id="deleteFilePerTime" min="1" max="99999" maxlength="5" class="text_color path-input" style="width:65%;" type="number" value="${nowConfig.deleteFileCountPerTime || 500}"/>个
                  </div>
                </setting-item>
              </setting-list>
            </setting-panel>
          </setting-section>

          <setting-section data-title="样式配置">
            <setting-panel>
              <setting-list data-direction="column">
                <setting-item data-direction="row">
                  <div>
                    <h2>撤回主题色</h2>
                    <span class="secondary-text">将会同时影响阴影和"已撤回"提示的颜色</span>
                  </div>
                  <div>
                    <input type="color" value="#ff0000" class="q-button q-button--small q-button--secondary pick-color" />
                  </div>
                </setting-item>

                <hr class="horizontal-dividing-line" />

                <div class="vertical-list-item">
                  <div>
                    <h2>撤回后消息是否显示阴影</h2>
                    <span class="secondary-text">修改将自动保存并实时生效</span>
                  </div>
                  <div id="switchShadow" class="q-switch">
                    <span class="q-switch__handle"></span>
                  </div>
                </div>

                <hr class="horizontal-dividing-line" />

                <div class="vertical-list-item">
                  <div>
                    <h2>撤回后消息下方是否显示"已撤回"提示</h2>
                    <span class="secondary-text">修改将自动保存并在重新滚动消息后生效</span>
                  </div>
                  <div id="switchTip" class="q-switch">
                    <span class="q-switch__handle"></span>
                  </div>
                </div>
              </setting-list>
            </setting-panel>
          </setting-section>
        </div>

        <!-- Stats Tab -->
        <div class="ar-tab-content" id="ar-tab-stats">
          <setting-section data-title="统计概览">
            <setting-panel>
              <div class="ar-stats-grid" id="statsGrid">
                <div class="ar-stat-card">
                  <div class="ar-stat-value" id="stat-totalMessages">-</div>
                  <div class="ar-stat-label">总消息数</div>
                </div>
                <div class="ar-stat-card ar-stat-highlight">
                  <div class="ar-stat-value" id="stat-totalRecalled">-</div>
                  <div class="ar-stat-label">撤回消息数</div>
                </div>
                <div class="ar-stat-card">
                  <div class="ar-stat-value" id="stat-totalFiles">-</div>
                  <div class="ar-stat-label">已保存文件数</div>
                </div>
                <div class="ar-stat-card">
                  <div class="ar-stat-value" id="stat-totalFileSize">-</div>
                  <div class="ar-stat-label">文件总大小</div>
                </div>
                <div class="ar-stat-card">
                  <div class="ar-stat-value" id="stat-dbSize">-</div>
                  <div class="ar-stat-label">数据库大小</div>
                </div>
                <div class="ar-stat-card">
                  <div class="ar-stat-value" id="stat-recallRate">-</div>
                  <div class="ar-stat-label">撤回率</div>
                </div>
              </div>
            </setting-panel>
          </setting-section>

          <setting-section data-title="最近7天撤回趋势">
            <setting-panel>
              <div class="ar-chart-container" id="recallChart"></div>
            </setting-panel>
          </setting-section>

          <setting-section data-title="撤回排行榜">
            <setting-panel>
              <div class="ar-ranking-container">
                <div class="ar-ranking-section">
                  <h3 class="ar-ranking-title">🏆 撤回最多的人</h3>
                  <div id="topRecallers" class="ar-ranking-list"></div>
                </div>
                <div class="ar-ranking-section">
                  <h3 class="ar-ranking-title">💬 撤回最多的会话</h3>
                  <div id="topPeers" class="ar-ranking-list"></div>
                </div>
              </div>
            </setting-panel>
          </setting-section>

          <setting-section data-title="文件类型分布">
            <setting-panel>
              <div id="fileTypeStats" class="ar-file-type-stats"></div>
            </setting-panel>
          </setting-section>

          <div style="text-align:center; margin:12px 0;">
            <button id="refreshStats" class="q-button q-button--small q-button--secondary">🔄 刷新统计</button>
          </div>
        </div>

        <!-- History Tab -->
        <div class="ar-tab-content" id="ar-tab-history">
          <setting-section data-title="撤回消息记录">
            <setting-panel>
              <div class="ar-history-toolbar">
                <input id="historySearch" type="text" placeholder="🔍 搜索撤回消息内容..." class="ar-search-input text_color" />
                <select id="historyFilter" class="ar-filter-select text_color">
                  <option value="all">全部会话</option>
                </select>
                <button id="historyRefresh" class="q-button q-button--small q-button--secondary">🔄</button>
              </div>
              <div id="historyList" class="ar-history-list">
                <div class="ar-history-empty">点击刷新按钮加载撤回记录</div>
              </div>
              <div class="ar-history-pagination">
                <button id="historyPrev" class="q-button q-button--small q-button--secondary" disabled>◀ 上一页</button>
                <span id="historyPageInfo" class="ar-page-info">第 1 页</span>
                <button id="historyNext" class="q-button q-button--small q-button--secondary">下一页 ▶</button>
              </div>
            </setting-panel>
          </setting-section>
        </div>

        <!-- Logs Tab -->
        <div class="ar-tab-content" id="ar-tab-logs">
          <setting-section data-title="诊断信息">
            <setting-panel>
              <div id="diagnosticsInfo" class="ar-diagnostics-grid"></div>
            </setting-panel>
          </setting-section>

          <setting-section data-title="详细日志">
            <setting-panel>
              <div class="ar-logs-toolbar">
                <select id="logLevelFilter" class="ar-filter-select text_color">
                  <option value="all">全部级别</option>
                  <option value="ERROR">仅错误</option>
                  <option value="WARN">警告及以上</option>
                  <option value="INFO">信息及以上</option>
                  <option value="DEBUG">全部(含调试)</option>
                </select>
                <button id="logsRefresh" class="q-button q-button--small q-button--secondary">🔄 刷新</button>
                <button id="logsCopy" class="q-button q-button--small q-button--secondary">📋 复制全部</button>
                <label class="ar-auto-refresh-label">
                  <input id="logsAutoRefresh" type="checkbox" /> 自动刷新
                </label>
              </div>
              <div id="logsList" class="ar-logs-list">
                <div class="ar-history-empty">点击刷新按钮加载日志</div>
              </div>
              <div id="logsCount" class="ar-logs-count"></div>
            </setting-panel>
          </setting-section>
        </div>

        <style>
          .ar-tabs { display: flex; border-bottom: 2px solid rgba(127,127,127,0.2); margin-bottom: 16px; gap: 4px; }
          .ar-tab { padding: 10px 20px; cursor: pointer; border-radius: 8px 8px 0 0; font-size: 14px; font-weight: 500; color: var(--text_secondary); transition: all 0.2s ease; user-select: none; }
          .ar-tab:hover { background-color: rgba(127,127,127,0.1); color: var(--text_primary); }
          .ar-tab-active { color: var(--text_primary) !important; border-bottom: 2px solid var(--brand_standard); margin-bottom: -2px; background-color: rgba(127,127,127,0.05); }
          .ar-tab-content { display: none; }
          .ar-tab-content-active { display: block; }
          .ar-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 8px 0; }
          .ar-stat-card { background: rgba(127,127,127,0.06); border-radius: 10px; padding: 16px; text-align: center; transition: transform 0.2s ease, box-shadow 0.2s ease; }
          .ar-stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .ar-stat-highlight { background: linear-gradient(135deg, rgba(255,109,109,0.12), rgba(255,109,109,0.04)); border: 1px solid rgba(255,109,109,0.2); }
          .ar-stat-value { font-size: 24px; font-weight: 700; color: var(--text_primary); margin-bottom: 4px; }
          .ar-stat-label { font-size: 12px; color: var(--text_secondary); }
          .ar-chart-container { display: flex; align-items: flex-end; gap: 8px; height: 120px; padding: 12px 8px 4px; }
          .ar-chart-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
          .ar-chart-bar { width: 100%; max-width: 40px; background: linear-gradient(180deg, #ff6d6d, #ff9b9b); border-radius: 4px 4px 0 0; min-height: 2px; transition: height 0.4s ease; }
          .ar-chart-count { font-size: 11px; color: var(--text_secondary); margin-bottom: 4px; }
          .ar-chart-label { font-size: 10px; color: var(--text_secondary); margin-top: 4px; white-space: nowrap; }
          .ar-ranking-container { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .ar-ranking-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: var(--text_primary); }
          .ar-ranking-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-radius: 6px; margin-bottom: 4px; background: rgba(127,127,127,0.05); font-size: 13px; }
          .ar-ranking-item:hover { background: rgba(127,127,127,0.1); }
          .ar-ranking-name { color: var(--text_primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px; }
          .ar-ranking-count { color: #ff6d6d; font-weight: 600; margin-left: 8px; flex-shrink: 0; }
          .ar-ranking-badge { margin-right: 6px; }
          .ar-file-type-stats { display: flex; gap: 12px; flex-wrap: wrap; padding: 8px 0; }
          .ar-file-type-item { background: rgba(127,127,127,0.06); border-radius: 8px; padding: 10px 16px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
          .ar-file-type-icon { font-size: 18px; }
          .ar-history-toolbar { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; }
          .ar-search-input { flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(127,127,127,0.3); background: rgba(127,127,127,0.05); font-size: 13px; outline: none; transition: border-color 0.2s; }
          .ar-search-input:focus { border-color: #ff6d6d; }
          .ar-filter-select { padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(127,127,127,0.3); background: rgba(127,127,127,0.05); font-size: 13px; outline: none; min-width: 140px; }
          .ar-history-list { max-height: 400px; overflow-y: auto; }
          .ar-history-empty { text-align: center; color: var(--text_secondary); padding: 40px 0; font-size: 14px; }
          .ar-history-item { padding: 12px; border-radius: 8px; margin-bottom: 8px; background: rgba(127,127,127,0.04); border-left: 3px solid #ff6d6d; transition: background 0.2s; }
          .ar-history-item:hover { background: rgba(127,127,127,0.08); }
          .ar-history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
          .ar-history-sender { font-weight: 600; font-size: 13px; color: var(--text_primary); }
          .ar-history-time { font-size: 11px; color: var(--text_secondary); }
          .ar-history-content { font-size: 13px; color: var(--text_primary); line-height: 1.5; word-break: break-all; }
          .ar-history-meta { display: flex; gap: 12px; margin-top: 6px; font-size: 11px; color: var(--text_secondary); }
          .ar-history-pagination { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 12px; padding: 8px 0; }
          .ar-page-info { font-size: 13px; color: var(--text_secondary); }
          .ar-diagnostics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 8px 0; }
          .ar-diag-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 6px; background: rgba(127,127,127,0.05); font-size: 13px; }
          .ar-diag-label { color: var(--text_secondary); font-weight: 500; }
          .ar-diag-value { color: var(--text_primary); font-family: monospace; word-break: break-all; max-width: 60%; text-align: right; }
          .ar-diag-ok { color: #4caf50; }
          .ar-diag-err { color: #f44336; }
          .ar-logs-toolbar { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; }
          .ar-auto-refresh-label { font-size: 13px; color: var(--text_secondary); display: flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; }
          .ar-logs-list { max-height: 500px; overflow-y: auto; font-family: monospace; font-size: 12px; background: rgba(0,0,0,0.03); border-radius: 8px; padding: 8px; }
          .ar-log-entry { padding: 4px 8px; border-radius: 4px; margin-bottom: 2px; line-height: 1.5; word-break: break-all; }
          .ar-log-entry:hover { background: rgba(127,127,127,0.08); }
          .ar-log-time { color: var(--text_secondary); margin-right: 8px; }
          .ar-log-level-ERROR { color: #f44336; font-weight: 700; }
          .ar-log-level-WARN { color: #ff9800; font-weight: 600; }
          .ar-log-level-INFO { color: #2196f3; }
          .ar-log-level-DEBUG { color: var(--text_secondary); }
          .ar-log-msg { color: var(--text_primary); }
          .ar-logs-count { text-align: center; font-size: 12px; color: var(--text_secondary); margin-top: 8px; }
          .img-hidden { display: none; }
          .path-input { align-self: normal; flex: 1; border-radius: 6px; margin-right: 16px; transition: all 100ms ease-out; border: 1px solid rgba(127,127,127,0.3); padding: 4px 8px; background: rgba(127,127,127,0.05); }
          .path-input:focus { padding-left: 8px; border-color: #ff6d6d; outline: none; }
          .config_view { margin: 20px; }
          .config_view h1 { color: var(--text_primary); font-weight: var(--font-bold); font-size: min(var(--font_size_3), 18px); line-height: min(var(--line_height_3), 24px); padding: 0px 16px; margin-bottom: 8px; }
          .config_view .wrap { background-color: var(--fill_light_primary, var(--fg_white)); border-radius: 8px; font-size: min(var(--font_size_3), 18px); line-height: min(var(--line_height_3), 24px); margin-bottom: 20px; overflow: hidden; padding: 0px 16px; }
          .config_view .vertical-list-item { margin: 12px 0px; display: flex; justify-content: space-between; align-items: center; }
          .config_view .horizontal-dividing-line { border: unset; margin: unset; height: 1px; background-color: rgba(127,127,127,0.15); }
          .config_view .secondary-text { color: var(--text_secondary); font-size: min(var(--font_size_2), 16px); line-height: min(var(--line_height_2), 22px); margin-top: 4px; }
          .config_view .hidden { display: none !important; }
          .config_view .disabled { pointer-events: none; opacity: 0.5; }
          .config_view .modal-window { display: flex; justify-content: center; align-items: center; position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 999; background-color: rgba(0,0,0,0.5); }
          .config_view .modal-dialog { width: 480px; border-radius: 8px; background-color: var(--bg_bottom_standard, var(--fg_white)); }
          @media (prefers-color-scheme: light) { .text_color { color: black; } }
          @media (prefers-color-scheme: dark) { .text_color { color: white; } }
        </style>
      </setting-item>
    </plugin-menu>
  `;

  const parser = new DOMParser();
  const doc = parser.parseFromString(settingsHTML, "text/html");
  const node = doc.querySelector("plugin-menu");

  // Tab Switching
  const tabs = node.querySelectorAll(".ar-tab");
  const tabContents = node.querySelectorAll(".ar-tab-content");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("ar-tab-active"));
      tabContents.forEach((tc) => tc.classList.remove("ar-tab-content-active"));
      tab.classList.add("ar-tab-active");
      const target = tab.getAttribute("data-tab");
      node.querySelector("#ar-tab-" + target).classList.add("ar-tab-content-active");
      if (target === "stats") loadStats(node);
      if (target === "history") loadHistory(node);
      if (target === "logs") loadLogs(node);
    });
  });

  // Settings Bindings
  node.querySelector("#clearDb").onclick = async () => {
    await window.anti_recall.clearDb();
  };

  node.querySelector("#maxMsgLimit").onblur = async () => {
    var limit = parseInt(node.querySelector("#maxMsgLimit").value, 10);
    if (isNaN(limit) || limit <= 0 || limit > 99999999) { alert("数量输入有误，请重新输入"); return; }
    nowConfig.maxMsgSaveLimit = limit;
    await window.anti_recall.saveConfig(nowConfig);
  };

  node.querySelector("#deletePerTime").onblur = async () => {
    var limit = parseInt(node.querySelector("#deletePerTime").value, 10);
    if (isNaN(limit) || limit <= 0 || limit > 99999) { alert("数量输入有误，请重新输入"); return; }
    nowConfig.deleteMsgCountPerTime = limit;
    await window.anti_recall.saveConfig(nowConfig);
  };

  node.querySelector("#maxFileSizeMB").onblur = async () => {
    var limit = parseInt(node.querySelector("#maxFileSizeMB").value, 10);
    if (isNaN(limit) || limit <= 0 || limit > 1024) { alert("大小输入有误，请重新输入"); return; }
    nowConfig.maxFileSaveSizeMB = limit;
    await window.anti_recall.saveConfig(nowConfig);
  };

  node.querySelector("#maxFileSaveLimit").onblur = async () => {
    var limit = parseInt(node.querySelector("#maxFileSaveLimit").value, 10);
    if (isNaN(limit) || limit <= 0 || limit > 999999) { alert("数量输入有误，请重新输入"); return; }
    nowConfig.maxFileSaveLimit = limit;
    await window.anti_recall.saveConfig(nowConfig);
  };

  node.querySelector("#deleteFilePerTime").onblur = async () => {
    var limit = parseInt(node.querySelector("#deleteFilePerTime").value, 10);
    if (isNaN(limit) || limit <= 0 || limit > 99999) { alert("数量输入有误，请重新输入"); return; }
    nowConfig.deleteFileCountPerTime = limit;
    await window.anti_recall.saveConfig(nowConfig);
  };

  // Color picker
  const pickColor = node.querySelector(".pick-color");
  pickColor.value = nowConfig.mainColor || "#ff6d6d";
  pickColor.addEventListener("change", async (event) => {
    nowConfig.mainColor = event.target.value;
    await window.anti_recall.saveConfig(nowConfig);
  });

  // Toggle switches
  setupSwitch(node, "#switchSaveDb", nowConfig.saveDb !== false, async (val) => {
    nowConfig.saveDb = val;
    await window.anti_recall.saveConfig(nowConfig);
  });
  setupSwitch(node, "#switchAntiRecallSelf", nowConfig.isAntiRecallSelfMsg === true, async (val) => {
    nowConfig.isAntiRecallSelfMsg = val;
    await window.anti_recall.saveConfig(nowConfig);
  });
  setupSwitch(node, "#switchShowRecaller", nowConfig.showRecaller !== false, async (val) => {
    nowConfig.showRecaller = val;
    await window.anti_recall.saveConfig(nowConfig);
  });
  setupSwitch(node, "#switchSaveMedia", nowConfig.saveMediaImmediately !== false, async (val) => {
    nowConfig.saveMediaImmediately = val;
    await window.anti_recall.saveConfig(nowConfig);
  });
  setupSwitch(node, "#switchShadow", nowConfig.enableShadow !== false, async (val) => {
    nowConfig.enableShadow = val;
    await window.anti_recall.saveConfig(nowConfig);
  });
  setupSwitch(node, "#switchTip", nowConfig.enableTip !== false, async (val) => {
    nowConfig.enableTip = val;
    await window.anti_recall.saveConfig(nowConfig);
  });

  // Stats refresh
  node.querySelector("#refreshStats").onclick = () => loadStats(node);

  // History pagination
  let historyPage = 1;
  const pageSize = 20;

  node.querySelector("#historyRefresh").onclick = () => { historyPage = 1; loadHistory(node); };
  node.querySelector("#historySearch").addEventListener("keydown", (e) => { if (e.key === "Enter") { historyPage = 1; loadHistory(node); } });
  node.querySelector("#historyFilter").addEventListener("change", () => { historyPage = 1; loadHistory(node); });
  node.querySelector("#historyPrev").onclick = () => { if (historyPage > 1) { historyPage--; loadHistory(node); } };
  node.querySelector("#historyNext").onclick = () => { historyPage++; loadHistory(node); };

  async function loadHistory(root) {
    const listEl = root.querySelector("#historyList");
    const keyword = root.querySelector("#historySearch").value.trim();
    const peerFilter = root.querySelector("#historyFilter").value;

    try {
      const peers = await window.anti_recall.getPeersWithRecalls();
      const select = root.querySelector("#historyFilter");
      const currentVal = select.value;
      select.innerHTML = '<option value="all">全部会话</option>';
      for (const p of peers) {
        const opt = document.createElement("option");
        opt.value = p.peer_uid;
        opt.textContent = p.sender_name || p.peer_uid || "未知";
        select.appendChild(opt);
      }
      select.value = currentVal;
    } catch (_) {}

    let records = [];
    try {
      const offset = (historyPage - 1) * pageSize;
      if (keyword) {
        records = await window.anti_recall.searchRecalled(keyword, pageSize, offset);
      } else if (peerFilter && peerFilter !== "all") {
        records = await window.anti_recall.getRecalledByPeer(peerFilter, pageSize, offset);
      } else {
        records = await window.anti_recall.getAllRecalled(pageSize, offset);
      }
    } catch (e) {
      console.log("[Anti-Recall] Load history error:", e);
    }

    if (!records || records.length === 0) {
      listEl.innerHTML = '<div class="ar-history-empty">暂无撤回记录</div>';
      root.querySelector("#historyPrev").disabled = historyPage <= 1;
      root.querySelector("#historyNext").disabled = true;
      root.querySelector("#historyPageInfo").textContent = "第 " + historyPage + " 页";
      return;
    }

    listEl.innerHTML = records.map(function(r) {
      var msgData = r.msg_data || {};
      var content = extractTextContent(msgData);
      var senderName = r.sender_name || (msgData.sendNickName) || (msgData.sendMemberName) || "未知";
      var recallTime = r.recall_time ? new Date(r.recall_time).toLocaleString() : "未知";
      var msgTime = r.msg_time ? new Date(r.msg_time).toLocaleString() : "";
      var recaller = r.recaller_name || "";

      return '<div class="ar-history-item" data-msgid="' + r.msg_id + '">'
        + '<div class="ar-history-header">'
        + '<span class="ar-history-sender">' + escapeHtml(senderName) + '</span>'
        + '<span class="ar-history-time">撤回于 ' + recallTime + '</span>'
        + '</div>'
        + '<div class="ar-history-content">' + escapeHtml(content || "[非文本消息]") + '</div>'
        + '<div class="ar-history-meta">'
        + (msgTime ? '<span>📅 发送于 ' + msgTime + '</span>' : '')
        + (recaller ? '<span>🚫 撤回者: ' + escapeHtml(recaller) + '</span>' : '')
        + '<span>💬 会话: ' + escapeHtml(r.peer_uid || "未知") + '</span>'
        + '</div></div>';
    }).join("");

    root.querySelector("#historyPrev").disabled = historyPage <= 1;
    root.querySelector("#historyNext").disabled = records.length < pageSize;
    root.querySelector("#historyPageInfo").textContent = "第 " + historyPage + " 页";
  }

  // Logs tab
  var logsAutoRefreshTimer = null;

  node.querySelector("#logsRefresh").onclick = () => loadLogs(node);
  node.querySelector("#logLevelFilter").addEventListener("change", () => loadLogs(node));
  node.querySelector("#logsCopy").onclick = async () => {
    try {
      var logs = await window.anti_recall.getLogs();
      var text = logs.map(function(l) {
        return "[" + l.time + "] [" + l.level + "] " + l.message;
      }).join("\n");
      var diag = await window.anti_recall.getDiagnostics();
      var diagText = "\n--- Diagnostics ---\n" + JSON.stringify(diag, null, 2);
      await navigator.clipboard.writeText(text + diagText);
      node.querySelector("#logsCopy").textContent = "✅ 已复制";
      setTimeout(() => { node.querySelector("#logsCopy").textContent = "📋 复制全部"; }, 2000);
    } catch (e) {
      console.log("[Anti-Recall] Copy logs error:", e);
    }
  };
  node.querySelector("#logsAutoRefresh").addEventListener("change", function() {
    if (this.checked) {
      loadLogs(node);
      logsAutoRefreshTimer = setInterval(() => loadLogs(node), 3000);
    } else {
      if (logsAutoRefreshTimer) { clearInterval(logsAutoRefreshTimer); logsAutoRefreshTimer = null; }
    }
  });

  async function loadLogs(root) {
    var listEl = root.querySelector("#logsList");
    var countEl = root.querySelector("#logsCount");
    var levelFilter = root.querySelector("#logLevelFilter").value;

    // Load diagnostics
    try {
      var diag = await window.anti_recall.getDiagnostics();
      var diagEl = root.querySelector("#diagnosticsInfo");
      var diagItems = [
        { label: "数据目录", value: diag.pluginDataDir || "-" },
        { label: "配置文件", value: diag.configFilePath || "-" },
        { label: "数据库路径", value: diag.dbPath || "-" },
        { label: "数据库已初始化", value: diag.dbInitialized ? "✅ 是" : "❌ 否", ok: diag.dbInitialized },
        { label: "数据库文件存在", value: diag.dbFileExists ? "✅ 是" : "❌ 否", ok: diag.dbFileExists },
        { label: "数据库保存已启用", value: diag.saveDbEnabled ? "✅ 是" : "❌ 否", ok: diag.saveDbEnabled },
        { label: "当前账号UID", value: diag.myUid || "-" },
        { label: "日志条目数", value: String(diag.totalLogEntries || 0) },
      ];
      diagEl.innerHTML = diagItems.map(function(d) {
        var valClass = "ar-diag-value";
        if (d.ok === true) valClass += " ar-diag-ok";
        else if (d.ok === false) valClass += " ar-diag-err";
        return '<div class="ar-diag-item"><span class="ar-diag-label">' + escapeHtml(d.label) + '</span><span class="' + valClass + '">' + escapeHtml(d.value) + '</span></div>';
      }).join("");
    } catch (e) {
      console.log("[Anti-Recall] Load diagnostics error:", e);
    }

    // Load logs
    try {
      var logs = await window.anti_recall.getLogs();
      var levelPriority = { "DEBUG": 0, "INFO": 1, "WARN": 2, "ERROR": 3 };

      if (levelFilter && levelFilter !== "all") {
        var minLevel = levelPriority[levelFilter] || 0;
        logs = logs.filter(function(l) {
          return (levelPriority[l.level] || 0) >= minLevel;
        });
      }

      if (!logs || logs.length === 0) {
        listEl.innerHTML = '<div class="ar-history-empty">暂无日志</div>';
        countEl.textContent = "";
        return;
      }

      // Show newest first
      var reversed = logs.slice().reverse();
      listEl.innerHTML = reversed.map(function(l) {
        var timeStr = l.time ? l.time.replace("T", " ").replace("Z", "").substring(0, 23) : "";
        return '<div class="ar-log-entry">'
          + '<span class="ar-log-time">' + escapeHtml(timeStr) + '</span>'
          + '<span class="ar-log-level-' + escapeHtml(l.level) + '">[' + escapeHtml(l.level) + ']</span> '
          + '<span class="ar-log-msg">' + escapeHtml(l.message) + '</span>'
          + '</div>';
      }).join("");

      countEl.textContent = "共 " + logs.length + " 条日志";
    } catch (e) {
      console.log("[Anti-Recall] Load logs error:", e);
      listEl.innerHTML = '<div class="ar-history-empty">加载日志失败: ' + escapeHtml(String(e)) + '</div>';
    }
  }

  view.appendChild(node);
}

// Helper Functions
function setupSwitch(root, selector, initialState, onChange) {
  var el = root.querySelector(selector);
  if (!el) return;
  if (initialState) el.classList.add("is-active");
  el.addEventListener("click", async () => {
    var isActive = el.classList.contains("is-active");
    el.classList.toggle("is-active");
    await onChange(!isActive);
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  var k = 1024;
  var sizes = ["B", "KB", "MB", "GB"];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function escapeHtml(text) {
  if (!text) return "";
  var div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function extractTextContent(msgData) {
  if (!msgData || !Array.isArray(msgData.elements)) return "";
  var texts = [];
  for (var i = 0; i < msgData.elements.length; i++) {
    var el = msgData.elements[i];
    if (el && el.textElement && el.textElement.content) { texts.push(el.textElement.content); }
    else if (el && el.picElement) { texts.push("[图片]"); }
    else if (el && el.videoElement) { texts.push("[视频]"); }
    else if (el && el.fileElement) { texts.push("[文件]"); }
    else if (el && el.faceElement) { texts.push("[表情]"); }
    else if (el && el.arkElement) { texts.push("[卡片消息]"); }
    else if (el && el.replyElement) { texts.push("[回复]"); }
    else if (el && el.marketFaceElement) { texts.push("[表情包]"); }
  }
  return texts.join("") || "";
}

async function loadStats(root) {
  try {
    var stats = await window.anti_recall.getDetailedStats();
    root.querySelector("#stat-totalMessages").textContent = (stats.totalMessages || 0).toLocaleString();
    root.querySelector("#stat-totalRecalled").textContent = (stats.totalRecalled || 0).toLocaleString();
    root.querySelector("#stat-totalFiles").textContent = (stats.totalFiles || 0).toLocaleString();
    root.querySelector("#stat-totalFileSize").textContent = formatBytes(stats.totalFileSize || 0);
    root.querySelector("#stat-dbSize").textContent = formatBytes(stats.dbSize || 0);
    var rate = stats.totalMessages > 0 ? ((stats.totalRecalled / stats.totalMessages) * 100).toFixed(2) + "%" : "0%";
    root.querySelector("#stat-recallRate").textContent = rate;

    // Chart
    var chartEl = root.querySelector("#recallChart");
    var chartData = stats.recallByDay || [];
    if (chartData.length > 0) {
      var maxCount = 1;
      for (var ci = 0; ci < chartData.length; ci++) { if (chartData[ci].count > maxCount) maxCount = chartData[ci].count; }
      chartEl.innerHTML = chartData.map(function(d) {
        var height = Math.max((d.count / maxCount) * 90, 2);
        var label = d.day ? d.day.substring(5) : "";
        return '<div class="ar-chart-bar-wrap"><span class="ar-chart-count">' + d.count + '</span><div class="ar-chart-bar" style="height:' + height + 'px"></div><span class="ar-chart-label">' + label + '</span></div>';
      }).join("");
    } else {
      chartEl.innerHTML = '<div class="ar-history-empty" style="height:100%;display:flex;align-items:center;justify-content:center;width:100%">暂无近7天数据</div>';
    }

    // Rankings
    var recallersEl = root.querySelector("#topRecallers");
    var topRecallers = stats.topRecallers || [];
    var badges = ["🥇", "🥈", "🥉"];
    if (topRecallers.length > 0) {
      recallersEl.innerHTML = topRecallers.map(function(r, i) {
        return '<div class="ar-ranking-item"><span><span class="ar-ranking-badge">' + (badges[i] || ((i+1)+'.')) + '</span><span class="ar-ranking-name">' + escapeHtml(r.recaller_name || "未知") + '</span></span><span class="ar-ranking-count">' + r.count + ' 次</span></div>';
      }).join("");
    } else {
      recallersEl.innerHTML = '<div class="ar-history-empty" style="padding:12px 0">暂无数据</div>';
    }

    var peersEl = root.querySelector("#topPeers");
    var topPeers = stats.topPeers || [];
    if (topPeers.length > 0) {
      peersEl.innerHTML = topPeers.map(function(p, i) {
        return '<div class="ar-ranking-item"><span><span class="ar-ranking-badge">' + (badges[i] || ((i+1)+'.')) + '</span><span class="ar-ranking-name">' + escapeHtml(p.peer_uid || "未知") + '</span></span><span class="ar-ranking-count">' + p.count + ' 次</span></div>';
      }).join("");
    } else {
      peersEl.innerHTML = '<div class="ar-history-empty" style="padding:12px 0">暂无数据</div>';
    }

    // File types
    var fileTypesEl = root.querySelector("#fileTypeStats");
    var fileTypes = stats.fileTypes || [];
    var typeIcons = { image: "🖼️", video: "🎬", file: "📁" };
    var typeNames = { image: "图片", video: "视频", file: "文件" };
    if (fileTypes.length > 0) {
      fileTypesEl.innerHTML = fileTypes.map(function(ft) {
        return '<div class="ar-file-type-item"><span class="ar-file-type-icon">' + (typeIcons[ft.file_type] || "📄") + '</span><span>' + (typeNames[ft.file_type] || ft.file_type) + ': ' + ft.count + ' 个 (' + formatBytes(ft.total_size || 0) + ')</span></div>';
      }).join("");
    } else {
      fileTypesEl.innerHTML = '<div class="ar-history-empty" style="padding:12px 0">暂无文件</div>';
    }
  } catch (e) {
    console.log("[Anti-Recall] Load stats error:", e);
  }
}

// Chat Page Logic
async function patchCss() {
  nowConfig = await window.anti_recall.getNowConfig();
  var cssNode = document.evaluate("/html/head/style[@id='anti-recall-css']", document).iterateNext();
  if (cssNode) cssNode.parentElement.removeChild(cssNode);

  var stylee = document.createElement("style");
  stylee.type = "text/css";
  stylee.id = "anti-recall-css";

  var sHtml = ".message-content__wrapper { color: var(--bubble_guest_text); display: flex; grid-row-start: content; grid-column-start: content; grid-row-end: content; grid-column-end: content; max-width: -webkit-fill-available; min-height: 38px; overflow: visible !important; border-radius: 10px; }"
    + " .message-content__wrapper.message-content-recalled-parent { padding: 0px !important; }"
    + " .message-content-recalled-parent { border-radius: 10px; position: relative; overflow: unset !important;";

  if (nowConfig.enableShadow === true) {
    sHtml += " margin-top:3px; margin-left:3px; margin-right:3px; margin-bottom:25px; box-shadow: 0px 0px 8px 5px " + nowConfig.mainColor + " !important;";
  } else {
    sHtml += " margin-bottom:15px;";
  }

  sHtml += " } .recalledNoMargin { margin-top: 0px!important; }"
    + " .message-content-recalled { position: absolute; top: calc(100% + 6px); left: 0; font-size: 12px; white-space: nowrap;"
    + " background-color: var(--background-color-05); backdrop-filter: blur(28px); padding: 4px 8px; margin-bottom: 2px;"
    + " border-radius: 6px; box-shadow: var(--box-shadow); transition: 300ms; transform: translateX(-30%); opacity: 0;"
    + " pointer-events: none; color:" + nowConfig.mainColor + "; }";

  stylee.innerHTML = sHtml;
  document.getElementsByTagName("head").item(0).appendChild(stylee);
}

onLoad();

async function onLoad() {
  anti_recall.repatchCss(async (event, _) => { await patchCss(); });

  // Recall tip callback - now receives recaller name
  anti_recall.recallTip(async (event, msgId, recallerName) => {
    console.log("[Anti-Recall]", "尝试反撤回消息ID", msgId, "撤回者:", recallerName || "");
    if (recallerName) recallerNameMap[msgId] = recallerName;

    var oldElement = document.getElementById(msgId + "-msgContainerMsgContent");
    var newElement = document.getElementById(msgId + "-msgContent");
    var mlEl = document.getElementById("ml-" + msgId);
    var unixElement = mlEl ? mlEl.querySelector(".msg-content-container") : null;
    var cardElement = document.getElementById(msgId + "-msgContent");
    var arkElement = document.getElementById("ark-msg-content-container_" + msgId);

    if (oldElement != null) {
      if (oldElement.classList.contains("gray-tip-message")) return;
      await appendRecalledTag(oldElement, msgId);
    } else if (newElement != null) {
      if (newElement.classList.contains("gray-tip-message")) return;
      await appendRecalledTag(newElement.parentElement, msgId);
    } else if (unixElement != null) {
      if (unixElement.classList.contains("gray-tip-message")) return;
      await appendRecalledTag(unixElement.parentElement, msgId);
    } else if (cardElement != null) {
      if (cardElement.classList.contains("gray-tip-message")) return;
      cardElement.classList.add("recalledNoMargin");
      await appendRecalledTag(cardElement.parentElement, msgId);
    } else if (arkElement != null) {
      if (arkElement.classList.contains("gray-tip-message")) return;
      arkElement.classList.add("recalledNoMargin");
      await appendRecalledTag(arkElement.parentElement, msgId);
    } else {
      var container = document.querySelector(".ml-item[id='" + msgId + "'] .msg-content-container");
      if (container) await appendRecalledTag(container, msgId);
    }
  });

  // Message list callback - now receives recaller name map
  anti_recall.recallTipList(async (event, msgIdList, nameMap) => {
    recalledMsgList = msgIdList || [];
    if (nameMap) Object.assign(recallerNameMap, nameMap);
    await render();
  });

  await patchCss();

  var observerRendering = false;
  var observer = new MutationObserver(async (mutationsList) => {
    for (var mi = 0; mi < mutationsList.length; mi++) {
      var mutation = mutationsList[mi];
      if (mutation.type === "childList") {
        if (mutation.addedNodes != null && mutation.addedNodes.length > 0 && mutation.addedNodes[0].classList != null && mutation.addedNodes[0].classList.contains("message-content-recalled")) {
          // Ignore our own additions
        } else {
          if (observerRendering) continue;
          observerRendering = true;
          setTimeout(() => { observerRendering = false; render(); }, 50);
        }
      }
    }
  });

  var finder = setInterval(() => {
    if (document.querySelector(".ml-list.list")) {
      clearInterval(finder);
      console.log("[Anti-Recall]", "检测到聊天区域，已在当前页面加载反撤回");
      observer.observe(document.querySelector(".ml-list.list"), { attributes: false, childList: true, subtree: true });
    }
  }, 100);

  async function render() {
    var vlist = document.querySelector(".chat-msg-area__vlist");
    if (!vlist) return;
    var elements = vlist.querySelectorAll(".ml-item");
    if (!elements) return;
    nowConfig = await window.anti_recall.getNowConfig();

    for (var ei = 0; ei < elements.length; ei++) {
      var el = elements[ei];
      var findMsgId = recalledMsgList.find((i) => i == el.id);
      if (findMsgId != null) {
        var msgId = findMsgId;
        try {
          var oldElement = el.querySelector("div[id='" + msgId + "-msgContainerMsgContent']");
          var newElement = el.querySelector("div[id='" + msgId + "-msgContent']");
          var mlEl2 = el.querySelector("div[id='ml-" + msgId + "']");
          var unixElement = mlEl2 ? mlEl2.querySelector(".msg-content-container") : null;
          var cardElement = el.querySelector("div[id='" + msgId + "-msgContent']");
          var arkElement = el.querySelector("div[id='ark-msg-content-container_" + msgId + "']");

          if (oldElement != null) {
            if (oldElement.classList.contains("gray-tip-message")) continue;
            await appendRecalledTag(oldElement, msgId);
          } else if (newElement != null) {
            if (newElement.classList.contains("gray-tip-message")) continue;
            await appendRecalledTag(newElement.parentElement, msgId);
          } else if (unixElement != null) {
            if (unixElement.classList.contains("gray-tip-message")) continue;
            await appendRecalledTag(unixElement.parentElement, msgId);
          } else if (cardElement != null) {
            if (cardElement.classList.contains("gray-tip-message")) continue;
            cardElement.classList.add("recalledNoMargin");
            await appendRecalledTag(cardElement.parentElement, msgId);
          } else if (arkElement != null) {
            if (arkElement.classList.contains("gray-tip-message")) continue;
            arkElement.classList.add("recalledNoMargin");
            await appendRecalledTag(arkElement.parentElement, msgId);
          } else {
            var container = el.querySelector('.msg-content-container');
            if (!container) container = el.querySelector('.file-message--content');
            if (container) await appendRecalledTag(container, msgId);
          }
        } catch (e) {
          console.log("[Anti-Recall]", "反撤回消息时出错", e);
        }
      }
    }
  }

  async function appendRecalledTag(msgElement, msgId) {
    if (!msgElement) return;
    var currRecalledTip = msgElement.querySelector(".message-content-recalled");
    if (currRecalledTip == null) {
      msgElement.classList.add("message-content-recalled-parent");
      if (nowConfig.enableTip === true) {
        var recalledEl = document.createElement("div");
        var tipText = "已撤回";
        if (nowConfig.showRecaller !== false && msgId && recallerNameMap[msgId]) {
          tipText += " (by " + recallerNameMap[msgId] + ")";
        }
        recalledEl.innerText = tipText;
        recalledEl.classList.add("message-content-recalled");
        msgElement.appendChild(recalledEl);
        setTimeout(() => { recalledEl.style.transform = "translateX(0)"; recalledEl.style.opacity = "1"; }, 5);
      }
    }
  }
}
