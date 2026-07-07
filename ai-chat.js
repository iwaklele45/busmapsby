/**
 * AI Chat Widget Component - Vanilla JS Implementation
 * A premium, responsive, and accessible AI chat widget.
 * Dynamically utilizes routedata.json and halte.json to answer transport queries.
 * Integrates with Google Gemini API using dynamically loaded configuration.
 * State (messages & open/close state) is persisted in sessionStorage.
 */

// Helper to convert hex to RGB components for CSS custom properties
function hexToRgbComponents(hex) {
  hex = hex.replace(/^#/, '');
  let r = 0, g = 0, b = 0;
  if (hex.length === 3) {
    r = parseInt(hex.substring(0, 1).repeat(2), 16);
    g = parseInt(hex.substring(1, 2).repeat(2), 16);
    b = parseInt(hex.substring(2, 3).repeat(2), 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  return `${r}, ${g}, ${b}`;
}

// Inline SVG Assets
const SVGS = {
  chat: `<svg class="ai-chat-btn-icon icon-chat" viewBox="0 0 24 24">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
    <path d="M8 7h8v2H8zm0 4h8v2H8z" opacity="0.6"/>
  </svg>`,
  spark: `<svg class="ai-chat-btn-icon icon-chat" viewBox="0 0 24 24" style="padding: 2px;">
    <path d="M19 10.5l-1.2-2.8L15 6.5l2.8-1.2L19 2.5l1.2 2.8L23 6.5l-2.8 1.2L19 10.5zm-7-2L10.5 4 9 8.5 4 10.5l5 2 1.5 4.5 1.5-4.5 5-2-5-2zm6 8.5l-1 2.3-2.3 1 2.3 1 1 2.3 1-2.3 2.3-1-2.3-1-1-2.3z"/>
  </svg>`,
  close: `<svg class="ai-chat-btn-icon icon-close" viewBox="0 0 24 24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
  </svg>`,
  headerClose: `<svg viewBox="0 0 24 24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
  </svg>`,
  send: `<svg viewBox="0 0 24 24">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>`,
  trash: `<svg viewBox="0 0 24 24">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
  </svg>`,
  arrowDown: `<svg viewBox="0 0 24 24">
    <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/>
  </svg>`,
  robot: `<svg viewBox="0 0 24 24">
    <path d="M19 8h-1.18c-.46-2.28-2.48-4-4.82-4-.89 0-1.73.27-2.44.75L9.12 3.32c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.52 1.52C8.42 7.15 8 8.03 8 9v1H6c-1.1 0-2 .9-2 2v3c0 1.1.9 2 2 2h2v1c0 1.66 1.34 3 3 3h6c1.66 0 3-1.34 3-3v-1h2c1.1 0 2-.9 2-2v-3c0-1.1-.9-2-2-2h-2V9c0-.97-.42-1.85-1.12-2.48zM8.5 12c.83 0 1.5.67 1.5 1.5S9.33 15 8.5 15 7 14.33 7 13.5 7.67 12 8.5 12zm7 0c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5z" />
  </svg>`
};

/**
 * ChatMessage Component
 */
class ChatMessage {
  constructor(text, sender) {
    this.text = text;
    this.sender = sender;
  }

  // Sanitize and format bubble content, keeping specific tags and formatting lists/bold/links
  formatText(rawText) {
    let html = rawText;

    // 1. Temporarily replace allowed anchor tags with placeholders to bypass escaping
    const placeholders = [];
    html = html.replace(/<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1(?:\s+target=(["'])(.*?)\3)?\s*>(.*?)<\/a>/gi, (match, q1, href, q2, target, text) => {
      const id = `___ANCHOR_PLACEHOLDER_${placeholders.length}___`;
      placeholders.push({
        id: id,
        html: `<a href="${href}"${target ? ` target="${target}"` : ''}>${text}</a>`
      });
      return id;
    });

    // 2. Escape HTML characters to prevent XSS
    html = html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 3. Restore the allowed anchor tags
    placeholders.forEach(placeholder => {
      html = html.replace(placeholder.id, placeholder.html);
    });

    // 4. Replace markdown links [text](url)
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // 5. Replace markdown bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 6. Replace markdown lists starting with - or *
    const lines = html.split('\n');
    let inList = false;
    let listHtml = '';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) {
          listHtml += '<ul>';
          inList = true;
        }
        listHtml += `<li>${line.substring(2)}</li>`;
      } else {
        if (inList) {
          listHtml += '</ul>';
          inList = false;
        }
        listHtml += line + (i < lines.length - 1 ? '<br>' : '');
      }
    }
    if (inList) {
      listHtml += '</ul>';
    }

    return listHtml;
  }

  render() {
    const row = document.createElement('div');
    row.className = `ai-chat-msg-row ${this.sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'ai-chat-bubble';
    bubble.innerHTML = this.formatText(this.text);

    row.appendChild(bubble);
    return row;
  }
}

/**
 * TypingIndicator Component
 */
class TypingIndicator {
  constructor() {
    this.element = null;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'ai-chat-typing-container';

    const indicator = document.createElement('div');
    indicator.className = 'ai-chat-typing';

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'ai-chat-dot';
      indicator.appendChild(dot);
    }

    container.appendChild(indicator);
    this.element = container;
    return container;
  }

  remove() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

/**
 * AIChatWidget Main Coordinator
 */
class AIChatWidget {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.chatBtnContainer = null;
    this.chatBtn = null;
    this.chatWindow = null;
    this.backdrop = null;
    this.chatBody = null;
    this.chatInput = null;
    this.sendBtn = null;

    // Async data states
    this.routeData = null;
    this.halteData = null;
    this.aiConfig = null;

    this.initColors();
    this.buildWidget();
    this.setupEventListeners();
    this.loadTransitData();
    this.loadAIConfig();
    this.loadPersistedState();
  }

  initColors() {
    const rootStyles = getComputedStyle(document.documentElement);
    let accent = rootStyles.getPropertyValue('--accent-color').trim();

    let resolvedColor = '#ff8811';
    let rgbComponents = '255, 136, 17';

    if (accent) {
      if (accent.includes(',')) {
        rgbComponents = accent;
        resolvedColor = `rgb(${accent})`;
      } else if (accent.startsWith('#')) {
        resolvedColor = accent;
        rgbComponents = hexToRgbComponents(accent);
      } else {
        resolvedColor = accent;
      }
    }

    document.documentElement.style.setProperty('--chat-accent', resolvedColor);
    document.documentElement.style.setProperty('--chat-accent-rgb', rgbComponents);
  }

  async loadTransitData() {
    try {
      const ruteRes = await fetch('./routedata.json');
      this.routeData = await ruteRes.json();

      const halteRes = await fetch('./halte.json');
      const halteJson = await halteRes.json();
      this.halteData = halteJson.halte;
    } catch (e) {
      console.error('Failed to load transit data:', e);
    }
  }

  async loadAIConfig() {
    try {
      const configRes = await fetch('./ai-chat-config.json');
      this.aiConfig = await configRes.json();
    } catch (e) {
      console.warn('AI configuration file (ai-chat-config.json) not found or invalid. Falling back to offline rule engine.', e);
    }
  }

  buildWidget() {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'ai-chat-backdrop';
    this.backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.backdrop);

    this.chatBtnContainer = document.createElement('div');
    this.chatBtnContainer.className = 'ai-chat-btn-container';

    this.chatBtn = document.createElement('button');
    this.chatBtn.className = 'ai-chat-btn';
    this.chatBtn.setAttribute('aria-label', 'Buka Asisten AI');
    this.chatBtn.setAttribute('aria-haspopup', 'dialog');
    this.chatBtn.setAttribute('aria-expanded', 'false');
    this.chatBtn.innerHTML = `${SVGS.spark}${SVGS.close}`;

    this.chatBtnContainer.appendChild(this.chatBtn);
    document.body.appendChild(this.chatBtnContainer);

    this.chatWindow = document.createElement('div');
    this.chatWindow.className = 'ai-chat-window';
    this.chatWindow.setAttribute('role', 'dialog');
    this.chatWindow.setAttribute('aria-modal', 'true');
    this.chatWindow.setAttribute('aria-label', 'Klacak AI Assistant');
    this.chatWindow.setAttribute('tabindex', '-1');

    const header = document.createElement('div');
    header.className = 'ai-chat-header';

    const profile = document.createElement('div');
    profile.className = 'ai-chat-header-profile';

    const avatar = document.createElement('div');
    avatar.className = 'ai-chat-avatar';
    avatar.innerHTML = SVGS.robot;

    const info = document.createElement('div');
    info.className = 'ai-chat-info';

    const name = document.createElement('span');
    name.className = 'ai-chat-name';
    name.innerText = 'Klacak Assistant';

    const status = document.createElement('div');
    status.className = 'ai-chat-status';

    const statusDot = document.createElement('div');
    statusDot.className = 'ai-chat-status-dot';

    const statusText = document.createElement('span');
    statusText.innerText = 'Online';

    status.appendChild(statusDot);
    status.appendChild(statusText);
    info.appendChild(name);
    info.appendChild(status);
    profile.appendChild(avatar);
    profile.appendChild(info);

    const headerActions = document.createElement('div');
    headerActions.className = 'ai-chat-header-actions';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'ai-chat-clear-btn';
    clearBtn.setAttribute('aria-label', 'Hapus riwayat chat');
    clearBtn.innerHTML = SVGS.trash;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ai-chat-close-btn';
    closeBtn.setAttribute('aria-label', 'Tutup Asisten AI');
    closeBtn.innerHTML = SVGS.headerClose;

    headerActions.appendChild(clearBtn);
    headerActions.appendChild(closeBtn);

    header.appendChild(profile);
    header.appendChild(headerActions);
    this.chatWindow.appendChild(header);

    this.chatBody = document.createElement('div');
    this.chatBody.className = 'ai-chat-body';
    this.chatWindow.appendChild(this.chatBody);

    // Floating scroll to bottom button
    this.scrollBtn = document.createElement('button');
    this.scrollBtn.className = 'ai-chat-scroll-btn';
    this.scrollBtn.setAttribute('aria-label', 'Scroll ke pesan baru');
    this.scrollBtn.innerHTML = SVGS.arrowDown;
    this.chatWindow.appendChild(this.scrollBtn);

    const inputArea = document.createElement('div');
    inputArea.className = 'ai-chat-input-area';

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'ai-chat-input-wrapper';

    this.chatInput = document.createElement('textarea');
    this.chatInput.className = 'ai-chat-input';
    this.chatInput.setAttribute('placeholder', 'Tanyakan apa saja...');
    this.chatInput.setAttribute('aria-label', 'Pesan Anda');
    this.chatInput.setAttribute('rows', '1');

    this.sendBtn = document.createElement('button');
    this.sendBtn.className = 'ai-chat-send-btn';
    this.sendBtn.setAttribute('aria-label', 'Kirim Pesan');
    this.sendBtn.disabled = true;
    this.sendBtn.innerHTML = SVGS.send;

    inputWrapper.appendChild(this.chatInput);
    inputWrapper.appendChild(this.sendBtn);
    inputArea.appendChild(inputWrapper);
    this.chatWindow.appendChild(inputArea);

    document.body.appendChild(this.chatWindow);

    this.appendMessage('Halo! Saya Klacak AI Assistant. Ada yang bisa saya bantu terkait rute bus, feeder wira-wiri, stasiun, atau tarif transportasi umum di Surabaya?', 'ai', false);
  }

  setupEventListeners() {
    this.chatBtn.addEventListener('click', () => this.toggleChat());
    this.chatWindow.querySelector('.ai-chat-close-btn').addEventListener('click', () => this.toggleChat(false));

    // Clear history
    this.chatWindow.querySelector('.ai-chat-clear-btn').addEventListener('click', () => {
      if (confirm('Hapus seluruh riwayat percakapan?')) {
        this.chatBody.innerHTML = '';
        this.messages = [];
        this.appendMessage('Halo! Saya Klacak AI Assistant. Ada yang bisa saya bantu terkait rute bus, feeder wira-wiri, stasiun, atau tarif transportasi umum di Surabaya?', 'ai', true);
        this.scrollBtn.classList.remove('visible');
      }
    });

    // Scroll button click
    this.scrollBtn.addEventListener('click', () => {
      this.scrollToBottom();
    });

    // Toggle scroll button visibility on scroll
    this.chatBody.addEventListener('scroll', () => {
      const threshold = 150;
      const isNearBottom = this.chatBody.scrollHeight - this.chatBody.scrollTop - this.chatBody.clientHeight < threshold;
      if (isNearBottom) {
        this.scrollBtn.classList.remove('visible');
      } else {
        this.scrollBtn.classList.add('visible');
      }
    });

    this.backdrop.addEventListener('click', () => this.toggleChat(false));

    this.chatInput.addEventListener('input', () => {
      this.sendBtn.disabled = this.chatInput.value.trim() === '';
      this.adjustInputHeight();
    });

    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    this.sendBtn.addEventListener('click', () => this.handleSendMessage());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.toggleChat(false);
      }
    });

    this.chatWindow.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const focusableEls = this.chatWindow.querySelectorAll('button, textarea, [tabindex="0"]');
        const firstFocusable = focusableEls[0];
        const lastFocusable = focusableEls[focusableEls.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            lastFocusable.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            firstFocusable.focus();
            e.preventDefault();
          }
        }
      }
    });
  }

  adjustInputHeight() {
    this.chatInput.style.height = 'auto';
    this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 80) + 'px';
  }

  toggleChat(forceState, persist = true) {
    const nextState = forceState !== undefined ? forceState : !this.isOpen;
    if (nextState === this.isOpen) return;

    this.isOpen = nextState;

    if (this.isOpen) {
      this.chatBtn.classList.add('open');
      this.chatBtn.setAttribute('aria-expanded', 'true');
      this.chatBtnContainer.classList.add('open-window');
      this.chatWindow.classList.add('active');
      this.backdrop.classList.add('active');
      setTimeout(() => {
        this.chatInput.focus();
      }, 100);
    } else {
      this.chatBtn.classList.remove('open');
      this.chatBtn.setAttribute('aria-expanded', 'false');
      this.chatBtnContainer.classList.remove('open-window');
      this.chatWindow.classList.remove('active');
      this.backdrop.classList.remove('active');
      this.chatBtn.focus();
    }

    if (persist) {
      this.persistState();
    }
  }

  appendMessage(text, sender, persist = true) {
    const message = new ChatMessage(text, sender);
    this.messages.push(message);
    const msgElement = message.render();
    this.chatBody.appendChild(msgElement);
    this.scrollToBottom();

    if (persist) {
      this.persistState();
    }
  }

  scrollToBottom() {
    this.chatBody.scrollTop = this.chatBody.scrollHeight;
  }

  async handleSendMessage() {
    const text = this.chatInput.value.trim();
    if (!text) return;

    this.appendMessage(text, 'user');
    this.chatInput.value = '';
    this.sendBtn.disabled = true;
    this.adjustInputHeight();

    const typingIndicator = new TypingIndicator();
    this.chatBody.appendChild(typingIndicator.render());
    this.scrollToBottom();

    // Determine Response Strategy: Online Gemini LLM vs Offline Database Rules
    let replyText = "";
    if (this.aiConfig && this.aiConfig.gemini_api_key && this.aiConfig.gemini_api_key !== "YOUR_API_KEY_HERE") {
      replyText = await this.getOnlineAIResponse(text);
    } else {
      // Simulate think delay
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 800));
      replyText = this.getOfflineResponse(text);
    }

    typingIndicator.remove();
    this.appendMessage(replyText, 'ai');
  }

  // Create clean summaries for AI context to fit context window completely and accurately
  getAIChatContext() {
    const routeSummary = {};
    if (this.routeData) {
      for (const key in this.routeData) {
        const r = this.routeData[key];
        routeSummary[key] = {
          name: r.name,
          title: r.title,
          hours: r.hours,
          stops: r.datahalte || {}
        };
      }
    }

    const halteSummary = [];
    if (this.halteData) {
      this.halteData.forEach(h => {
        halteSummary.push({
          nama: h.nama,
          uniqid: h.uniqid,
          transit: h.transit,
          lat: h.lat,
          lon: h.lon
        });
      });
    }

    return {
      routes: routeSummary,
      stops: halteSummary
    };
  }

  // Calls Google Gemini API using configured credentials and passes the full database context
  async getOnlineAIResponse(userMessage) {
    try {
      const apiKey = this.aiConfig.gemini_api_key;
      const model = this.aiConfig.gemini_model || "gemini-3.1-flash-lite";

      const chatContext = this.getAIChatContext();

      // Formulate context incorporating the complete database and instructions
      const systemContext = `Anda adalah Klacak AI Assistant, asisten transportasi umum Surabaya yang ramah dan membantu.
Tugas Anda membantu menjawab pertanyaan pengguna tentang rute bus, halte, stasiun, tarif, dan info transportasi Surabaya secara akurat menggunakan database resmi kami.

Berikut database rute lengkap yang tersedia pada web Klacak:
${JSON.stringify(chatContext.routes)}

Berikut database halte lengkap yang tersedia pada web Klacak (PENS, ITS, dll):
${JSON.stringify(chatContext.stops)}

PANDUAN PERJALANAN & TRANSIT (PENTING):
1. RUTE LANGSUNG: Sebelum menyarankan transit, periksa apakah halte asal dan halte tujuan memiliki rute yang sama dalam daftar "transit" mereka. Jika ada rute yang sama, sarankan naik rute tersebut secara langsung tanpa transit.
2. PANDUAN DARI PENS/ITS KE TUNJUNGAN PLAZA (TP):
   - Suroboyo Bus (R1/R2) diwakili oleh rute "sbr1". Arah Purabaya-Perak adalah A (R1) dan arah Perak-Purabaya adalah B (R2).
   - Dari Halte PENS 1 A / PENS 2, naik Suroboyo Bus arah B (R2) menuju Purabaya.
   - Turun di Halte Pandegiling 2.
   - Menyeberang jalan kaki ke Halte Pandegiling 1.
   - Transit naik Suroboyo Bus arah A (R1) menuju Perak/Rajawali.
   - Turun di Halte Kaliasin (Tunjungan Plaza).
3. HINDARI HALUSINASI TRANSIT: Jika perjalanan membutuhkan transit selain rute PENS ke TP di atas, dan Anda tidak yakin rute pastinya dari database, katakan dengan jujur bahwa Anda tidak memiliki rute transit otomatis yang pasti. Arahkan pengguna untuk membuka halaman peta utama <a href="./map.html?route=all">[Semua Rute]</a> untuk melihat koneksi halte secara visual di peta. Jangan pernah mengarang nama rute, nomor feeder, atau halte yang tidak ada di database!

INSTRUKSI PENTING:
1. Jika pengguna menanyakan tentang rute tertentu, sarankan rute yang sesuai di atas dan beri link interaktif menggunakan tag anchor relatif: <a href="./map.html?route=[key]">[Lacak Live Rute Ini]</a>.
2. Jika pengguna menanyakan halte tertentu, informasikan detail halte dan rute mana saja yang melaluinya (dari data transit halte tersebut), lalu arahkan koordinat navigasi ke: <a href="https://maps.google.com?daddr=[lat],[lon]" target="_blank">[Petunjuk Arah/Navigasi]</a> (cari koordinat lat/lon halte di database di atas).
3. Anda harus selalu memverifikasi keberadaan halte dan rute berdasarkan data JSON lengkap di atas sebelum menyatakan ada atau tidaknya.
4. Jawab dalam Bahasa Indonesia secara terstruktur dan gunakan format markdown (seperti bold dan bullet points). Jangan gunakan HTML mentah kecuali tag anchor relatif di atas.`;

      // Map conversation history to Gemini structure (user/model roles)
      const contents = this.messages.slice(-10).map(m => ({
        role: m.sender === "user" ? "user" : "model",
        parts: [{ text: m.text }]
      }));

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemContext }]
          },
          contents: contents,
          generationConfig: {
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const resJson = await response.json();
      return resJson.candidates[0].content.parts[0].text.trim();
    } catch (e) {
      console.error("Gemini API call failed. Falling back to offline engine:", e);
      return "Maaf, terjadi kesalahan koneksi saat menghubungi model AI online. Berikut respon dari sistem pencarian lokal saya:\n\n" + this.getOfflineResponse(userMessage);
    }
  }

  // Offline fallback search
  getOfflineResponse(query) {
    if (!this.routeData || !this.halteData) {
      return "Mohon tunggu sebentar, data rute dan halte sedang dimuat...";
    }

    const cleanQuery = query.toLowerCase().trim();
    const cleanQueryNoSpaces = cleanQuery.replace(/\s+/g, '');

    let matchedRoutes = [];
    for (const key in this.routeData) {
      const route = this.routeData[key];
      const rName = route.name.toLowerCase();
      const rKey = key.toLowerCase();

      if (cleanQueryNoSpaces.includes(rKey) ||
          cleanQueryNoSpaces.includes(rName.replace(/\s+/g, '')) ||
          (cleanQuery.includes('rute') && cleanQuery.includes(rName))) {
        matchedRoutes.push({ key, route });
      }
    }

    if (matchedRoutes.length > 0) {
      let response = `Berikut rute yang berhasil saya temukan:\n\n`;
      matchedRoutes.slice(0, 3).forEach(item => {
        const r = item.route;
        const stopCountA = r.datahalte?.a?.length || 0;
        const stopCountB = r.datahalte?.b?.length || 0;
        const type = r.feeder ? 'Feeder Wira-Wiri' : 'Trunk Bus';

        response += `**${r.name} - ${r.title}** (${type})\n`;
        response += `- Jam Operasi: ${r.hours || 'Tidak tersedia'}\n`;
        response += `- Jumlah Halte: ${stopCountA} (Arah A) / ${stopCountB} (Arah B)\n`;
        response += `- <a href="./map.html?route=${item.key}">[Lacak Live Rute Ini]</a>\n\n`;
      });
      return response;
    }

    let matchedStops = [];
    const halteIndex = cleanQuery.indexOf('halte');
    let searchPart = "";
    if (halteIndex !== -1) {
      searchPart = cleanQuery.substring(halteIndex + 5).trim();
    }

    this.halteData.forEach(halte => {
      const nameLower = halte.nama.toLowerCase();
      if (searchPart && nameLower.includes(searchPart)) {
        matchedStops.push(halte);
      } else if (!searchPart && nameLower.length > 4 && cleanQuery.includes(nameLower)) {
        matchedStops.push(halte);
      }
    });

    const uniqueStops = [];
    const seenNames = new Set();
    matchedStops.forEach(s => {
      if (!seenNames.has(s.nama)) {
        seenNames.add(s.nama);
        uniqueStops.push(s);
      }
    });

    if (uniqueStops.length > 0) {
      let response = `Berikut halte yang berhasil saya temukan:\n\n`;
      uniqueStops.slice(0, 3).forEach(halte => {
        let transitRoutes = [];
        if (halte.transit && Array.isArray(halte.transit)) {
          halte.transit.forEach(rKey => {
            const r = this.routeData[rKey];
            if (r) {
              transitRoutes.push(r.name);
            }
          });
        }

        response += `**Halte ${halte.nama}**\n`;
        if (transitRoutes.length > 0) {
          response += `- Dilewati oleh rute: ${transitRoutes.join(', ')}\n`;
        }
        response += `- <a href="https://maps.google.com?daddr=${halte.lat},${halte.lon}" target="_blank">[Petunjuk Arah/Navigasi]</a>\n\n`;
      });
      return response;
    }

    if (cleanQuery.includes('tarif') || cleanQuery.includes('bayar') || cleanQuery.includes('harga') || cleanQuery.includes('ongkos') || cleanQuery.includes('botol')) {
      return `**Informasi Tarif Transportasi Surabaya**:
- **Suroboyo Bus**: Rp 5.000 (Umum), Rp 2.500 (Mahasiswa/Pelajar), atau gratis menggunakan botol plastik bekas (ditukarkan di halte penukaran).
- **Feeder Wira-Wiri**: Rp 5.000 untuk umum.
- **Trans Semanggi Suroboyo**: Rp 6.200 (Tarif nasional Teman Bus).
Seluruh pembayaran non-tunai didukung via **QRIS** atau kartu e-money!`;
    }

    if (cleanQuery.includes('boyorail') || cleanQuery.includes('stasiun') || cleanQuery.includes('kereta') || cleanQuery.includes('train') || cleanQuery.includes('rail')) {
      return `**Boyorail** adalah visualisasi jaringan commuter rail dan stasiun kereta komuter di Surabaya.
Anda dapat memantau stasiun dan perjalanannya dengan mengeklik tombol **Boyorail** di menu utama website kami!`;
    }

    if (cleanQuery.includes('feeder') || cleanQuery.includes('wira') || cleanQuery.includes('wiri') || cleanQuery.includes('wira-wiri')) {
      return `**Feeder Wira-Wiri Suroboyo** adalah layanan angkutan pengumpan (microbus) yang menghubungkan jalan-jalan pemukiman Surabaya ke halte transit bus utama.
Anda bisa melacak rute Feeder Wira-Wiri secara real-time di halaman utama kami!`;
    }

    let response = `Halo! Saya Klacak AI Assistant. Saya tidak dapat menemukan rute atau halte spesifik untuk **"${query}"**.\n\n`;
    response += `Cobalah tanyakan hal seperti:\n`;
    response += `- *"Rute R1"* atau *"Rute FD01"*\n`;
    response += `- *"Halte Pandegiling"* atau *"Halte Darmo"*\n`;
    response += `- *"Berapa tarif bus?"*\n\n`;

    if (this.routeData) {
      response += `Beberapa rute aktif yang dapat Anda tanyakan:\n`;
      const popular = Object.keys(this.routeData).slice(0, 5);
      popular.forEach(key => {
        response += `- **${this.routeData[key].name}** (${this.routeData[key].title})\n`;
      });
    }

    return response;
  }

  persistState() {
    try {
      const state = {
        isOpen: this.isOpen,
        messages: this.messages.map(m => ({ text: m.text, sender: m.sender }))
      };
      sessionStorage.setItem('klacak_chat_state', JSON.stringify(state));
    } catch (e) {
      console.error('Failed to store chat session state:', e);
    }
  }

  loadPersistedState() {
    try {
      const savedState = sessionStorage.getItem('klacak_chat_state');
      if (savedState) {
        const state = JSON.parse(savedState);

        if (state.messages && state.messages.length > 0) {
          this.chatBody.innerHTML = '';
          this.messages = [];

          state.messages.forEach(m => {
            this.appendMessage(m.text, m.sender, false);
          });
        }

        if (state.isOpen) {
          this.toggleChat(true, false);
        }
      }
    } catch (e) {
      console.error('Failed to restore chat session state:', e);
    }
  }
}

// Auto instantiate on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  window.aiChatWidget = new AIChatWidget();
});
