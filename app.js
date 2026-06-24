// Hybrid AI Search - No Backend Needed
// Uses DuckDuckGo API + Groq AI directly from browser

const CONFIG = {
    GROQ_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
    MODEL: 'llama3-8b-8192',
    MAX_RESULTS: 8
};

// DOM Elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const resultsContainer = document.getElementById('results');
const loadingDiv = document.getElementById('loading');
const emptyState = document.getElementById('empty-state');
const clearBtn = document.getElementById('clear-btn');
const apiKeySection = document.getElementById('api-key-section');
const apiKeyInput = document.getElementById('api-key-input');

// Check if API key exists
let GROQ_API_KEY = localStorage.getItem('groq_api_key') || '';
if (!GROQ_API_KEY) {
    apiKeySection.classList.remove('hidden');
}

function saveApiKey() {
    const key = apiKeyInput.value.trim();
    if (key.startsWith('gsk_')) {
        GROQ_API_KEY = key;
        localStorage.setItem('groq_api_key', key);
        apiKeySection.classList.add('hidden');
        showToast('API Key saved!');
    } else {
        showToast('Invalid key. Should start with gsk_');
    }
}

// Event Listeners
searchInput.addEventListener('input', (e) => {
    clearBtn.classList.toggle('hidden', !e.target.value);
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});

function clearSearch() {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    searchInput.focus();
}

function quickSearch(query) {
    searchInput.value = query;
    clearBtn.classList.remove('hidden');
    performSearch();
}

// Loading
function startLoading() {
    loadingDiv.classList.remove('hidden');
    loadingDiv.classList.add('flex');
    emptyState.classList.add('hidden');
    resultsContainer.innerHTML = '';
    searchBtn.disabled = true;
    searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
}

function stopLoading() {
    loadingDiv.classList.add('hidden');
    loadingDiv.classList.remove('flex');
    searchBtn.disabled = false;
    searchBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i><span>Search with AI</span>';
}

// Main Search
async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    
    if (!GROQ_API_KEY) {
        apiKeySection.classList.remove('hidden');
        showToast('Please add your Groq API key first');
        return;
    }
    
    startLoading();
    
    try {
        // Search DuckDuckGo
        const results = await searchDuckDuckGo(query);
        
        // Generate AI summary
        let aiAnswer = null;
        const aiEnabled = document.getElementById('ai-toggle').checked;
        if (aiEnabled && results.length > 0) {
            aiAnswer = await generateAISummary(query, results);
        }
        
        // Save to history
        saveToHistory(query, results);
        
        // Render
        renderResults({ query, results, ai_answer: aiAnswer });
    } catch (error) {
        console.error('Search error:', error);
        showError('Search failed. Please try again.');
    } finally {
        stopLoading();
    }
}

