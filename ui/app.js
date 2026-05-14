const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const chatContainer = document.getElementById('chatContainer');
const sendBtn = document.getElementById('sendBtn');

let chatHistory = [];

// Initialize marked with breaks
marked.setOptions({
  breaks: true,
  gfm: true
});

function addMessage(role, content, isStreaming = false) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role === 'user' ? 'user' : 'system'}`;
  
  const avatarDiv = document.createElement('div');
  avatarDiv.className = 'avatar';
  avatarDiv.innerHTML = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
  
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'bubble';
  
  if (isStreaming) {
    bubbleDiv.id = 'streaming-bubble';
    bubbleDiv.innerHTML = `<div class="thinking-indicator">
      <div class="shimmer-line" style="width: 75%"></div>
      <div class="shimmer-line" style="width: 50%"></div>
      <div class="shimmer-line" style="width: 60%"></div>
    </div>`;
  } else {
    bubbleDiv.innerHTML = role === 'user' ? content : marked.parse(content);
  }

  msgDiv.appendChild(avatarDiv);
  msgDiv.appendChild(bubbleDiv);
  chatContainer.appendChild(msgDiv);
  
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return bubbleDiv;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const message = userInput.value.trim();
  if (!message) return;
  
  // Add user message to UI and history
  addMessage('user', message);
  chatHistory.push({ role: 'user', content: message });
  
  userInput.value = '';
  sendBtn.disabled = true;
  userInput.disabled = true;

  // Add a placeholder for the bot's streaming response
  const streamBubble = addMessage('assistant', '', true);
  let assistantFullText = '';

  try {
    const response = await fetch('http://localhost:4000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: chatHistory,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to connect to Orchestrator: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let isFirstChunk = true;
    let renderFrame;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      if (isFirstChunk) {
        streamBubble.innerHTML = ''; // Clear typing indicator only when we actually get data
        isFirstChunk = false;
      }
      
      const chunkStr = decoder.decode(value, { stream: true });
      assistantFullText += chunkStr;
      
      // Use requestAnimationFrame to debounce heavy Markdown parsing and prevent UI freeze
      if (!renderFrame) {
        renderFrame = requestAnimationFrame(() => {
          streamBubble.innerHTML = marked.parse(assistantFullText) + '<span class="pulse-dots"><span>.</span><span>.</span><span>.</span></span>';
          chatContainer.scrollTop = chatContainer.scrollHeight;
          renderFrame = null;
        });
      }
    }
    
    // Ensure final render without the dots
    if (renderFrame) cancelAnimationFrame(renderFrame);
    streamBubble.innerHTML = marked.parse(assistantFullText);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Save the final response to history
    chatHistory.push({ role: 'assistant', content: assistantFullText });

  } catch (error) {
    console.error(error);
    streamBubble.innerHTML = marked.parse(`❌ **Error:** ${error.message}. Make sure your Orchestrator is running!`);
  } finally {
    streamBubble.removeAttribute('id');
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
  }
});