// DuckDuckGo Search
async function searchDuckDuckGo(query) {
    const proxyUrl = 'https://api.allorigins.win/get?url=';
    const ddgUrl = encodeURIComponent(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    
    try {
        const response = await fetch(proxyUrl + ddgUrl);
        const data = await response.json();
        const parsed = JSON.parse(data.contents);
        
        const results = [];
        
        if (parsed.AbstractText) {
            results.push({
                title: parsed.Heading || query,
                snippet: parsed.AbstractText,
                url: parsed.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                source: 'DuckDuckGo',
                type: 'featured'
            });
        }
        
        for (const topic of parsed.RelatedTopics || []) {
            if (topic.FirstURL && topic.Text) {
                results.push({
                    title: topic.Text.split(' - ')[0] || topic.Text,
                    snippet: topic.Text,
                    url: topic.FirstURL,
                    source: 'DuckDuckGo',
                    type: 'result'
                });
            }
        }
        
        return results.slice(0, CONFIG.MAX_RESULTS);
    } catch (e) {
        console.error('DuckDuckGo error:', e);
        // Fallback to mock results
        return getMockResults(query);
    }
}

// AI Summary with Groq
async function generateAISummary(query, results) {
    const context = results.slice(0, 3).map((r, i) => 
        `Source ${i+1}: ${r.title}\n${r.snippet}`
    ).join('\n\n');
    
    const prompt = `Based on these search results, provide a concise, accurate answer to the query. Be brief (2-3 sentences max).

Query: ${query}

Results:
${context}

Answer:`;
    
    try {
        const response = await fetch(CONFIG.GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: CONFIG.MODEL,
                messages: [
                    { role: 'system', content: 'You are a helpful search assistant. Provide concise, accurate answers.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 300,
                temperature: 0.3
            })
        });
        
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (e) {
        console.error('AI error:', e);
        return null;
    }
}

// Mock Results (fallback)
function getMockResults(query) {
    return [
        {
            title: `Search: ${query}`,
            snippet: `Results for "${query}". Connect to the internet for live search results.`,
            url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            source: 'Demo',
            type: 'result'
        },
        {
            title: 'About AI Search',
            snippet: 'This app combines web search with AI summarization for better answers.',
            url: 'https://en.wikipedia.org/wiki/Search_engine',
            source: 'Wikipedia',
            type: 'result'
        }
    ];
}

// Render Results
function renderResults(data) {
    emptyState.classList.add('hidden');
    resultsContainer.innerHTML = '';
    
    // AI Answer
    if (data.ai_answer) {
        const aiCard = document.createElement('div');
        aiCard.className = 'result-card bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-2xl p-5 border border-indigo-500/30 mb-4';
        aiCard.innerHTML = `
            <div class="flex items-center gap-2 mb-3">
                <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <i class="fas fa-robot text-white text-sm"></i>
                </div>
                <h3 class="font-semibold text-indigo-300 text-sm">AI Answer</h3>
            </div>
            <div class="ai-answer text-slate-200 text-sm leading-relaxed">
                ${data.ai_answer}
            </div>
            <div class="mt-3 flex gap-2">
                <button onclick="copyText('${encodeURIComponent(data.ai_answer)}')" class="text-xs text-indigo-400 flex items-center gap-1">
                    <i class="fas fa-copy"></i> Copy
                </button>
            </div>
        `;
        resultsContainer.appendChild(aiCard);
    }
    
    // Source Results
    data.results.forEach((result, index) => {
        const card = document.createElement('div');
        card.className = 'result-card glass rounded-2xl p-4 hover:bg-slate-800/50 transition-colors cursor-pointer';
        card.style.animationDelay = `${(index + 1) * 100}ms`;
        
        card.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-globe text-slate-400"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs text-slate-500">${new URL(result.url).hostname}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">${result.source}</span>
                        ${result.type === 'featured' ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Featured</span>' : ''}
                    </div>
                    <h3 class="font-semibold text-white text-sm mb-1 line-clamp-2">${result.title}</h3>
                    <p class="text-slate-400 text-xs line-clamp-3 mb-2">${result.snippet}</p>
                    <a href="${result.url}" target="_blank" rel="noopener" class="text-xs text-indigo-400 flex items-center gap-1">
                        Visit <i class="fas fa-external-link-alt text-[10px]"></i>
                    </a>
                </div>
            </div>
        `;
        
        resultsContainer.appendChild(card);
    });
}

// History
function saveToHistory(query, results) {
    const history = JSON.parse(localStorage.getItem('search_history') || '[]');
    history.unshift({ query, timestamp: Date.now(), results: results.slice(0, 2) });
    localStorage.setItem('search_history', JSON.stringify(history.slice(0, 20)));
}

function showHistory() {
    const history = JSON.parse(localStorage.getItem('search_history') || '[]');
    if (history.length === 0) {
        showToast('No history yet');
        return;
    }
    
    resultsContainer.innerHTML = '';
    emptyState.classList.add('hidden');
    
    history.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'result-card glass rounded-xl p-4 cursor-pointer mb-3';
        card.style.animationDelay = `${index * 50}ms`;
        card.onclick = () => {
            searchInput.value = item.query;
            performSearch();
        };
        
        card.innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <p class="font-medium text-sm text-white">${item.query}</p>
                    <p class="text-xs text-slate-500">${new Date(item.timestamp).toLocaleDateString()}</p>
                </div>
                <i class="fas fa-chevron-right text-slate-600"></i>
            </div>
        `;
        resultsContainer.appendChild(card);
    });
}

function clearHistory() {
    localStorage.removeItem('search_history');
    showToast('History cleared');
    toggleSettings();
}

// Utilities
function showError(message) {
    resultsContainer.innerHTML = `
        <div class="text-center py-12">
            <div class="w-16 h-16 rounded-full glass flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-exclamation-triangle text-2xl text-amber-500"></i>
            </div>
            <p class="text-slate-400 text-sm">${message}</p>
        </div>
    `;
}

function copyText(text) {
    navigator.clipboard.writeText(decodeURIComponent(text));
    showToast('Copied!');
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-full text-sm shadow-lg z-50';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function toggleSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.toggle('hidden');
}

console.log('Hybrid AI Search loaded');

// Voice Search functionality
let recognition = null;

function initVoiceSearch() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onstart = function() {
            searchInput.placeholder = "Listening...";
            document.getElementById('mic-btn').classList.add('text-red-400');
            showToast('Listening... Speak now');
        };
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            searchInput.value = transcript;
            clearBtn.classList.remove('hidden');
            performSearch();
        };
        
        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            searchInput.placeholder = "Ask anything...";
            document.getElementById('mic-btn').classList.remove('text-red-400');
            if (event.error === 'not-allowed') {
                showToast('Microphone permission denied');
            } else {
                showToast('Voice search failed. Try again.');
            }
        };
        
        recognition.onend = function() {
            searchInput.placeholder = "Ask anything...";
            document.getElementById('mic-btn').classList.remove('text-red-400');
        };
    } else {
        console.log('Speech recognition not supported');
    }
}

function startVoiceSearch() {
    if (!recognition) {
        initVoiceSearch();
    }
    
    if (recognition) {
        try {
            recognition.start();
        } catch (e) {
            showToast('Microphone not available');
        }
    } else {
        showToast('Voice search not supported on this device');
    }
}

// Initialize voice search on load
initVoiceSearch();
